import bcrypt from "bcryptjs";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import { AuthProvider, Role, UserStatus } from "../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { jwtUtils } from "../../utils/jwt";
import type {
	IForgotPasswordPayload,
	IGoogleLoginPayload,
	ILoginUserPayload,
	IRegisterPatientPayload,
	IRequestUser,
	IResetPasswordPayload,
	IVerifiEmailPayload,
} from "./auth.interface";
import type { TokenPayload } from "google-auth-library";
import { googleClient } from "../../lib/googleAuth";
import crypto from "crypto";
import { redisClient } from "../../lib/redis";
import { transpost } from "../../lib/nodemailer";
import ejs from "ejs";
import path from "path";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";

// ─── Register Patient ────────────────────────────────────────────────────────

const registerPatient = async (payload: IRegisterPatientPayload) => {
	const { name, password, patient: patientData } = payload;
	const email = payload.email.trim().toLowerCase();

	const isUserExists = await prisma.user.findUnique({ where: { email } });

	if (isUserExists) {
		throw new Error("User with this email already exists");
	}

	const hashedPassword = await bcrypt.hash(password, Number(config.bcrypt_salt_rounds));

	const expiresSeconds = 5 * 60;

	const otpkey = `patient-registration-otp:${email}`;
	const otpValue = crypto.randomInt(100000, 1000000).toString();

	await redisClient.set(otpkey, otpValue, {
		expiration: {
			 type: "EX",
			  value: expiresSeconds
		 },
	});

	const registrationKey = `patient-registration-data:${email}`;
	const redisUserDataPayload = {
		name,
		email,
		password: hashedPassword,
		patient: patientData,
	};

	await redisClient.set(registrationKey, JSON.stringify(redisUserDataPayload), {
		expiration: 
		{ type: "EX",
			 value: expiresSeconds 
			},
	});

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/registration-user-otp.ejs",
	);
	
	const html = await ejs.renderFile(templatePath, {
		name,
		email,
		otp: otpValue,
		expirationMinute: expiresSeconds / 60,
	});

	await transpost.sendMail({
		from: config.email_sender,
		to: email,
		subject: "Email Verification",
		html,
	});
};

// ─── Verify Patient Email ────────────────────────────────────────────────────

const verifyPatientEmail = async (payload: IVerifiEmailPayload) => {
	const otp = payload.otp;
	const email = payload.email.trim().toLowerCase();

	const isUserExist = await prisma.user.findUnique({ where: { email } });

	if (isUserExist?.status === UserStatus.BLOCKED) {
		throw new Error("User is blocked");
	}

	if (isUserExist?.emailVerified) {
		throw new Error("Email already verified");
	}

	if (isUserExist?.isDeleted || isUserExist?.status === UserStatus.DELETED) {
		throw new Error("User is deleted");
	}

	const otpkey = `patient-registration-otp:${email}`;
	const redisOtp = await redisClient.get(otpkey);

	if (!redisOtp) {
		throw new Error("OTP has expired or is invalid");
	}

	if (redisOtp !== otp) {
		throw new Error("OTP does not match");
	}

	await redisClient.del(otpkey);

	const registrationKey = `patient-registration-data:${email}`;
	const redisPatientData = await redisClient.get(registrationKey);

	if (!redisPatientData) {
		throw new Error("Registration data not found. Please register again.");
	}

	const patientPayload: IRegisterPatientPayload = JSON.parse(redisPatientData);

	const createdUser = await prisma.user.create({
		data: {
			name: patientPayload.name,
			email: patientPayload.email,
			password: patientPayload.password,
			role: Role.PATIENT,
			status: UserStatus.ACTIVE,
			emailVerified: true,
			patient: {
				create: {
					name: patientPayload.name,
					email: patientPayload.email,
					contactNumber: patientPayload?.patient?.contactNumber || "",
				},
			},
		},
		omit: { password: true },
		include: { patient: true },
	});

	await redisClient.del(registrationKey);

	// Send welcome email
	const welcomeTemplatePath = path.join(
		process.cwd(),
		"src/app/templates/patient-welcom.ejs",
	);
	const welcomeHtml = await ejs.renderFile(welcomeTemplatePath, {
		name: createdUser.name,
	});
	await transpost.sendMail({
		from: config.email_sender,
		to: email,
		subject: "Welcome to PH Healthcare System",
		html: welcomeHtml,
	});

	const { patient, ...user } = createdUser;

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const newRefreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return { user, patient, accessToken, refreshToken: newRefreshToken };
};

// ─── Login User ──────────────────────────────────────────────────────────────

const loginUser = async (payload: ILoginUserPayload) => {
	const { password } = payload;
	const email = payload.email.trim().toLowerCase();

	const user = await prisma.user.findUnique({
		 where: { email } 
		});

	if (!user) {
		// throw new Error("User not found");
		throw new AppError(httpStatus.NOT_FOUND, "User Not Found")
	}

	if (user.status === UserStatus.BLOCKED) {
		throw new Error("User is blocked");
	}

	if (user.isDeleted || user.status === UserStatus.DELETED) {
		throw new Error("User is deleted");
	}

	if (user.password === null && user.googleId !== null) {
		throw new Error(
			"This account is registered with Google. Please login with Google.",
		);
	}

	const isPasswordMatched = await bcrypt.compare(password, user.password as string);

	if (!isPasswordMatched) {
		throw new Error("Invalid credentials");
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const newRefreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return { accessToken, refreshToken: newRefreshToken };
};

// ─── Get Me ──────────────────────────────────────────────────────────────────

const getMe = async (user: IRequestUser) => {
	const isUserExists = await prisma.user.findUnique({
		where: { id: user.userId },
		include: { patient: true },
		omit: { password: true },
	});

	if (!isUserExists) {
		throw new Error("User not found");
	}

	return isUserExists;
};

// ─── Refresh Token ───────────────────────────────────────────────────────────

const refreshToken = async (token: string) => {
	const verifiedRefreshToken = jwtUtils.verifyToken(token, config.jwt_refresh_secret);

	if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
		throw new Error(
			config.node_env === "development"
				? verifiedRefreshToken.error
				: "Invalid refresh token",
		);
	}

	const data = verifiedRefreshToken.data as JwtPayload;

	const user = await prisma.user.findUnique({ where: { id: data.userId } });

	if (!user || user.isDeleted || user.status !== UserStatus.ACTIVE) {
		throw new Error("User is inactive or not found");
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const newRefreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return { accessToken, refreshToken: newRefreshToken };
};

// ─── Google Login ────────────────────────────────────────────────────────────

const googleLogin = async (payload: IGoogleLoginPayload) => {

	let googleIdTokenPayload: TokenPayload | null | undefined = null;

	try {
		const ticket = await googleClient.verifyIdToken({
			idToken: payload.idToken,
			audience: config.google_client_id,
		});
		googleIdTokenPayload = ticket.getPayload();
		
	} catch (error) {
		console.log("Google ID Token Verification Failed", error);
		throw new Error("Invalid or expired Google ID token");
	}

	if (!googleIdTokenPayload) {
		throw new Error("Invalid or expired Google ID token");
	}

	if (!googleIdTokenPayload.email) {
		throw new Error("Google email not found");
	}

	if (!googleIdTokenPayload.name) {
		throw new Error("Google user name not found");
	}

	const ifPatientExistWithGoogleAuth = await prisma.user.findUnique({
		where: {
			email: googleIdTokenPayload.email,
			role: Role.PATIENT,
			googleId: googleIdTokenPayload.sub,
		},
	});

	let user = ifPatientExistWithGoogleAuth;

	if (!ifPatientExistWithGoogleAuth) {
		const ifPatientExistWithCredentials = await prisma.user.findUnique({
			where: {
				email: googleIdTokenPayload.email,
				role: Role.PATIENT,
				authProvider: AuthProvider.CREDENTIAL,
			},
		});

		if (ifPatientExistWithCredentials) {
			if (!ifPatientExistWithCredentials.emailVerified) {
				throw new Error("Email not verified.");
			}

			if (ifPatientExistWithCredentials.status === UserStatus.BLOCKED) {
				throw new Error("User is blocked");
			}

			if (
				ifPatientExistWithCredentials.isDeleted ||
				ifPatientExistWithCredentials.status === UserStatus.DELETED
			) {
				throw new Error("User is deleted");
			}

			user = await prisma.user.update({
				where: { id: ifPatientExistWithCredentials.id },
				data: { googleId: googleIdTokenPayload.sub },
			});
		} else {
			// Google Register — create new user
			user = await prisma.user.create({
				data: {
					name: googleIdTokenPayload.name,
					email: googleIdTokenPayload.email,
					role: Role.PATIENT,
					googleId: googleIdTokenPayload.sub,
					authProvider: AuthProvider.GOOGLE,
					emailVerified: true,
					patient: {
						create: {
							name: googleIdTokenPayload.name,
							email: googleIdTokenPayload.email,
						},
					},
				},
			});

			// Send welcome email
			const welcomeTemplatePath = path.join(
				process.cwd(),
				"src/app/templates/patient-welcom.ejs",
			);
			const welcomeHtml = await ejs.renderFile(welcomeTemplatePath, {
				name: user.name,
			});
			await transpost.sendMail({
				from: config.email_sender,
				to: user.email,
				subject: "Welcome to PH Healthcare System",
				html: welcomeHtml,
			});
		}
	}

	if (!user) {
		throw new Error("User not found");
	}

	if (user.status === UserStatus.BLOCKED) {
		throw new Error("User is blocked");
	}

	if (user.isDeleted || user.status === UserStatus.DELETED) {
		throw new Error("User is deleted");
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const newRefreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return { accessToken, refreshToken: newRefreshToken };
};

// ─── Forgot Password ─────────────────────────────────────────────────────────

const forgotPassword = async (payload: IForgotPasswordPayload) => {
	const { email } = payload;

	const user = await prisma.user.findUnique({ where: { email } });

	if (!user) {
		throw new Error("User does not exist");
	}

	if (user.status === UserStatus.BLOCKED) {
		throw new Error("User is blocked");
	}

	if (user.isDeleted || user.status === UserStatus.DELETED) {
		throw new Error("User is deleted");
	}

	if (!user.emailVerified) {
		throw new Error("User email is not verified");
	}

	if (user.googleId && user.authProvider === AuthProvider.GOOGLE) {
		throw new Error("This account uses Google login. Password reset is not available.");
	}

	const otp = crypto.randomInt(100000, 1000000).toString();
	const key = `forgot-password-otp:${user.email}`;
	const expiresSeconds = 5 * 60;

	await redisClient.set(key, otp, {
		expiration: { type: "EX", value: expiresSeconds },
	});

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/forgot-password.ejs",
	);
	const html = await ejs.renderFile(templatePath, {
		name: user.name || user.email,
		otp,
		expirationMinute: expiresSeconds / 60,
	});

	await transpost.sendMail({
		from: config.email_sender,
		to: user.email,
		subject: "Forgot Password",
		html,
	});
};

// ─── Reset Password ──────────────────────────────────────────────────────────

const resetPassword = async (payload: IResetPasswordPayload) => {
	const { email, otp, newPassword } = payload;

	const user = await prisma.user.findUnique({ where: { email } });

	if (!user) {
		throw new Error("User does not exist");
	}

	if (user.status === UserStatus.BLOCKED) {
		throw new Error("User is blocked");
	}

	if (user.isDeleted || user.status === UserStatus.DELETED) {
		throw new Error("User is deleted");
	}

	if (!user.emailVerified) {
		throw new Error("User email is not verified");
	}

	if (user.googleId && user.authProvider === AuthProvider.GOOGLE) {
		throw new Error("This account uses Google login. Password reset is not available.");
	}

	const key = `forgot-password-otp:${user.email}`;
	const redisOtp = await redisClient.get(key);

	if (!redisOtp) {
		throw new Error("OTP has expired or is invalid");
	}

	if (redisOtp !== otp) {
		throw new Error("OTP does not match");
	}

	const hashedNewPassword = await bcrypt.hash(
		newPassword,
		Number(config.bcrypt_salt_rounds),
	);

	await prisma.user.update({
		where: { email: user.email },
		data: { password: hashedNewPassword },
	});

	await redisClient.del([key]);

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/resed-password.ejs",
	);
	const html = await ejs.renderFile(templatePath, {
		name: user.name || user.email,
	});

	await transpost.sendMail({
		from: config.email_sender,
		to: user.email,
		subject: "Password Changed Successfully",
		html,
	});
};

// ─── Exports ─────────────────────────────────────────────────────────────────

export const AuthService = {
	registerPatient,
	verifyPatientEmail,
	loginUser,
	getMe,
	refreshToken,
	googleLogin,
	forgotPassword,
	resetPassword,
};

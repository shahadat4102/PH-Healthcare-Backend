import bcrypt from "bcryptjs";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import { AuthProvider, Role, UserStatus } from "../../../generated/prisma/enums.js";
import config from "../../config/index.js";
import { prisma } from "../../lib/prisma.js";
import { jwtUtils } from "../../utils/jwt.js";
import type {
	IForgotPasswordPayload,
	IGoogleLoginPayload,
	ILoginUserPayload,
	IRegisterUserPayload,
	IRequestUser,
	IResetPasswordPayload,
	IVerifiEmailPayload,
} from "./auth.interface.js";
import type { TokenPayload } from "google-auth-library";
import { googleClient } from "../../lib/googleAuth.js";
import crypto from "crypto";
import { redisClient } from "../../lib/redis.js";
import { transpost } from "../../lib/nodemailer.js";
import ejs from "ejs";
import path from "path";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError.js";

// ─── Register User ────────────────────────────────────────────────────────────

const registerUser = async (payload: IRegisterUserPayload) => {
	const { name, password } = payload;
	const email = payload.email.trim().toLowerCase();

	const isUserExists = await prisma.user.findUnique({ where: { email } });

	if (isUserExists) {
		throw new Error("User with this email already exists");
	}

	const hashedPassword = await bcrypt.hash(password, Number(config.bcrypt_salt_rounds));

	const expiresSeconds = 5 * 60;

	const otpkey = `user-registration-otp:${email}`;
	const otpValue = crypto.randomInt(100000, 1000000).toString();

	await redisClient.set(otpkey, otpValue, {
		expiration: {
			type: "EX",
			value: expiresSeconds,
		},
	});

	const registrationKey = `user-registration-data:${email}`;
	const redisUserDataPayload = {
		name,
		email,
		password: hashedPassword,
	};

	await redisClient.set(registrationKey, JSON.stringify(redisUserDataPayload), {
		expiration: {
			type: "EX",
			value: expiresSeconds,
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

// ─── Verify User Email ────────────────────────────────────────────────────────

const verifyUserEmail = async (payload: IVerifiEmailPayload) => {
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

	const otpkey = `user-registration-otp:${email}`;
	const redisOtp = await redisClient.get(otpkey);

	if (!redisOtp) {
		throw new Error("OTP has expired or is invalid");
	}

	if (redisOtp !== otp) {
		throw new Error("OTP does not match");
	}

	await redisClient.del(otpkey);

	const registrationKey = `user-registration-data:${email}`;
	const redisUserData = await redisClient.get(registrationKey);

	if (!redisUserData) {
		throw new Error("Registration data not found. Please register again.");
	}

	const userPayload: IRegisterUserPayload = JSON.parse(redisUserData);

	const createdUser = await prisma.user.create({
		data: {
			name: userPayload.name,
			email: userPayload.email,
			password: userPayload.password,
			role: Role.MEMBER,
			status: UserStatus.ACTIVE,
			emailVerified: true,
		},
		omit: { password: true },
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
		subject: "Welcome to ProjectHub",
		html: welcomeHtml,
	});

	const jwtPayload = {
		userId: createdUser.id,
		name: createdUser.name,
		email: createdUser.email,
		role: createdUser.role,
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

	return { user: createdUser, accessToken, refreshToken: newRefreshToken };
};

// ─── Login User ──────────────────────────────────────────────────────────────

const loginUser = async (payload: ILoginUserPayload) => {
	const { password } = payload;
	const email = payload.email.trim().toLowerCase();

	const user = await prisma.user.findUnique({ where: { email } });

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User Not Found");
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

	// Check by email only (not role-filtered) in findUnique
	const existingUser = await prisma.user.findUnique({
		where: { email: googleIdTokenPayload.email },
	});

	let user = existingUser;

	if (!existingUser) {
		// Google Register — create new user
		user = await prisma.user.create({
			data: {
				name: googleIdTokenPayload.name,
				email: googleIdTokenPayload.email,
				role: Role.MEMBER,
				googleId: googleIdTokenPayload.sub,
				authProvider: AuthProvider.GOOGLE,
				emailVerified: true,
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
			subject: "Welcome to ProjectHub",
			html: welcomeHtml,
		});
	} else {
		// Existing user — link googleId if not already linked
		if (existingUser.authProvider === AuthProvider.CREDENTIAL && !existingUser.googleId) {
			if (!existingUser.emailVerified) {
				throw new Error("Email not verified.");
			}
			if (existingUser.status === UserStatus.BLOCKED) {
				throw new Error("User is blocked");
			}
			if (existingUser.isDeleted || existingUser.status === UserStatus.DELETED) {
				throw new Error("User is deleted");
			}
			user = await prisma.user.update({
				where: { id: existingUser.id },
				data: { googleId: googleIdTokenPayload.sub },
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
	registerUser,
	verifyUserEmail,
	loginUser,
	getMe,
	refreshToken,
	googleLogin,
	forgotPassword,
	resetPassword,
};

import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import type { IRequestUser } from "./auth.interface.js";
import { AuthService } from "./auth.service.js";

const registerUser = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	await AuthService.registerUser(payload);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Verification OTP sent to your email",
		data: null,
	});
});

const verifyUserEmail = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const result = await AuthService.verifyUserEmail(payload);
	const { accessToken, refreshToken, user } = result;

	res.cookie("accessToken", accessToken, {
		httpOnly: true,
		secure: false,
		sameSite: "none",
		maxAge: 1000 * 60 * 60 * 24, // 24 hours
	});
	res.cookie("refreshToken", refreshToken, {
		httpOnly: true,
		secure: false,
		sameSite: "none",
		maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Email verified successfully",
		data: { accessToken, refreshToken, user },
	});
});

const loginUser = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const result = await AuthService.loginUser(payload);
	const { accessToken, refreshToken } = result;

	res.cookie("accessToken", accessToken, {
		httpOnly: true,
		secure: false,
		sameSite: "none",
		maxAge: 1000 * 60 * 60 * 24,
	});
	res.cookie("refreshToken", refreshToken, {
		httpOnly: true,
		secure: false,
		sameSite: "none",
		maxAge: 1000 * 60 * 60 * 24 * 7,
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User logged in successfully",
		data: { accessToken, refreshToken },
	});
});

const getMe = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as unknown as IRequestUser;

	if (!user) {
		throw new Error("User information is missing in the request");
	}

	const result = await AuthService.getMe(user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User profile fetched successfully",
		data: result,
	});
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
	if (!req.cookies.refreshToken) {
		throw new Error("Refresh token is missing");
	}

	const result = await AuthService.refreshToken(req.cookies.refreshToken);
	const { accessToken, refreshToken: newRefreshToken } = result;

	res.cookie("accessToken", accessToken, {
		httpOnly: true,
		secure: false,
		sameSite: "none",
		maxAge: 1000 * 60 * 60 * 24,
	});
	res.cookie("refreshToken", newRefreshToken, {
		httpOnly: true,
		secure: false,
		sameSite: "none",
		maxAge: 1000 * 60 * 60 * 24 * 7,
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Token refreshed successfully",
		data: { accessToken, refreshToken: newRefreshToken },
	});
});

const googleLogin = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const result = await AuthService.googleLogin(payload);
	const { accessToken, refreshToken } = result;

	res.cookie("accessToken", accessToken, {
		httpOnly: true,
		secure: false,
		sameSite: "none",
		maxAge: 1000 * 60 * 60 * 24,
	});
	res.cookie("refreshToken", refreshToken, {
		httpOnly: true,
		secure: false,
		sameSite: "none",
		maxAge: 1000 * 60 * 60 * 24 * 7,
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Logged in with Google successfully",
		data: { accessToken, refreshToken },
	});
});

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	await AuthService.forgotPassword(payload);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: `OTP sent to email: ${payload.email}`,
		data: null,
	});
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	await AuthService.resetPassword(payload);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Password changed successfully",
		data: null,
	});
});

export const AuthController = {
	registerUser,
	verifyUserEmail,
	loginUser,
	getMe,
	refreshToken,
	googleLogin,
	forgotPassword,
	resetPassword,
};

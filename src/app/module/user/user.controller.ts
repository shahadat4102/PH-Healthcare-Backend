
import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import httpStatus from "http-status";
import { userService } from "./user.service.js";

const UploadProfileImage = catchAsync(async (req: Request, res: Response) => {
	if (!req.file) {
		throw new Error("No file provided");
	}

	const userId = req.user?.userId;

	const result = await userService.UploadProfileImage(req.file?.buffer, userId!);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Profile image updated successfully",
		data: result,
	});
});

const getUserProfile = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId!;
	const result = await userService.getUserProfile(userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User profile fetched successfully",
		data: result,
	});
});

const updateUserProfile = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId!;
	const result = await userService.updateUserProfile(userId, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User profile updated successfully",
		data: result,
	});
});

export const userController = {
	UploadProfileImage,
	getUserProfile,
	updateUserProfile,
};

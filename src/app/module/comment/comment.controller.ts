import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { Role } from "../../../generated/prisma/enums.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { CommentService } from "./comment.service.js";

const createComment = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const result = await CommentService.createComment(req.body, userId);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Comment created successfully",
		data: result,
	});
});

const getTaskComments = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const taskId = req.params.taskId as string;
	const result = await CommentService.getTaskComments(taskId, userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Comments fetched successfully",
		data: result,
	});
});

const updateComment = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const commentId = req.params.commentId as string;
	const { content } = req.body;
	const result = await CommentService.updateComment(commentId, content, userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Comment updated successfully",
		data: result,
	});
});

const deleteComment = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const userRole = req.user!.role as Role;
	const commentId = req.params.commentId as string;
	await CommentService.deleteComment(commentId, userId, userRole);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Comment deleted successfully",
		data: null,
	});
});

export const CommentController = {
	createComment,
	getTaskComments,
	updateComment,
	deleteComment,
};

import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { TaskPriority, TaskStatus } from "../../../generated/prisma/enums.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { TaskService } from "./task.service.js";

const createTask = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const result = await TaskService.createTask(req.body, userId);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Task created successfully",
		data: result,
	});
});

const getTasks = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const { projectId, status, assigneeId, priority, page, limit, sortBy, sortOrder, search } =
		req.query as Record<string, string>;

	const result = await TaskService.getTasks(
		{
			projectId,
			status: status as TaskStatus | undefined,
			assigneeId,
			priority: priority as TaskPriority | undefined,
			page: page ? Number(page) : undefined,
			limit: limit ? Number(limit) : undefined,
			sortBy,
			sortOrder: sortOrder as "asc" | "desc" | undefined,
			search,
		},
		userId,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Tasks fetched successfully",
		data: result.data,
		meta: result.meta,
	});
});

const getMyTasks = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const result = await TaskService.getMyTasks(userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Your assigned tasks fetched successfully",
		data: result,
	});
});

const getSingleTask = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const id = req.params.id as string;
	const result = await TaskService.getSingleTask(id, userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Task fetched successfully",
		data: result,
	});
});

const updateTask = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const id = req.params.id as string;
	const result = await TaskService.updateTask(id, req.body, userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Task updated successfully",
		data: result,
	});
});

const deleteTask = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const id = req.params.id as string;
	await TaskService.deleteTask(id, userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Task deleted successfully",
		data: null,
	});
});

const changeTaskStatus = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const id = req.params.id as string;
	const { status } = req.body;
	const result = await TaskService.changeTaskStatus(id, status, userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Task status changed successfully",
		data: result,
	});
});

const assignTask = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const id = req.params.id as string;
	const { assigneeId } = req.body;
	const result = await TaskService.assignTask(id, assigneeId, userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Task assigned successfully",
		data: result,
	});
});

export const TaskController = {
	createTask,
	getTasks,
	getMyTasks,
	getSingleTask,
	updateTask,
	deleteTask,
	changeTaskStatus,
	assignTask,
};

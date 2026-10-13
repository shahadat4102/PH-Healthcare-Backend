import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { ProjectStatus } from "../../../generated/prisma/enums.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { ProjectService } from "./project.service.js";

const createProject = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const result = await ProjectService.createProject(req.body, userId);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Project created successfully",
		data: result,
	});
});

const getProjects = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const { orgId, status, page, limit, sortBy, sortOrder } = req.query as Record<string, string>;

	const result = await ProjectService.getProjects(
		{
			orgId,
			status: status as ProjectStatus | undefined,
			page: page ? Number(page) : undefined,
			limit: limit ? Number(limit) : undefined,
			sortBy,
			sortOrder: sortOrder as "asc" | "desc" | undefined,
		},
		userId,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Projects fetched successfully",
		data: result.data,
		meta: result.meta,
	});
});

const getSingleProject = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const id = req.params.id as string;
	const result = await ProjectService.getSingleProject(id, userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Project fetched successfully",
		data: result,
	});
});

const updateProject = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const id = req.params.id as string;
	const result = await ProjectService.updateProject(id, req.body, userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Project updated successfully",
		data: result,
	});
});

const deleteProject = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const id = req.params.id as string;
	await ProjectService.deleteProject(id, userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Project deleted successfully",
		data: null,
	});
});

const changeProjectStatus = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const id = req.params.id as string;
	const { status } = req.body;
	const result = await ProjectService.changeProjectStatus(id, status, userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Project status changed successfully",
		data: result,
	});
});

export const ProjectController = {
	createProject,
	getProjects,
	getSingleProject,
	updateProject,
	deleteProject,
	changeProjectStatus,
};

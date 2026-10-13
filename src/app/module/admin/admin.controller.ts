import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { UserStatus } from "../../../generated/prisma/enums.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { AdminService } from "./admin.service.js";

const getAllUsers = catchAsync(async (req: Request, res: Response) => {
	const { page, limit, status, role, search } = req.query as Record<string, string>;

	const result = await AdminService.getAllUsers({
		page: page ? Number(page) : undefined,
		limit: limit ? Number(limit) : undefined,
		status: status as UserStatus | undefined,
		role,
		search,
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Users fetched successfully",
		data: result.data,
		meta: result.meta,
	});
});

const updateUserStatus = catchAsync(async (req: Request, res: Response) => {
	const requestingUserId = req.user!.userId;
	const id = req.params.id as string;
	const { status } = req.body;

	const result = await AdminService.updateUserStatus(id, status, requestingUserId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User status updated successfully",
		data: result,
	});
});

const getDashboardStats = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.getDashboardStats();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Dashboard stats fetched successfully",
		data: result,
	});
});

const getAuditLogs = catchAsync(async (req: Request, res: Response) => {
	const { page, limit, organizationId, userId, entityType } = req.query as Record<string, string>;

	const result = await AdminService.getAuditLogs({
		page: page ? Number(page) : undefined,
		limit: limit ? Number(limit) : undefined,
		organizationId,
		userId,
		entityType,
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Audit logs fetched successfully",
		data: result.data,
		meta: result.meta,
	});
});

export const AdminController = {
	getAllUsers,
	updateUserStatus,
	getDashboardStats,
	getAuditLogs,
};

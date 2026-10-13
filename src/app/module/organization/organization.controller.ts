import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { OrganizationService } from "./organization.service.js";

const createOrganization = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const result = await OrganizationService.createOrganization(req.body, userId);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Organization created successfully",
		data: result,
	});
});

const getMyOrganizations = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const result = await OrganizationService.getMyOrganizations(userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Organizations fetched successfully",
		data: result,
	});
});

const getSingleOrganization = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const id = req.params.id as string;
	const result = await OrganizationService.getSingleOrganization(id, userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Organization fetched successfully",
		data: result,
	});
});

const updateOrganization = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const id = req.params.id as string;
	const result = await OrganizationService.updateOrganization(id, req.body, userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Organization updated successfully",
		data: result,
	});
});

const deleteOrganization = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const id = req.params.id as string;
	await OrganizationService.deleteOrganization(id, userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Organization deleted successfully",
		data: null,
	});
});

const addMember = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const id = req.params.id as string;
	const result = await OrganizationService.addMember(id, req.body, userId);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Member added successfully",
		data: result,
	});
});

const removeMember = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const id = req.params.id as string;
	const memberId = req.params.memberId as string;
	await OrganizationService.removeMember(id, memberId, userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Member removed successfully",
		data: null,
	});
});

const getOrgMembers = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const id = req.params.id as string;
	const result = await OrganizationService.getOrgMembers(id, userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Members fetched successfully",
		data: result,
	});
});

export const OrganizationController = {
	createOrganization,
	getMyOrganizations,
	getSingleOrganization,
	updateOrganization,
	deleteOrganization,
	addMember,
	removeMember,
	getOrgMembers,
};

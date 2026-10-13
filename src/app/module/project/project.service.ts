import httpStatus from "http-status";
import { ActivityAction, ProjectStatus, Role } from "../../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { createActivityLog } from "../../utils/activityLog.js";

interface ICreateProjectPayload {
	name: string;
	description?: string;
	organizationId: string;
	deadline?: string;
}

interface IUpdateProjectPayload {
	name?: string;
	description?: string;
	deadline?: string;
}

interface IProjectQuery {
	orgId?: string;
	status?: ProjectStatus;
	page?: number;
	limit?: number;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}

const createProject = async (payload: ICreateProjectPayload, userId: string) => {
	const { organizationId } = payload;

	// Check user is a MANAGER member of the org
	const membership = await prisma.organizationMember.findFirst({
		where: { organizationId, userId, role: Role.MANAGER },
	});

	if (!membership) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Only managers of this organization can create projects",
		);
	}

	// Check subscription / free plan limit
	const subscription = await prisma.subscription.findFirst({
		where: { organizationId, isActive: true, plan: "PRO" },
	});

	if (!subscription) {
		const projectCount = await prisma.project.count({
			where: { organizationId, isDeleted: false },
		});

		if (projectCount >= 2) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"FREE plan allows max 2 projects. Upgrade to PRO.",
			);
		}
	}

	const project = await prisma.project.create({
		data: {
			name: payload.name,
			description: payload.description,
			organizationId,
			deadline: payload.deadline ? new Date(payload.deadline) : undefined,
		},
	});

	await createActivityLog({
		action: ActivityAction.CREATED,
		entityType: "PROJECT",
		entityId: project.id,
		userId,
		organizationId,
		projectId: project.id,
	});

	return project;
};

const getProjects = async (query: IProjectQuery, userId: string) => {
	const {
		orgId,
		status,
		page = 1,
		limit = 10,
		sortBy = "createdAt",
		sortOrder = "desc",
	} = query;

	const where: Record<string, unknown> = { isDeleted: false };

	if (orgId) {
		// Verify membership
		const membership = await prisma.organizationMember.findFirst({
			where: { organizationId: orgId, userId },
		});

		if (!membership) {
			throw new AppError(httpStatus.FORBIDDEN, "You are not a member of this organization");
		}

		where.organizationId = orgId;
	}

	if (status) {
		where.status = status;
	}

	const skip = (page - 1) * limit;

	const [data, total] = await Promise.all([
		prisma.project.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
			include: {
				_count: { select: { tasks: true } },
			},
		}),
		prisma.project.count({ where }),
	]);

	return {
		data,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const getSingleProject = async (projectId: string, userId: string) => {
	const project = await prisma.project.findFirst({
		where: { id: projectId, isDeleted: false },
		include: {
			_count: { select: { tasks: true } },
		},
	});

	if (!project) {
		throw new AppError(httpStatus.NOT_FOUND, "Project not found");
	}

	// Verify membership
	const membership = await prisma.organizationMember.findFirst({
		where: { organizationId: project.organizationId, userId },
	});

	if (!membership) {
		throw new AppError(httpStatus.FORBIDDEN, "You are not a member of this organization");
	}

	return project;
};

const updateProject = async (
	projectId: string,
	payload: IUpdateProjectPayload,
	userId: string,
) => {
	const project = await prisma.project.findFirst({
		where: { id: projectId, isDeleted: false },
	});

	if (!project) {
		throw new AppError(httpStatus.NOT_FOUND, "Project not found");
	}

	const membership = await prisma.organizationMember.findFirst({
		where: { organizationId: project.organizationId, userId, role: Role.MANAGER },
	});

	if (!membership) {
		throw new AppError(httpStatus.FORBIDDEN, "Only managers can update projects");
	}

	const updated = await prisma.project.update({
		where: { id: projectId },
		data: {
			...payload,
			deadline: payload.deadline ? new Date(payload.deadline) : undefined,
		},
	});

	await createActivityLog({
		action: ActivityAction.UPDATED,
		entityType: "PROJECT",
		entityId: projectId,
		userId,
		organizationId: project.organizationId,
		projectId,
	});

	return updated;
};

const deleteProject = async (projectId: string, userId: string) => {
	const project = await prisma.project.findFirst({
		where: { id: projectId, isDeleted: false },
	});

	if (!project) {
		throw new AppError(httpStatus.NOT_FOUND, "Project not found");
	}

	const membership = await prisma.organizationMember.findFirst({
		where: { organizationId: project.organizationId, userId, role: Role.MANAGER },
	});

	if (!membership) {
		throw new AppError(httpStatus.FORBIDDEN, "Only managers can delete projects");
	}

	await prisma.project.update({
		where: { id: projectId },
		data: { isDeleted: true, deletedAt: new Date() },
	});

	await createActivityLog({
		action: ActivityAction.DELETED,
		entityType: "PROJECT",
		entityId: projectId,
		userId,
		organizationId: project.organizationId,
		projectId,
	});
};

const changeProjectStatus = async (
	projectId: string,
	status: ProjectStatus,
	userId: string,
) => {
	const project = await prisma.project.findFirst({
		where: { id: projectId, isDeleted: false },
	});

	if (!project) {
		throw new AppError(httpStatus.NOT_FOUND, "Project not found");
	}

	const membership = await prisma.organizationMember.findFirst({
		where: { organizationId: project.organizationId, userId, role: Role.MANAGER },
	});

	if (!membership) {
		throw new AppError(httpStatus.FORBIDDEN, "Only managers can change project status");
	}

	const updated = await prisma.project.update({
		where: { id: projectId },
		data: { status },
	});

	await createActivityLog({
		action: ActivityAction.STATUS_CHANGED,
		entityType: "PROJECT",
		entityId: projectId,
		userId,
		organizationId: project.organizationId,
		projectId,
		details: { oldStatus: project.status, newStatus: status },
	});

	return updated;
};

export const ProjectService = {
	createProject,
	getProjects,
	getSingleProject,
	updateProject,
	deleteProject,
	changeProjectStatus,
};

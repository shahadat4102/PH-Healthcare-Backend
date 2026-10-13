import httpStatus from "http-status";
import { ActivityAction, Role, TaskPriority, TaskStatus } from "../../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { createActivityLog } from "../../utils/activityLog.js";

interface ICreateTaskPayload {
	title: string;
	description?: string;
	projectId: string;
	priority?: TaskPriority;
	dueDate?: string;
	assigneeId?: string;
}

interface IUpdateTaskPayload {
	title?: string;
	description?: string;
	priority?: TaskPriority;
	dueDate?: string;
}

interface ITaskQuery {
	projectId?: string;
	status?: TaskStatus;
	assigneeId?: string;
	priority?: TaskPriority;
	page?: number;
	limit?: number;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
	search?: string;
}

const createTask = async (payload: ICreateTaskPayload, userId: string) => {
	const { projectId } = payload;

	const project = await prisma.project.findFirst({
		where: { id: projectId, isDeleted: false },
	});

	if (!project) {
		throw new AppError(httpStatus.NOT_FOUND, "Project not found");
	}

	// Check user is a MANAGER of the org
	const membership = await prisma.organizationMember.findFirst({
		where: { organizationId: project.organizationId, userId, role: Role.MANAGER },
	});

	if (!membership) {
		throw new AppError(httpStatus.FORBIDDEN, "Only managers can create tasks");
	}

	// If assignee provided, verify they are org member
	if (payload.assigneeId) {
		const assigneeMembership = await prisma.organizationMember.findFirst({
			where: { organizationId: project.organizationId, userId: payload.assigneeId },
		});

		if (!assigneeMembership) {
			throw new AppError(httpStatus.BAD_REQUEST, "Assignee is not a member of this organization");
		}
	}

	const task = await prisma.task.create({
		data: {
			title: payload.title,
			description: payload.description,
			projectId,
			creatorId: userId,
			priority: payload.priority,
			dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
			assigneeId: payload.assigneeId,
		},
	});

	await createActivityLog({
		action: ActivityAction.CREATED,
		entityType: "TASK",
		entityId: task.id,
		userId,
		organizationId: project.organizationId,
		projectId,
		taskId: task.id,
	});

	return task;
};

const getTasks = async (query: ITaskQuery, userId: string) => {
	const {
		projectId,
		status,
		assigneeId,
		priority,
		page = 1,
		limit = 10,
		sortBy = "createdAt",
		sortOrder = "desc",
		search,
	} = query;

	const where: Record<string, unknown> = { isDeleted: false };

	if (projectId) {
		const project = await prisma.project.findFirst({
			where: { id: projectId, isDeleted: false },
		});

		if (!project) {
			throw new AppError(httpStatus.NOT_FOUND, "Project not found");
		}

		const membership = await prisma.organizationMember.findFirst({
			where: { organizationId: project.organizationId, userId },
		});

		if (!membership) {
			throw new AppError(httpStatus.FORBIDDEN, "You are not a member of this organization");
		}

		where.projectId = projectId;
	}

	if (status) where.status = status;
	if (assigneeId) where.assigneeId = assigneeId;
	if (priority) where.priority = priority;

	if (search) {
		where.title = { contains: search, mode: "insensitive" };
	}

	const skip = (page - 1) * limit;

	const [data, total] = await Promise.all([
		prisma.task.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
			include: {
				assignee: { select: { id: true, name: true, email: true, imageUrl: true } },
				creator: { select: { id: true, name: true, email: true } },
			},
		}),
		prisma.task.count({ where }),
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

const getMyTasks = async (userId: string) => {
	const tasks = await prisma.task.findMany({
		where: { assigneeId: userId, isDeleted: false },
		include: {
			project: { select: { id: true, name: true } },
		},
		orderBy: { createdAt: "desc" },
	});

	return tasks;
};

const getSingleTask = async (taskId: string, userId: string) => {
	const task = await prisma.task.findFirst({
		where: { id: taskId, isDeleted: false },
		include: {
			project: { select: { id: true, name: true, organizationId: true } },
			assignee: { select: { id: true, name: true, email: true, imageUrl: true } },
			creator: { select: { id: true, name: true, email: true } },
			comments: {
				where: { isDeleted: false },
				include: {
					author: { select: { id: true, name: true, imageUrl: true } },
				},
				orderBy: { createdAt: "asc" },
			},
		},
	});

	if (!task) {
		throw new AppError(httpStatus.NOT_FOUND, "Task not found");
	}

	return task;
};

const updateTask = async (
	taskId: string,
	payload: IUpdateTaskPayload,
	userId: string,
) => {
	const task = await prisma.task.findFirst({
		where: { id: taskId, isDeleted: false },
		include: { project: true },
	});

	if (!task) {
		throw new AppError(httpStatus.NOT_FOUND, "Task not found");
	}

	const membership = await prisma.organizationMember.findFirst({
		where: { organizationId: task.project.organizationId, userId, role: Role.MANAGER },
	});

	if (!membership) {
		throw new AppError(httpStatus.FORBIDDEN, "Only managers can update tasks");
	}

	const updated = await prisma.task.update({
		where: { id: taskId },
		data: {
			...payload,
			dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
		},
	});

	await createActivityLog({
		action: ActivityAction.UPDATED,
		entityType: "TASK",
		entityId: taskId,
		userId,
		organizationId: task.project.organizationId,
		projectId: task.projectId,
		taskId,
	});

	return updated;
};

const deleteTask = async (taskId: string, userId: string) => {
	const task = await prisma.task.findFirst({
		where: { id: taskId, isDeleted: false },
		include: { project: true },
	});

	if (!task) {
		throw new AppError(httpStatus.NOT_FOUND, "Task not found");
	}

	const membership = await prisma.organizationMember.findFirst({
		where: { organizationId: task.project.organizationId, userId, role: Role.MANAGER },
	});

	if (!membership) {
		throw new AppError(httpStatus.FORBIDDEN, "Only managers can delete tasks");
	}

	await prisma.task.update({
		where: { id: taskId },
		data: { isDeleted: true, deletedAt: new Date() },
	});

	await createActivityLog({
		action: ActivityAction.DELETED,
		entityType: "TASK",
		entityId: taskId,
		userId,
		organizationId: task.project.organizationId,
		projectId: task.projectId,
		taskId,
	});
};

const changeTaskStatus = async (
	taskId: string,
	status: TaskStatus,
	userId: string,
) => {
	const task = await prisma.task.findFirst({
		where: { id: taskId, isDeleted: false },
		include: { project: true },
	});

	if (!task) {
		throw new AppError(httpStatus.NOT_FOUND, "Task not found");
	}

	// MANAGER or the assigned MEMBER can change status
	const isManager = await prisma.organizationMember.findFirst({
		where: { organizationId: task.project.organizationId, userId, role: Role.MANAGER },
	});

	const isAssignee = task.assigneeId === userId;

	if (!isManager && !isAssignee) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Only the task assignee or a manager can change task status",
		);
	}

	const updated = await prisma.$transaction(async (tx) => {
		return tx.task.update({
			where: { id: taskId },
			data: { status },
		});
	});

	await createActivityLog({
		action: ActivityAction.STATUS_CHANGED,
		entityType: "TASK",
		entityId: taskId,
		userId,
		organizationId: task.project.organizationId,
		projectId: task.projectId,
		taskId,
		details: { oldStatus: task.status, newStatus: status },
	});

	return updated;
};

const assignTask = async (
	taskId: string,
	assigneeId: string,
	userId: string,
) => {
	const task = await prisma.task.findFirst({
		where: { id: taskId, isDeleted: false },
		include: { project: true },
	});

	if (!task) {
		throw new AppError(httpStatus.NOT_FOUND, "Task not found");
	}

	const membership = await prisma.organizationMember.findFirst({
		where: { organizationId: task.project.organizationId, userId, role: Role.MANAGER },
	});

	if (!membership) {
		throw new AppError(httpStatus.FORBIDDEN, "Only managers can assign tasks");
	}

	// Verify assignee is org member
	const assigneeMembership = await prisma.organizationMember.findFirst({
		where: { organizationId: task.project.organizationId, userId: assigneeId },
	});

	if (!assigneeMembership) {
		throw new AppError(httpStatus.BAD_REQUEST, "Assignee is not a member of this organization");
	}

	const updated = await prisma.task.update({
		where: { id: taskId },
		data: { assigneeId },
	});

	await createActivityLog({
		action: ActivityAction.ASSIGNED,
		entityType: "TASK",
		entityId: taskId,
		userId,
		organizationId: task.project.organizationId,
		projectId: task.projectId,
		taskId,
		details: { assigneeId },
	});

	return updated;
};

export const TaskService = {
	createTask,
	getTasks,
	getMyTasks,
	getSingleTask,
	updateTask,
	deleteTask,
	changeTaskStatus,
	assignTask,
};

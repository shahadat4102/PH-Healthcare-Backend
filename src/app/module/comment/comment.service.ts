import httpStatus from "http-status";
import { ActivityAction, Role } from "../../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { createActivityLog } from "../../utils/activityLog.js";

const createComment = async (
	payload: { content: string; taskId: string },
	userId: string,
) => {
	const task = await prisma.task.findFirst({
		where: { id: payload.taskId, isDeleted: false },
		include: { project: true },
	});

	if (!task) {
		throw new AppError(httpStatus.NOT_FOUND, "Task not found");
	}

	const comment = await prisma.comment.create({
		data: {
			content: payload.content,
			taskId: payload.taskId,
			authorId: userId,
		},
		include: {
			author: { select: { id: true, name: true, imageUrl: true } },
		},
	});

	await createActivityLog({
		action: ActivityAction.COMMENTED,
		entityType: "COMMENT",
		entityId: comment.id,
		userId,
		organizationId: task.project.organizationId,
		projectId: task.projectId,
		taskId: task.id,
	});

	return comment;
};

const getTaskComments = async (taskId: string, userId: string) => {
	const task = await prisma.task.findFirst({
		where: { id: taskId, isDeleted: false },
		include: { project: true },
	});

	if (!task) {
		throw new AppError(httpStatus.NOT_FOUND, "Task not found");
	}

	const comments = await prisma.comment.findMany({
		where: { taskId, isDeleted: false },
		include: {
			author: { select: { id: true, name: true, imageUrl: true } },
		},
		orderBy: { createdAt: "asc" },
	});

	return comments;
};

const updateComment = async (
	commentId: string,
	content: string,
	userId: string,
) => {
	const comment = await prisma.comment.findFirst({
		where: { id: commentId, isDeleted: false },
	});

	if (!comment) {
		throw new AppError(httpStatus.NOT_FOUND, "Comment not found");
	}

	if (comment.authorId !== userId) {
		throw new AppError(httpStatus.FORBIDDEN, "Only the author can edit this comment");
	}

	const updated = await prisma.comment.update({
		where: { id: commentId },
		data: { content },
		include: {
			author: { select: { id: true, name: true, imageUrl: true } },
		},
	});

	return updated;
};

const deleteComment = async (
	commentId: string,
	userId: string,
	userRole: Role,
) => {
	const comment = await prisma.comment.findFirst({
		where: { id: commentId, isDeleted: false },
		include: {
			task: { include: { project: true } },
		},
	});

	if (!comment) {
		throw new AppError(httpStatus.NOT_FOUND, "Comment not found");
	}

	if (userRole === Role.MEMBER && comment.authorId !== userId) {
		throw new AppError(httpStatus.FORBIDDEN, "You can only delete your own comments");
	}

	await prisma.comment.update({
		where: { id: commentId },
		data: { isDeleted: true, deletedAt: new Date() },
	});

	await createActivityLog({
		action: ActivityAction.DELETED,
		entityType: "COMMENT",
		entityId: commentId,
		userId,
		organizationId: comment.task.project.organizationId,
		projectId: comment.task.projectId,
		taskId: comment.taskId,
	});
};

export const CommentService = {
	createComment,
	getTaskComments,
	updateComment,
	deleteComment,
};

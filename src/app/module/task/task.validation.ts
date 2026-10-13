import z from "zod";
import { TaskPriority, TaskStatus } from "../../../generated/prisma/enums.js";

const createTaskSchema = z.object({
	title: z.string().min(1, "Title is required").max(200),
	description: z.string().optional(),
	projectId: z.string().uuid("Invalid project ID"),
	priority: z.enum([TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH, TaskPriority.URGENT]).optional(),
	dueDate: z.string().datetime().optional(),
	assigneeId: z.string().uuid().optional(),
});

const updateTaskSchema = z.object({
	title: z.string().min(1).max(200).optional(),
	description: z.string().optional(),
	priority: z.enum([TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH, TaskPriority.URGENT]).optional(),
	dueDate: z.string().datetime().optional(),
});

const changeTaskStatusSchema = z.object({
	status: z.enum([TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW, TaskStatus.DONE]),
});

const assignTaskSchema = z.object({
	assigneeId: z.string().uuid("Invalid user ID"),
});

export const taskValidation = {
	createTaskSchema,
	updateTaskSchema,
	changeTaskStatusSchema,
	assignTaskSchema,
};

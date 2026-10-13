import z from "zod";

const createCommentSchema = z.object({
	content: z.string().min(1, "Content is required").max(2000),
	taskId: z.string().uuid("Invalid task ID"),
});

const updateCommentSchema = z.object({
	content: z.string().min(1).max(2000),
});

export const commentValidation = { createCommentSchema, updateCommentSchema };

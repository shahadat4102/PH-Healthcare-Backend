import z from "zod";

const createOrgSchema = z.object({
	name: z.string().min(1, "Name is required").max(100),
	description: z.string().max(500).optional(),
});

const updateOrgSchema = z.object({
	name: z.string().min(1).max(100).optional(),
	description: z.string().max(500).optional(),
});

const addMemberSchema = z.object({
	email: z.string().email("Invalid email"),
});

export const orgValidation = { createOrgSchema, updateOrgSchema, addMemberSchema };

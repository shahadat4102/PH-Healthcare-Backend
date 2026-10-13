import z from "zod";
import { ProjectStatus } from "../../../generated/prisma/enums.js";

const createProjectSchema = z.object({
	name: z.string().min(1, "Name is required").max(150),
	description: z.string().max(1000).optional(),
	organizationId: z.string().uuid("Invalid organization ID"),
	deadline: z.string().datetime().optional(),
});

const updateProjectSchema = z.object({
	name: z.string().min(1).max(150).optional(),
	description: z.string().max(1000).optional(),
	deadline: z.string().datetime().optional(),
});

const changeProjectStatusSchema = z.object({
	status: z.enum([ProjectStatus.ACTIVE, ProjectStatus.ARCHIVED, ProjectStatus.COMPLETED]),
});

export const projectValidation = {
	createProjectSchema,
	updateProjectSchema,
	changeProjectStatusSchema,
};

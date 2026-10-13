import { Router } from "express";
import { Role } from "../../../generated/prisma/enums.js";
import { auth } from "../../middleware/checkAuth.js";
import { validateReqest } from "../../middleware/validateReqest.js";
import { ProjectController } from "./project.controller.js";
import { projectValidation } from "./project.validation.js";

const router = Router();

router.post(
	"/",
	auth(Role.MANAGER),
	validateReqest(projectValidation.createProjectSchema),
	ProjectController.createProject,
);

router.get(
	"/",
	auth(Role.ADMIN, Role.MANAGER, Role.MEMBER),
	ProjectController.getProjects,
);

router.get(
	"/:id",
	auth(Role.ADMIN, Role.MANAGER, Role.MEMBER),
	ProjectController.getSingleProject,
);

router.patch(
	"/:id",
	auth(Role.MANAGER),
	validateReqest(projectValidation.updateProjectSchema),
	ProjectController.updateProject,
);

router.delete(
	"/:id",
	auth(Role.MANAGER),
	ProjectController.deleteProject,
);

router.patch(
	"/:id/status",
	auth(Role.MANAGER),
	validateReqest(projectValidation.changeProjectStatusSchema),
	ProjectController.changeProjectStatus,
);

export const ProjectRoutes = router;

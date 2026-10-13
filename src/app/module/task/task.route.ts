import { Router } from "express";
import { Role } from "../../../generated/prisma/enums.js";
import { auth } from "../../middleware/checkAuth.js";
import { validateReqest } from "../../middleware/validateReqest.js";
import { TaskController } from "./task.controller.js";
import { taskValidation } from "./task.validation.js";

const router = Router();

router.get(
	"/my-tasks",
	auth(Role.ADMIN, Role.MANAGER, Role.MEMBER),
	TaskController.getMyTasks,
);

router.post(
	"/",
	auth(Role.MANAGER),
	validateReqest(taskValidation.createTaskSchema),
	TaskController.createTask,
);

router.get(
	"/",
	auth(Role.ADMIN, Role.MANAGER, Role.MEMBER),
	TaskController.getTasks,
);

router.get(
	"/:id",
	auth(Role.ADMIN, Role.MANAGER, Role.MEMBER),
	TaskController.getSingleTask,
);

router.patch(
	"/:id",
	auth(Role.MANAGER),
	validateReqest(taskValidation.updateTaskSchema),
	TaskController.updateTask,
);

router.delete(
	"/:id",
	auth(Role.MANAGER),
	TaskController.deleteTask,
);

router.patch(
	"/:id/status",
	auth(Role.ADMIN, Role.MANAGER, Role.MEMBER),
	validateReqest(taskValidation.changeTaskStatusSchema),
	TaskController.changeTaskStatus,
);

router.patch(
	"/:id/assign",
	auth(Role.MANAGER),
	validateReqest(taskValidation.assignTaskSchema),
	TaskController.assignTask,
);

export const TaskRoutes = router;

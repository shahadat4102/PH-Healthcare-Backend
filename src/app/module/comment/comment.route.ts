import { Router } from "express";
import { Role } from "../../../generated/prisma/enums.js";
import { auth } from "../../middleware/checkAuth.js";
import { validateReqest } from "../../middleware/validateReqest.js";
import { CommentController } from "./comment.controller.js";
import { commentValidation } from "./comment.validation.js";

const router = Router();

router.post(
	"/",
	auth(Role.ADMIN, Role.MANAGER, Role.MEMBER),
	validateReqest(commentValidation.createCommentSchema),
	CommentController.createComment,
);

router.get(
	"/task/:taskId",
	auth(Role.ADMIN, Role.MANAGER, Role.MEMBER),
	CommentController.getTaskComments,
);

router.patch(
	"/:commentId",
	auth(Role.ADMIN, Role.MANAGER, Role.MEMBER),
	validateReqest(commentValidation.updateCommentSchema),
	CommentController.updateComment,
);

router.delete(
	"/:commentId",
	auth(Role.ADMIN, Role.MANAGER, Role.MEMBER),
	CommentController.deleteComment,
);

export const CommentRoutes = router;

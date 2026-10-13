
import { Router } from "express";
import { userController } from "./user.controller.js";
import { upload } from "../../lib/multer.js";
import { auth } from "../../middleware/checkAuth.js";
import { Role } from "../../../generated/prisma/enums.js";
import { validateReqest } from "../../middleware/validateReqest.js";
import z from "zod";

const router = Router();

const updateProfileSchema = z.object({
	name: z.string().min(2).max(50),
});

router.get(
	"/me",
	auth(Role.ADMIN, Role.MANAGER, Role.MEMBER),
	userController.getUserProfile,
);

router.patch(
	"/me",
	auth(Role.ADMIN, Role.MANAGER, Role.MEMBER),
	validateReqest(updateProfileSchema),
	userController.updateUserProfile,
);

router.patch(
	"/profile-image",
	auth(Role.ADMIN, Role.MANAGER, Role.MEMBER),
	upload.single("profileImage"),
	userController.UploadProfileImage,
);

export const UserRoutes = router;

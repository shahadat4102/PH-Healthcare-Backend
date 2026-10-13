
import { Router } from "express";
import { Role } from "../../../generated/prisma/enums.js";
import { auth } from "../../middleware/checkAuth.js";
import { AuthController } from "./auth.controller.js";
import { validateReqest } from "../../middleware/validateReqest.js";
import { uservalidation } from "./auth.validation.js";

const router = Router();

router.post("/register",
	validateReqest(uservalidation.userRegisterZodSchema),
	AuthController.registerUser,
);

router.post("/verify-email",
	validateReqest(uservalidation.userEmailVerifyZodSchema),
	AuthController.verifyUserEmail,
);

router.post("/login",
	validateReqest(uservalidation.loginzodSchema),
	AuthController.loginUser,
);

router.get(
	"/me",
	auth(Role.ADMIN, Role.MANAGER, Role.MEMBER),
	AuthController.getMe,
);

router.post("/refresh-token", AuthController.refreshToken);

router.post("/google", AuthController.googleLogin);

router.post("/forgot-password",
	validateReqest(uservalidation.ForgotPasswordZodSchema),
	AuthController.forgotPassword,
);

router.post("/reset-password",
	validateReqest(uservalidation.ResetPasswordZodSchema),
	AuthController.resetPassword,
);

export const AuthRoutes = router;

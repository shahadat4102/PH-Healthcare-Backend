
import {  Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { AuthController } from "./auth.controller";

import { validateReqest } from "../../middleware/validateReqest";
import { uservalidation } from "./auth.validation";

const router = Router();


router.post("/register",
	validateReqest(uservalidation.patientRegisterZodSchema),
	
	 AuthController.registerPatient);


 router.post("/verify-email",
	validateReqest(uservalidation.patientEmailVerifyZodSchema),
	
	 AuthController.verifiPatientEmail);


router.post("/login", 
	validateReqest(uservalidation.loginzodSchema),
	AuthController.loginUser);

router.get(
	"/me",
	auth(Role.ADMIN, Role.DOCTOR, Role.PATIENT, Role.SUPER_ADMIN),
	AuthController.getMe,
);

router.post("/refresh-token", AuthController.refreshToken);

router.post("/google", AuthController.googleLogin);

router.post("/forgot-password",
	validateReqest(uservalidation.ForgotPasswordZodSchema),
	 AuthController.forgotPassword);

router.post("/reset-password", 
	validateReqest(uservalidation.ResetPasswordZodSchema),
	AuthController.resetPassword);


export const AuthRoutes = router;

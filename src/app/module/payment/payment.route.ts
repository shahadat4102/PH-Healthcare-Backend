import { Router } from "express";
import { Role } from "../../../generated/prisma/enums.js";
import { auth } from "../../middleware/checkAuth.js";
import { PaymentController } from "./payment.controller.js";

const router = Router();

router.post(
	"/initiate",
	auth(Role.MANAGER),
	PaymentController.initiatePayment,
);

// bKash callback — no auth (called by bKash server)
router.get("/callback", PaymentController.handleCallback);

router.get(
	"/my-payments",
	auth(Role.MANAGER),
	PaymentController.getMyPayments,
);

router.get(
	"/:id",
	auth(Role.MANAGER, Role.ADMIN),
	PaymentController.getSinglePayment,
);

export const PaymentRoutes = router;

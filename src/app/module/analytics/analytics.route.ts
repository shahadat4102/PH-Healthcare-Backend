import { Router } from "express";
import { analyticsController } from "./analytics.controller";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";

const router = Router();

router.get("/patient-analytics",
    auth(Role.PATIENT),
    analyticsController.getPatientAnalytics
);


router.get("/doctor-analytics",
    auth(Role.DOCTOR),
    analyticsController.getDoctorAnalytics
);

router.get("/admin-analytics",
    auth(Role.ADMIN, Role.SUPER_ADMIN),
    analyticsController.getAdminAnalytics
);



export const analyticsRoutes = router;

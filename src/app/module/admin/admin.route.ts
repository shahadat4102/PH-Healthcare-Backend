import { Router } from "express";
import { Role } from "../../../generated/prisma/enums.js";
import { auth } from "../../middleware/checkAuth.js";
import { AdminController } from "./admin.controller.js";

const router = Router();

router.get("/users", auth(Role.ADMIN), AdminController.getAllUsers);

router.patch("/users/:id/status", auth(Role.ADMIN), AdminController.updateUserStatus);

router.get("/stats", auth(Role.ADMIN), AdminController.getDashboardStats);

router.get("/audit-logs", auth(Role.ADMIN), AdminController.getAuditLogs);

export const AdminRoutes = router;

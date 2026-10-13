import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Application, type Request, type Response } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import httpStatus from "http-status";
import config from "./app/config/index.js";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler.js";
import { notFound } from "./app/middleware/notFound.js";
import { AuthRoutes } from "./app/module/auth/auth.route.js";
import { UserRoutes } from "./app/module/user/user.route.js";
import { OrganizationRoutes } from "./app/module/organization/organization.route.js";
import { ProjectRoutes } from "./app/module/project/project.route.js";
import { TaskRoutes } from "./app/module/task/task.route.js";
import { CommentRoutes } from "./app/module/comment/comment.route.js";
import { PaymentRoutes } from "./app/module/payment/payment.route.js";
import { AdminRoutes } from "./app/module/admin/admin.route.js";

const app: Application = express();

app.use(helmet());

app.use(
	cors({
		origin: config.frontend_url,
		credentials: true,
	}),
);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 100,
	standardHeaders: true,
	legacyHeaders: false,
	message: { success: false, message: "Too many requests, please try again later." },
});
app.use("/api", limiter);

app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/user", UserRoutes);
app.use("/api/v1/organization", OrganizationRoutes);
app.use("/api/v1/project", ProjectRoutes);
app.use("/api/v1/task", TaskRoutes);
app.use("/api/v1/comment", CommentRoutes);
app.use("/api/v1/payment", PaymentRoutes);
app.use("/api/v1/admin", AdminRoutes);

app.get("/", (_req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: "Welcome to Project Management SaaS API",
	});
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;

import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Application, type Request, type Response } from "express";
import httpStatus from "http-status";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AuthRoutes } from "./app/module/auth/auth.route";
import { UserRoutes } from "./app/module/user/user.route";
import { appointmentRoutes } from "./app/module/appointment/appointment.route";
import { DoctorRoutes } from "./app/module/doctor/doctor.route";
import { ScheduleRoutes } from "./app/module/schedule/schedule.route";
import { paymentRoutes } from "./app/module/payment/payment.route";
import { prescriptionRoutes } from "./app/module/prescription/prescription.route";
import { analyticsRoutes } from "./app/module/analytics/analytics.route";



const app: Application = express();

app.use(
	cors({
		origin: config.frontend_url,
		credentials: true,
	}),
);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());



app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/user", UserRoutes);
app.use("/api/v1/appointment", appointmentRoutes);
app.use("/api/v1/doctor", DoctorRoutes);
app.use("/api/v1/schedule", ScheduleRoutes);
app.use("/api/v1/payment", paymentRoutes);
app.use("/api/v1/prescription", prescriptionRoutes);
app.use("/api/v1/analytics", analyticsRoutes);


app.get("/", (_req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: "Welcome to PH Healthcare System Backend",
	});
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;

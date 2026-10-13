import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { PaymentService } from "./payment.service.js";

const initiatePayment = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const { organizationId } = req.body;

	if (!organizationId) {
		throw new Error("organizationId is required");
	}

	const result = await PaymentService.initiatePayment(organizationId, userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payment initiated successfully",
		data: result,
	});
});

const handleCallback = catchAsync(async (req: Request, res: Response) => {
	const { paymentID, status, trxID } = req.query as Record<string, string>;

	const result = await PaymentService.handleCallback(paymentID, status, trxID);

	// Redirect to frontend
	res.redirect(result.redirectUrl);
});

const getMyPayments = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const result = await PaymentService.getMyPayments(userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payments fetched successfully",
		data: result,
	});
});

const getSinglePayment = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const userRole = req.user!.role;
	const id = req.params.id as string;
	const result = await PaymentService.getSinglePayment(id, userId, userRole);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payment fetched successfully",
		data: result,
	});
});

export const PaymentController = {
	initiatePayment,
	handleCallback,
	getMyPayments,
	getSinglePayment,
};

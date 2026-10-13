import httpStatus from "http-status";
import { ActivityAction, PaymentStatus, Role, SubscriptionPlan } from "../../../generated/prisma/enums.js";
import config from "../../config/index.js";
import { getBkashIdToken } from "../../lib/bkash.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { createActivityLog } from "../../utils/activityLog.js";

const initiatePayment = async (orgId: string, userId: string) => {
	const org = await prisma.organization.findFirst({
		where: { id: orgId, isDeleted: false },
	});

	if (!org) {
		throw new AppError(httpStatus.NOT_FOUND, "Organization not found");
	}

	// Check user is MANAGER of the org
	const membership = await prisma.organizationMember.findFirst({
		where: { organizationId: orgId, userId, role: Role.MANAGER },
	});

	if (!membership) {
		throw new AppError(httpStatus.FORBIDDEN, "Only managers can initiate payments");
	}

	// Check for existing active subscription
	const activeSubscription = await prisma.subscription.findFirst({
		where: { organizationId: orgId, isActive: true },
	});

	if (activeSubscription) {
		throw new AppError(httpStatus.CONFLICT, "Organization already has an active subscription");
	}

	// Create pending payment
	const payment = await prisma.payment.create({
		data: {
			amount: "500",
			plan: SubscriptionPlan.PRO,
			status: PaymentStatus.UNPAID,
			userId,
			organizationId: orgId,
		},
	});

	// Call bKash create payment API
	const bkashIdToken = await getBkashIdToken();

	const bkashResponse = await fetch(
		`${config.bkash_base_url}/tokenized/checkout/create`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				Authorization: bkashIdToken,
				"X-APP-Key": config.bkash_app_key,
			},
			body: JSON.stringify({
				mode: "0011",
				payerReference: userId,
				callbackURL: config.bkash_callback_url,
				amount: "500",
				currency: "BDT",
				intent: "sale",
				merchantInvoiceNumber: payment.id,
			}),
		},
	);

	if (!bkashResponse.ok) {
		throw new AppError(httpStatus.BAD_GATEWAY, "bKash payment creation failed");
	}

	const bkashData = await bkashResponse.json();

	if (bkashData.statusCode !== "0000") {
		throw new AppError(httpStatus.BAD_GATEWAY, bkashData.statusMessage || "bKash payment creation failed");
	}

	// Save bkashPaymentId
	await prisma.payment.update({
		where: { id: payment.id },
		data: { bkashPaymentId: bkashData.paymentID, payerReference: userId },
	});

	return { bkashURL: bkashData.bkashURL };
};

const handleCallback = async (
	paymentId: string,
	status: string,
	bkashTrxId?: string,
) => {
	const payment = await prisma.payment.findFirst({
		where: { id: paymentId },
	});

	if (!payment) {
		return {
			success: false,
			redirectUrl: `${config.frontend_url}/payment/result?status=failed`,
		};
	}

	if (status !== "success") {
		await prisma.payment.update({
			where: { id: payment.id },
			data: { status: PaymentStatus.CANCELLED },
		});

		return {
			success: false,
			redirectUrl: `${config.frontend_url}/payment/result?status=failed`,
		};
	}

	// Execute the bKash payment
	const bkashIdToken = await getBkashIdToken();

	const executeResponse = await fetch(
		`${config.bkash_base_url}/tokenized/checkout/execute`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				Authorization: bkashIdToken,
				"X-APP-Key": config.bkash_app_key,
			},
			body: JSON.stringify({ paymentID: payment.bkashPaymentId }),
		},
	);

	const executeData = await executeResponse.json();

	if (!executeResponse.ok || executeData.statusCode !== "0000") {
		await prisma.payment.update({
			where: { id: payment.id },
			data: {
				status: PaymentStatus.FAILED,
				gatewayResponse: executeData,
			},
		});

		return {
			success: false,
			redirectUrl: `${config.frontend_url}/payment/result?status=failed`,
		};
	}

	// Success — update payment and create subscription
	const now = new Date();
	const endDate = new Date(now);
	endDate.setDate(endDate.getDate() + 30);

	await prisma.$transaction(async (tx) => {
		await tx.payment.update({
			where: { id: payment.id },
			data: {
				status: PaymentStatus.PAID,
				bkashTrxId: executeData.trxID || bkashTrxId,
				paidAt: now.toISOString(),
				gatewayResponse: executeData,
			},
		});

		await tx.subscription.upsert({
			where: { organizationId: payment.organizationId },
			create: {
				plan: SubscriptionPlan.PRO,
				startDate: now,
				endDate,
				isActive: true,
				paymentId: payment.id,
				organizationId: payment.organizationId,
			},
			update: {
				plan: SubscriptionPlan.PRO,
				startDate: now,
				endDate,
				isActive: true,
				paymentId: payment.id,
			},
		});
	});

	await createActivityLog({
		action: ActivityAction.PAYMENT_MADE,
		entityType: "PAYMENT",
		entityId: payment.id,
		userId: payment.userId,
		organizationId: payment.organizationId,
		details: { amount: payment.amount, plan: payment.plan },
	});

	return {
		success: true,
		redirectUrl: `${config.frontend_url}/payment/result?status=success`,
	};
};

const getMyPayments = async (userId: string) => {
	const payments = await prisma.payment.findMany({
		where: { userId },
		include: {
			organization: { select: { id: true, name: true } },
		},
		orderBy: { createdAt: "desc" },
	});

	return payments;
};

const getSinglePayment = async (
	paymentId: string,
	userId: string,
	userRole: string,
) => {
	const payment = await prisma.payment.findUnique({
		where: { id: paymentId },
		include: {
			organization: { select: { id: true, name: true } },
		},
	});

	if (!payment) {
		throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
	}

	if (userRole !== "ADMIN" && payment.userId !== userId) {
		throw new AppError(httpStatus.FORBIDDEN, "You do not have permission to view this payment");
	}

	return payment;
};

export const PaymentService = {
	initiatePayment,
	handleCallback,
	getMyPayments,
	getSinglePayment,
};

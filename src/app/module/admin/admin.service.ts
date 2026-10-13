import httpStatus from "http-status";
import { UserStatus } from "../../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";

interface IGetUsersQuery {
	page?: number;
	limit?: number;
	status?: UserStatus;
	role?: string;
	search?: string;
}

interface IGetAuditLogsQuery {
	page?: number;
	limit?: number;
	organizationId?: string;
	userId?: string;
	entityType?: string;
}

const getAllUsers = async (query: IGetUsersQuery) => {
	const { page = 1, limit = 10, status, role, search } = query;

	const where: Record<string, unknown> = { isDeleted: false };

	if (status) where.status = status;
	if (role) where.role = role;

	if (search) {
		where.OR = [
			{ name: { contains: search, mode: "insensitive" } },
			{ email: { contains: search, mode: "insensitive" } },
		];
	}

	const skip = (page - 1) * limit;

	const [data, total] = await Promise.all([
		prisma.user.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			omit: { password: true },
		}),
		prisma.user.count({ where }),
	]);

	return {
		data,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const updateUserStatus = async (
	targetUserId: string,
	status: "ACTIVE" | "BLOCKED",
	requestingUserId: string,
) => {
	if (targetUserId === requestingUserId) {
		throw new AppError(httpStatus.BAD_REQUEST, "You cannot change your own status");
	}

	const user = await prisma.user.findUnique({ where: { id: targetUserId } });

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	const updated = await prisma.user.update({
		where: { id: targetUserId },
		data: { status: status as UserStatus },
		omit: { password: true },
	});

	return updated;
};

const getDashboardStats = async () => {
	const [
		totalUsers,
		totalOrganizations,
		totalProjects,
		totalTasks,
		totalPaidPayments,
		activeSubscriptions,
	] = await Promise.all([
		prisma.user.count({ where: { isDeleted: false } }),
		prisma.organization.count({ where: { isDeleted: false } }),
		prisma.project.count({ where: { isDeleted: false } }),
		prisma.task.count({ where: { isDeleted: false } }),
		prisma.payment.count({ where: { status: "PAID" } }),
		prisma.subscription.count({ where: { isActive: true } }),
	]);

	return {
		totalUsers,
		totalOrganizations,
		totalProjects,
		totalTasks,
		totalPaidPayments,
		activeSubscriptions,
	};
};

const getAuditLogs = async (query: IGetAuditLogsQuery) => {
	const { page = 1, limit = 10, organizationId, userId, entityType } = query;

	const where: Record<string, unknown> = {};

	if (organizationId) where.organizationId = organizationId;
	if (userId) where.userId = userId;
	if (entityType) where.entityType = entityType;

	const skip = (page - 1) * limit;

	const [data, total] = await Promise.all([
		prisma.activityLog.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			include: {
				user: { select: { id: true, name: true, email: true } },
				organization: { select: { id: true, name: true } },
			},
		}),
		prisma.activityLog.count({ where }),
	]);

	return {
		data,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

export const AdminService = {
	getAllUsers,
	updateUserStatus,
	getDashboardStats,
	getAuditLogs,
};

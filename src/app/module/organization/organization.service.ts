import httpStatus from "http-status";
import { ActivityAction, Role } from "../../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { createActivityLog } from "../../utils/activityLog.js";
import type {
	IAddMemberPayload,
	ICreateOrganizationPayload,
	IUpdateOrganizationPayload,
} from "./organization.interface.js";

const createOrganization = async (
	payload: ICreateOrganizationPayload,
	userId: string,
) => {
	const org = await prisma.$transaction(async (tx) => {
		const newOrg = await tx.organization.create({
			data: {
				name: payload.name,
				description: payload.description,
				ownerId: userId,
			},
		});

		await tx.organizationMember.create({
			data: {
				userId,
				organizationId: newOrg.id,
				role: Role.MANAGER,
			},
		});

		return newOrg;
	});

	await createActivityLog({
		action: ActivityAction.CREATED,
		entityType: "ORGANIZATION",
		entityId: org.id,
		userId,
		organizationId: org.id,
	});

	return org;
};

const getMyOrganizations = async (userId: string) => {
	const memberships = await prisma.organizationMember.findMany({
		where: {
			userId,
			organization: { isDeleted: false },
		},
		include: {
			organization: {
				include: {
					_count: { select: { members: true, projects: true } },
				},
			},
		},
	});

	return memberships.map((m) => m.organization);
};

const getSingleOrganization = async (orgId: string, userId: string) => {
	const org = await prisma.organization.findFirst({
		where: { id: orgId, isDeleted: false },
		include: {
			members: {
				include: {
					user: {
						select: { id: true, name: true, email: true, imageUrl: true },
					},
				},
			},
			_count: { select: { projects: true } },
		},
	});

	if (!org) {
		throw new AppError(httpStatus.NOT_FOUND, "Organization not found");
	}

	// Verify user is a member
	const isMember = org.members.some((m) => m.userId === userId);
	if (!isMember) {
		throw new AppError(httpStatus.FORBIDDEN, "You are not a member of this organization");
	}

	return org;
};

const updateOrganization = async (
	orgId: string,
	payload: IUpdateOrganizationPayload,
	userId: string,
) => {
	const org = await prisma.organization.findFirst({
		where: { id: orgId, isDeleted: false },
	});

	if (!org) {
		throw new AppError(httpStatus.NOT_FOUND, "Organization not found");
	}

	if (org.ownerId !== userId) {
		throw new AppError(httpStatus.FORBIDDEN, "Only the owner can update this organization");
	}

	const updated = await prisma.organization.update({
		where: { id: orgId },
		data: payload,
	});

	await createActivityLog({
		action: ActivityAction.UPDATED,
		entityType: "ORGANIZATION",
		entityId: orgId,
		userId,
		organizationId: orgId,
	});

	return updated;
};

const deleteOrganization = async (orgId: string, userId: string) => {
	const org = await prisma.organization.findFirst({
		where: { id: orgId, isDeleted: false },
	});

	if (!org) {
		throw new AppError(httpStatus.NOT_FOUND, "Organization not found");
	}

	if (org.ownerId !== userId) {
		throw new AppError(httpStatus.FORBIDDEN, "Only the owner can delete this organization");
	}

	await prisma.organization.update({
		where: { id: orgId },
		data: { isDeleted: true, deletedAt: new Date() },
	});

	await createActivityLog({
		action: ActivityAction.DELETED,
		entityType: "ORGANIZATION",
		entityId: orgId,
		userId,
		organizationId: orgId,
	});
};

const addMember = async (
	orgId: string,
	payload: IAddMemberPayload,
	userId: string,
) => {
	const org = await prisma.organization.findFirst({
		where: { id: orgId, isDeleted: false },
	});

	if (!org) {
		throw new AppError(httpStatus.NOT_FOUND, "Organization not found");
	}

	if (org.ownerId !== userId) {
		throw new AppError(httpStatus.FORBIDDEN, "Only the owner can add members");
	}

	const targetUser = await prisma.user.findUnique({ where: { email: payload.email } });

	if (!targetUser) {
		throw new AppError(httpStatus.NOT_FOUND, "User with this email not found");
	}

	const existingMember = await prisma.organizationMember.findFirst({
		where: { userId: targetUser.id, organizationId: orgId },
	});

	if (existingMember) {
		throw new AppError(httpStatus.CONFLICT, "User is already a member of this organization");
	}

	const member = await prisma.organizationMember.create({
		data: {
			userId: targetUser.id,
			organizationId: orgId,
			role: Role.MEMBER,
		},
		include: {
			user: { select: { id: true, name: true, email: true, imageUrl: true } },
		},
	});

	await createActivityLog({
		action: ActivityAction.ASSIGNED,
		entityType: "ORGANIZATION",
		entityId: orgId,
		userId,
		organizationId: orgId,
		details: { addedUserId: targetUser.id },
	});

	return member;
};

const removeMember = async (
	orgId: string,
	memberId: string,
	userId: string,
) => {
	const org = await prisma.organization.findFirst({
		where: { id: orgId, isDeleted: false },
	});

	if (!org) {
		throw new AppError(httpStatus.NOT_FOUND, "Organization not found");
	}

	if (org.ownerId !== userId) {
		throw new AppError(httpStatus.FORBIDDEN, "Only the owner can remove members");
	}

	const member = await prisma.organizationMember.findUnique({
		where: { id: memberId },
	});

	if (!member || member.organizationId !== orgId) {
		throw new AppError(httpStatus.NOT_FOUND, "Member not found");
	}

	if (member.userId === org.ownerId) {
		throw new AppError(httpStatus.BAD_REQUEST, "Cannot remove the organization owner");
	}

	await prisma.organizationMember.delete({ where: { id: memberId } });

	await createActivityLog({
		action: ActivityAction.UNASSIGNED,
		entityType: "ORGANIZATION",
		entityId: orgId,
		userId,
		organizationId: orgId,
		details: { removedMemberId: memberId },
	});
};

const getOrgMembers = async (orgId: string, userId: string) => {
	const org = await prisma.organization.findFirst({
		where: { id: orgId, isDeleted: false },
	});

	if (!org) {
		throw new AppError(httpStatus.NOT_FOUND, "Organization not found");
	}

	const isMember = await prisma.organizationMember.findFirst({
		where: { organizationId: orgId, userId },
	});

	if (!isMember) {
		throw new AppError(httpStatus.FORBIDDEN, "You are not a member of this organization");
	}

	const members = await prisma.organizationMember.findMany({
		where: { organizationId: orgId },
		include: {
			user: {
				select: { id: true, name: true, email: true, imageUrl: true },
			},
		},
	});

	return members;
};

export const OrganizationService = {
	createOrganization,
	getMyOrganizations,
	getSingleOrganization,
	updateOrganization,
	deleteOrganization,
	addMember,
	removeMember,
	getOrgMembers,
};

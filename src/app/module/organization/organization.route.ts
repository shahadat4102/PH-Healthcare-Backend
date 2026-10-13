import { Router } from "express";
import { Role } from "../../../generated/prisma/enums.js";
import { auth } from "../../middleware/checkAuth.js";
import { validateReqest } from "../../middleware/validateReqest.js";
import { OrganizationController } from "./organization.controller.js";
import { orgValidation } from "./organization.validation.js";

const router = Router();

router.post(
	"/create",
	auth(Role.MANAGER),
	validateReqest(orgValidation.createOrgSchema),
	OrganizationController.createOrganization,
);

router.get(
	"/my-organizations",
	auth(Role.MANAGER, Role.MEMBER),
	OrganizationController.getMyOrganizations,
);

router.get(
	"/:id",
	auth(Role.ADMIN, Role.MANAGER, Role.MEMBER),
	OrganizationController.getSingleOrganization,
);

router.patch(
	"/:id",
	auth(Role.MANAGER),
	validateReqest(orgValidation.updateOrgSchema),
	OrganizationController.updateOrganization,
);

router.delete(
	"/:id",
	auth(Role.MANAGER),
	OrganizationController.deleteOrganization,
);

router.post(
	"/:id/members",
	auth(Role.MANAGER),
	validateReqest(orgValidation.addMemberSchema),
	OrganizationController.addMember,
);

router.delete(
	"/:id/members/:memberId",
	auth(Role.MANAGER),
	OrganizationController.removeMember,
);

router.get(
	"/:id/members",
	auth(Role.MANAGER, Role.MEMBER),
	OrganizationController.getOrgMembers,
);

export const OrganizationRoutes = router;

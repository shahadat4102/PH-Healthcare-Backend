import bcrypt from "bcryptjs";
import { Role, UserStatus, AuthProvider } from "../../generated/prisma/enums.js";
import config from "../config/index.js";
import { prisma } from "../lib/prisma.js";

export const seedSuperAdmin = async () => {
	try {
		const existing = await prisma.user.findUnique({ where: { email: config.super_admin_email } });
		if (existing) {
			console.log("Super Admin already exists");
			return;
		}

		const hashed = await bcrypt.hash(config.super_admin_password, Number(config.bcrypt_salt_rounds));
		await prisma.user.create({
			data: {
				name: config.super_admin_name || "Super Admin",
				email: config.super_admin_email,
				password: hashed,
				role: Role.ADMIN,
				status: UserStatus.ACTIVE,
				emailVerified: true,
				authProvider: AuthProvider.CREDENTIAL,
			},
		});
		console.log("Super admin seeded.");
	} catch (error) {
		console.log("Error seeding Super Admin:", error);
	}
};

export const seedTesterManager = async () => {
	try {
		const email = config.tester_admin_email;
		const existing = await prisma.user.findUnique({ where: { email } });
		if (existing) {
			console.log("Tester Manager already exists");
			return;
		}

		const hashed = await bcrypt.hash(config.tester_admin_password, Number(config.bcrypt_salt_rounds));
		await prisma.user.create({
			data: {
				name: config.tester_admin_name || "Tester Manager",
				email,
				password: hashed,
				role: Role.MANAGER,
				status: UserStatus.ACTIVE,
				emailVerified: true,
				authProvider: AuthProvider.CREDENTIAL,
			},
		});
		console.log("Tester manager seeded.");
	} catch (error) {
		console.log("Error seeding Tester Manager:", error);
	}
};

export const seedTesterMember = async () => {
	try {
		const email = config.tester_member_email;
		const existing = await prisma.user.findUnique({ where: { email } });
		if (existing) {
			console.log("Tester Member already exists");
			return;
		}

		const hashed = await bcrypt.hash(config.tester_member_password, Number(config.bcrypt_salt_rounds));
		await prisma.user.create({
			data: {
				name: config.tester_member_name || "Tester Member",
				email,
				password: hashed,
				role: Role.MEMBER,
				status: UserStatus.ACTIVE,
				emailVerified: true,
				authProvider: AuthProvider.CREDENTIAL,
			},
		});
		console.log("Tester member seeded.");
	} catch (error) {
		console.log("Error seeding Tester Member:", error);
	}
};

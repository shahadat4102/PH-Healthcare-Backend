import { DoctorVerificationStatus, Role } from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";

export const seedsuperAdmin = async () => {
	try {
		const isSuperAdminExist = await prisma.user.findFirst({
			where: { role: Role.SUPER_ADMIN },
		});

		if (isSuperAdminExist) {
			console.log("Super Admin already exists");
			return;
		}

		const name = config.super_admin_name;
		const email = config.super_admin_email;
		const password = config.super_admin_password;

		if (!name || !email || !password) {
			throw new Error("Super Admin name, email, or password missing in env file");
		}

		const hashedPassword = await bcrypt.hash(password, Number(config.bcrypt_salt_rounds));

		const superAdmin = await prisma.user.create({
			data: {
				name,
				email,
				password: hashedPassword,
				role: Role.SUPER_ADMIN,
				needPasswordChange: false,
				emailVerified: true,
			},
		});

		console.log("Super Admin created:", superAdmin.email);
	} catch (error) {
		console.log("Error seeding Super Admin:", error);
		await prisma.user.deleteMany({ where: { email: config.super_admin_email } });
	}
};

export const seedTesterAdmin = async () => {
	try {
		const isTesterAdminExist = await prisma.user.findUnique({
			where: { email: config.tester_admin_email },
		});

		if (isTesterAdminExist) {
			console.log("Tester Admin already exists");
			return;
		}

		const name = config.tester_admin_name;
		const email = config.tester_admin_email;
		const password = config.tester_admin_password;

		if (!name || !email || !password) {
			throw new Error("Tester Admin name, email, or password missing in env file");
		}

		const hashedPassword = await bcrypt.hash(password, Number(config.bcrypt_salt_rounds));

		const testerAdmin = await prisma.user.create({
			data: {
				name,
				email,
				password: hashedPassword,
				role: Role.ADMIN,
				needPasswordChange: false,
				emailVerified: true,
			},
		});

		console.log("Tester Admin created:", testerAdmin.email);
	} catch (error) {
		console.log("Error seeding Tester Admin:", error);
		await prisma.user.deleteMany({ where: { email: config.tester_admin_email } });
	}
};

export const seedTesterDoctor = async () => {
	try {
		const isTesterDoctorExist = await prisma.user.findUnique({
			where: { email: config.tester_doctor_email },
		});

		if (isTesterDoctorExist) {
			console.log("Tester Doctor already exists");
			return;
		}

		const name = config.tester_doctor_name;
		const email = config.tester_doctor_email;
		const password = config.tester_doctor_password;

		if (!name || !email || !password) {
			throw new Error("Tester Doctor name, email, or password missing in env file");
		}

		const hashedPassword = await bcrypt.hash(password, Number(config.bcrypt_salt_rounds));

		const testerDoctor = await prisma.user.create({
			data: {
				name,
				email,
				password: hashedPassword,
				role: Role.DOCTOR,
				needPasswordChange: false,
				emailVerified: true,
				doctor :{
					create : {
						email,
						name,
						contactNumber: "01700000000",
						experienceYears : 5,
						licenseNumber : "BMDC000",
						qualifications : "MBBS",
						specialization : "Neurology",
						verificationStatus: DoctorVerificationStatus.APPROVED,
					}
				}
			},
		});

		console.log("Tester Doctor created:", testerDoctor.email);
	} catch (error) {
		console.log("Error seeding Tester Doctor:", error);
		await prisma.user.deleteMany({ where: { email: config.tester_doctor_email } });
	}
};

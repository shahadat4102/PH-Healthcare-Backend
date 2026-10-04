import app from "./app";
import config from "./app/config";
import { deletUnverifiedDoctor } from "./app/lib/cron";
import { transpost } from "./app/lib/nodemailer";
import { prisma } from "./app/lib/prisma";
import { redisClient } from "./app/lib/redis";
import { seedsuperAdmin, seedTesterAdmin, seedTesterDoctor } from "./app/utils/seed";


const PORT = config.port;

const main = async () => {
	try {
		await prisma.$connect();
		console.log("Connected to the database successfully.");

		await redisClient.connect();
		console.log("Redis connected successfully.");

		await transpost.verify();
		console.log("Nodemailer connected successfully.");

		await seedsuperAdmin();
		await seedTesterAdmin();
		await seedTesterDoctor();
       
		await deletUnverifiedDoctor();

		app.listen(PORT, () => {
			console.log(`Server is running on port ${PORT}`);
		});
	} catch (error) {
		console.error("Error starting the server:", error);
		await prisma.$disconnect();
		process.exit(1);
	}
};

main();

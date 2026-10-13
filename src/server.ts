import app from "./app.js";
import config from "./app/config/index.js";
import { cleanupDeletedUsers } from "./app/lib/cron.js";
import { transpost } from "./app/lib/nodemailer.js";
import { prisma } from "./app/lib/prisma.js";
import { redisClient } from "./app/lib/redis.js";
import { seedSuperAdmin, seedTesterManager, seedTesterMember } from "./app/utils/seed.js";

const PORT = config.port;

const main = async () => {
	try {
		await prisma.$connect();
		console.log("Connected to the database successfully.");

		await redisClient.connect();
		console.log("Redis connected successfully.");

		await transpost.verify();
		console.log("Nodemailer connected successfully.");

		await seedSuperAdmin();
		await seedTesterManager();
		await seedTesterMember();

		cleanupDeletedUsers();

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

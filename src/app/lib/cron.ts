import cron from 'node-cron';
import { prisma } from './prisma';

// Clean up BLOCKED/DELETED users older than 30 days
export const cleanupDeletedUsers = async () => {
    cron.schedule('0 0 * * *', async () => {
        try {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const deleted = await prisma.user.deleteMany({
                where: {
                    isDeleted: true,
                    deletedAt: { lt: thirtyDaysAgo },
                },
            });
            if (deleted.count > 0) {
                console.log(`Cron: Deleted ${deleted.count} soft-deleted users older than 30 days`);
            }
        } catch (error) {
            console.log('Cron: Failed to cleanup deleted users', error);
        }
    });
};

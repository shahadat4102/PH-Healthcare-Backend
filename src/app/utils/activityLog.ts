import { ActivityAction } from '../../generated/prisma/enums';
import { prisma } from '../lib/prisma';

interface IActivityLogInput {
    action: ActivityAction;
    entityType: string;
    entityId: string;
    userId: string;
    organizationId: string;
    projectId?: string;
    taskId?: string;
    details?: Record<string, unknown>;
}

export const createActivityLog = async (input: IActivityLogInput): Promise<void> => {
    try {
        await prisma.activityLog.create({
            data: {
                action: input.action,
                entityType: input.entityType,
                entityId: input.entityId,
                userId: input.userId,
                organizationId: input.organizationId,
                projectId: input.projectId,
                taskId: input.taskId,
                details: input.details ? JSON.parse(JSON.stringify(input.details)) : undefined,
            },
        });
    } catch (err) {
        // Log failure should never break main operation
        console.error('ActivityLog creation failed:', err);
    }
};

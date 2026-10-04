import { z } from "zod";

export const CreateScheduleValidationzodSchema = z.object({
    startDateTime: z.coerce.date({ invalid_type_error: "Invalid Start Date Time" }),
    endDateTime: z.coerce.date({ invalid_type_error: "Invalid End Date Time" }),
    meetingLink: z.string().url("Invalid Meeting Link").trim(),
});

export const UpdateScheduleValidationZodSchema = z.object({
    startDateTime: z.coerce.date({ invalid_type_error: "Invalid Start Date Time" }).optional(),
    endDateTime: z.coerce.date({ invalid_type_error: "Invalid End Date Time" }).optional(),
    meetingLink: z.string().url("Invalid Meeting Link").trim().optional(),
});

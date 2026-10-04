import z from "zod";



export const BookAppointmentValidetionZodSchema = z.object({
    scheduleId : z.string().min(1, "Schedule Id Is Required"),
});


export const UpdateAppointmentStatusValidationZodSchema = z.object({
    status: z.enum(
        ["ONGOIN", "COMPLETED"],
        "Status Must Be Either ONGOING Or COMPLETED",
    )
})
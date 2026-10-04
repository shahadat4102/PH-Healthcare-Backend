import z from "zod";

export const ApplyAsDoctorValideationZodSchema = z.object({
    user: z.object({
        name: z.string().trim().min(2, `Name must be at least 2 characters long`),
        email: z.string().email(`Invalid email address`).trim().toLowerCase(),
    }),

    doctor: z.object({
        address: z
        .string()
        .trim()
        .min(5, `Address must be at least 5 characters long`)
        .optional(),

        specialization: z.string().trim().min(2, `Specialization is required`),
        licenseNumber: z.string().trim().min(3, `License number is required`),
        qualifications: z.string().trim().min(2, `Qualifications are required`),

        experienceYears: z
        .number()
        .int(`Experience years must be an integer`)
        .min(0, `Experience years cannot be negative`),

        bio: z
        .string()
        .trim()
        .max(1000, `Bio cannot exceed 1000 characters`)
        .optional(),

        consultationFee: z
        .number()
        .min(0, `Consultation fee cannot be negative`)
        .optional(),

        contactNumber: z
        .string()
        .trim()
        .min(5, `Contact number is invalid`),  // required — matches schema
    }),
})

export const UpdateDoctorProfileValidationZodSchema = z.object({
    address: z 
    .string()
    .trim()
    .min(5, "Address must be at least 5 characters long")
    .optional(),

    bio: z
    .string()
    .trim()
    .max(1000, "Bio cannot exceed 1000 characters")
    .optional(),

    consultationFee: z
    .number()
    .min(0, "Consultation fee cannot be negativ")
    .optional(),

    contactNumber: z
    .string()
    .trim()
    .min(5, "Contact number is invalid")
    .optional(),
})

export const GetPublicDoctorsQueryValidationZodSchema = z.object({
    searchTerm: z.string().trim().optional(),
    specialization: z.string().trim().optional(),
    minFee: z.string().regex(/^\d+(\.\d+)?$/, "minFee must be a valid number").optional(),
    maxFee: z.string().regex(/^\d+(\.\d+)?$/, "maxFee must be a valid number").optional(),
    page: z.string().regex(/^\d+$/, "page must be a positive integer").optional(),
    limit: z.string().regex(/^\d+$/, "limit must be a positive integer").optional(),
    sortBy: z.enum(["createdAt", "consultationFee", "experienceYears", "name"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const GetSingleDoctorParamValidationZodSchema = z.object({
    id: z.string().trim().min(1, "Doctor ID is required"),
});

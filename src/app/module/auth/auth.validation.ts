import z from "zod";

const passwordSchema = z
	.string({ required_error: "Password is required" })
	.min(8, "Password must be at least 8 characters long")
	.regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
	.regex(/[a-z]/, "Password must contain at least 1 lowercase letter")
	.regex(/[0-9]/, "Password must contain at least 1 number")
	.regex(/[^A-Za-z0-9]/, "Password must contain at least 1 special character");

const patientRegisterZodSchema = z.object({
	name: z
		.string({ required_error: "Name is required" })
		.min(3, "Name must be at least 3 characters long")
		.max(100, "Name must be at most 100 characters long"),
	email: z
		.string({ required_error: "Email is required" })
		.email("Invalid email address"),
	password: passwordSchema,
	patient: z
		.object({
			contactNumber: z.string().optional(),
		})
		.optional(),
});

const patientEmailVerifyZodSchema = z.object({
	email: z
		.string({ required_error: "Email is required" })
		.email("Invalid email address"),
	otp: z.string().length(6, "OTP must be exactly 6 characters"),
});

const loginzodSchema = z.object({
	email: z
		.string({ required_error: "Email is required" })
		.email("Invalid email address"),
	password: passwordSchema,
});

const ForgotPasswordZodSchema = z.object({
	email: z
		.string({ required_error: "Email is required" })
		.email("Invalid email address"),
});

const ResetPasswordZodSchema = z.object({
	email: z
		.string({ required_error: "Email is required" })
		.email("Invalid email address"),
	newPassword: passwordSchema,
	otp: z.string().length(6, "OTP must be exactly 6 characters"),
});

export const uservalidation = {
	patientRegisterZodSchema,
	patientEmailVerifyZodSchema,
	loginzodSchema,
	ForgotPasswordZodSchema,
	ResetPasswordZodSchema,
};

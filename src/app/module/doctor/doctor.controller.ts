import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { DoctorService } from "./doctor.service";
import { ApplyAsDoctorValideationZodSchema } from "./doctor.validation";



const applyAsDoctor = catchAsync(async (req: Request, res: Response) => {

	const files = req.files as { [fieldname: string]: Express.Multer.File[] }
	const resume = files?.[`resume`] ? files[`resume`][0] : null;
	const additionalFiles = files?.[`additionalFiles`] || [];

	if (!req.body.data) {
		throw new Error("Request body 'data' field is missing. Send JSON as form-data field named 'data'.")
	}

	const zodValidationResult = ApplyAsDoctorValideationZodSchema.safeParse(JSON.parse(req.body.data))

	if (!zodValidationResult.success) {
		throw new Error(zodValidationResult.error.issues[0].message)
	}

	const payload = zodValidationResult.data


	const result = await DoctorService.applyAsDoctor(payload, resume, additionalFiles)

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User profile fetched successfully",
		data: result
	});
});


const verifyDoctorEmail = catchAsync(async (req: Request, res: Response) => {


	const payload = req.body


	const result = await DoctorService.verifyDoctorEmail(payload)

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Doctor Email verified successfully",
		data: result
	});
});


const approveDoctor = catchAsync(async (req: Request, res: Response) => {


	const payload = req.body
	const user = req.user!

	const result = await DoctorService.approveDoctor(payload, user)

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Doctor Email verified successfully",
		data: result
	});
});



const getAllDoctors = catchAsync(async (req: Request, res: Response) => {

	const { data, meta } = await DoctorService.getAllDoctors(req.query)

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Doctors Retrieved successfully",
		data: data,
		meta: meta
	});
});


const updateDoctorProfile = catchAsync(async (req: Request, res: Response) => {

	const payload = req.body;
	const user = req.user!;

	const result = await DoctorService.updateDoctorProfile(payload, user)

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Doctor Profile Update successfully",
		data: result
	});
});


//_------------___________--------------________------------


const getAvailableDoctorByTodaySSchedul = catchAsync(async (req: Request, res: Response) => {

	const { data, meta } = await DoctorService.getAvailableDoctorByTodaySSchedul(req.query)

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Available doctors for today retrieved successfully",
		data,
		meta
	});
});


const getAllDoctorsListpublic = catchAsync(async (req: Request, res: Response) => {

	const { data, meta } = await DoctorService.getAllDoctorsListpublic(req.query)

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Doctors list retrieved successfully",
		data,
		meta
	});
});


const getSingleDoctorPublicProfile = catchAsync(async (req: Request, res: Response) => {

	const doctorId = req.params.doctorId as string;

	const result = await DoctorService.getSingleDoctorPublicProfile(doctorId)

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Doctor profile retrieved successfully",
		data: result
	});
});


export const DoctorController = {
	applyAsDoctor,
	verifyDoctorEmail,
	approveDoctor,
	getAllDoctors,
	updateDoctorProfile,
	getAvailableDoctorByTodaySSchedul,
	getAllDoctorsListpublic,
	getSingleDoctorPublicProfile,

}

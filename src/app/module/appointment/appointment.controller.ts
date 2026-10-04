import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { AppointmentService } from "./appointment.service";



const bookAppointment = catchAsync(async (req: Request, res: Response) => {
	
	const payload = req.body;
	const user = req.user!

   const result = await AppointmentService.bookappointment(payload, user);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "appointment payment initiated successfully",
		data: result
	});
});


const payAppointment = catchAsync(async (req: Request, res: Response) => {
	
	const payload = req.body;
	const user = req.user!

   const result = await AppointmentService.payAppointment(payload, user);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "appointment payment initiated successfully",
		data: result
	});
});


const bookAppointmentCallback = catchAsync(async (req: Request, res: Response) => {
	
   const {redirectUrl} = await AppointmentService.bookappointmentCallback(req.query)
     
       res.redirect(redirectUrl)
	// sendResponse(res, {
	// 	statusCode: httpStatus.CREATED,
	// 	success: true,
	// 	message: "Email Verified successfully",
	// 	data: result
	// });
});


const cancelAppointment = catchAsync(async (req: Request, res: Response) => {
	
	const payload = req.body;
	const user = req.user!

   const result = await AppointmentService.cencelAppointment(payload, user);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "appointment cancel and refunded successfully",
		data: result
	});
});

// patint appointment service 

const updateAppointmentStatus = catchAsync(async (req: Request, res: Response) => {

	const appointmentId = req.params.appointmentId as string
	const payload = req.body
	const user = req.user!;

	const result = await AppointmentService.updateAppointmentStatus(appointmentId, payload, user)
	
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "appointment status  successfully",
		data: result
	});
	
});

const getMyAppointment = catchAsync(async (req: Request, res: Response) => {

	const user = req.user!;

	const {data, meta} = await AppointmentService.getMyAppointments(req.query, user)
	
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "appointment status  successfully",
		 data,
		 meta
	});
	
});


const getDoctorAppointment = catchAsync(async (req: Request, res: Response) => {

	const user = req.user!;

	const {data, meta} = await AppointmentService.getDcotorAppointments(req.query, user)
	
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Doctor appointments retrieved successfully",
		 data,
		 meta
	});
	
});


const getAllAppointment = catchAsync(async (req: Request, res: Response) => {

	

	const {data, meta} = await AppointmentService.getAllAppointments(req.query)
	
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "appointment Retrived  successfully",
		 data,
		 meta
	});
	
});


const getSingleAppointment = catchAsync(async (req: Request, res: Response) => {
     
	const appointmentId = req.params.appointmentId as string
	const user = req.user!;

	const result = await AppointmentService.getSingleAppointments(appointmentId, user)
	
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "appointment status  successfully",
		 data: result
		 
	});
	
});



export const AppointmentController = {
    bookAppointment,
	payAppointment,
    bookAppointmentCallback,
	cancelAppointment,
	updateAppointmentStatus,
	getMyAppointment,
	getDoctorAppointment,
	getAllAppointment,
	getSingleAppointment
}

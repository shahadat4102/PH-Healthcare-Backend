import { GetDoctorAggregateType } from './../../../generated/prisma/models/Doctor';

import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { analyticsService } from "./analytics.service";




const  getAdminAnalytics = catchAsync(async (req: Request, res: Response) => {
       
	const result = await analyticsService.getAdminAnalytics()
	
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "patient analytis Retrieved  successfully",
		data: result
	});
	
});


const  getPatientAnalytics = catchAsync(async (req: Request, res: Response) => {
        
    const user = req.user!

	const result = await analyticsService.getPatientAnalytics(user)
	
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "patient analytis Retrieved  successfully",
		data: result
	});
	
});


const  getDoctorAnalytics   = catchAsync(async (req: Request, res: Response) => {
        
    const user = req.user!

	const result = await analyticsService.getDoctorAnalytics(user)
	
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "patient analytis Retrieved  successfully",
		data: result
	});
	
});

export const analyticsController = {
    getAdminAnalytics,
    getPatientAnalytics,
    getDoctorAnalytics 

}
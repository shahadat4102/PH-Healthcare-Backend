
import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { paymentService } from "./payment.service";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";



const getMyPayments = catchAsync (async(req: Request, res: Response) => {

    const user = req.user!;

    const {data , meta } = await paymentService.getMyPayments(req.query, user);

     sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payment Retrievd  successfully",
		 data,
		 meta
	});
	
 })


 
const getAllPayments = catchAsync (async(req: Request, res: Response) => {


    const {data , meta } = await paymentService.getAllPayments(req.query);

     sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payment Retrievd  successfully",
		 data,
		 meta
	});
	
 })

 
const getSinglePayments = catchAsync (async(req: Request, res: Response) => {
      
    const paymentId = await req.params.paymentId as string
    const user = req.user!;

    const result = await paymentService.getSinglePayments(paymentId, user);

     sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payment Retrievd  successfully",
		 data: result
	});
	
 })


 export const paymentController = {
    getMyPayments,
    getAllPayments,
    getSinglePayments
 }
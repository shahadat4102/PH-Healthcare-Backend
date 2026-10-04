

import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { prescriptinScrvice } from "./prescription.service";






const createPrescription = catchAsync(async (req: Request, res: Response) => {
    
    const payload = req.body;
    const user = req.user!

   const result = await prescriptinScrvice.createPrescription(payload, user);

    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: "prescriptin Create And Emailed To Patint successfully",
        data: result
    });
});


const getSinglePrescripton = catchAsync(async (req: Request, res: Response) => {
    
    const appointmentId = req.params.appointmentId as string
    const user = req.user!

   const result = await prescriptinScrvice.getSinglePrescripton(appointmentId, user);

    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: "prescriptin Retrived successfully",
        data: result
    });
});



export const prescriptionController = {
      createPrescription,
      getSinglePrescripton
}

import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus  from "http-status";
import { userService } from "./user.service";




const UploadProfileImage = catchAsync(async (req: Request, res: Response) => {
   
   if(!req.file){
    throw new Error("No file provided")
   }

   const userId = req.user?.userId

  const result = await userService.UploadProfileImage(req.file?.buffer,userId!)
	
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Verification Otp Send",
		data: result,
	});
});


export const userController = {
    UploadProfileImage
}
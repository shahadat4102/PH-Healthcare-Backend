


import {  Router } from "express";
import { DoctorController } from "./doctor.controller";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { validateReqest } from "../../middleware/validateReqest";
import { UpdateDoctorProfileValidationZodSchema } from "./doctor.validation";



const router = Router();


router.post("/apply-as-doctor", 
   // validateReqest(uservalidation.ResetPasswordZodSchema),
   upload.fields([
     {
        name : "resume",
        maxCount : 1
     },
     {
        name : "additionalFiles",
        maxCount : 10
     }
   ]),
    DoctorController.applyAsDoctor);

    
router.post("/apply-as-doctor/verify-email", 
    DoctorController.verifyDoctorEmail);

    

 router.post("/approve-doctor",    
   auth(Role.ADMIN, Role.SUPER_ADMIN),
    DoctorController.approveDoctor);




 router.get("/all-doctors",    
   auth(Role.ADMIN, Role.SUPER_ADMIN),
    DoctorController.getAllDoctors);


 router.patch("/updat-my-profile",    
   auth(Role.DOCTOR),
   validateReqest(UpdateDoctorProfileValidationZodSchema),
   DoctorController.updateDoctorProfile);    


// Public routes — no auth required
router.get("/public/available-today",
    DoctorController.getAvailableDoctorByTodaySSchedul);

router.get("/public/all-doctor",
    DoctorController.getAllDoctorsListpublic);

router.get("/public/:doctorId",
    DoctorController.getSingleDoctorPublicProfile);


export const DoctorRoutes = router;

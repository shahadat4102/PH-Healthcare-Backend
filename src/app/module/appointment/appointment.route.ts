


import {  Router } from "express";
import { AppointmentController } from "./appointment.controller";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { validateReqest } from "../../middleware/validateReqest";
import { BookAppointmentValidetionZodSchema, UpdateAppointmentStatusValidationZodSchema } from "./appointment.validation";


const router = Router();

router. post ("/book-appointment",
    auth(Role.PATIENT), 
    validateReqest(BookAppointmentValidetionZodSchema),
    AppointmentController.bookAppointment)

router. post ("/pay-appointment",
    auth(Role.PATIENT), 
    AppointmentController.payAppointment)

router. post ("/cancel-appointment",
    auth(Role.PATIENT, Role.ADMIN, Role.SUPER_ADMIN),
     AppointmentController.cancelAppointment)

router.get("/book-appointment/payment/callback",
      AppointmentController.bookAppointmentCallback)

     //Patinet AppointRouter 
router.patch("/update-status/:appointmentId",
    auth(Role.DOCTOR),
    validateReqest( UpdateAppointmentStatusValidationZodSchema),
     AppointmentController.updateAppointmentStatus)     


router.get("/my-appointments",
    auth(Role.PATIENT),
     AppointmentController.getMyAppointment)     


router.get("/doctor-appointments",
    auth(Role.DOCTOR),
     AppointmentController.getDoctorAppointment)     


router.get("/all-appointments",
    auth(Role.ADMIN, Role.SUPER_ADMIN),
     AppointmentController.getAllAppointment)     


router.get("/:appointmentId",
    auth(Role.PATIENT,Role.DOCTOR, Role.ADMIN, Role.SUPER_ADMIN),
     AppointmentController.getSingleAppointment)     







export const appointmentRoutes = router;

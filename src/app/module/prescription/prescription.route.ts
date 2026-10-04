

import {  Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { validateReqest } from "../../middleware/validateReqest";
import { CreatePrescriptionalidatinZodSchema } from "./prescription.validation";
import { prescriptionController } from "./prescription.controller";


const router = Router();

router.post("/create-prescription",
    auth(Role.DOCTOR),
    validateReqest(CreatePrescriptionalidatinZodSchema),
    prescriptionController.createPrescription)




router.get("/:appointmentId",
    auth(Role.PATIENT,Role.DOCTOR, Role.ADMIN, Role.SUPER_ADMIN),
     prescriptionController.getSinglePrescripton)     



export const prescriptionRoutes = router;

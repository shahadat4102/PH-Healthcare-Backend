


import {  Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { scheduleController } from "./schedule.controller";
import { validateReqest } from "../../middleware/validateReqest";
import { CreateScheduleValidationzodSchema, UpdateScheduleValidationZodSchema } from "./schedule.validation";





const router = Router();


router.post("/create-schedules", 
   auth(Role.DOCTOR),
   validateReqest(CreateScheduleValidationzodSchema),
    scheduleController.createSchedule
);


router.get("/my-schedules",
    auth(Role.DOCTOR),
    scheduleController.getMySchedules
);


router.get("/all-schedules",
    auth(Role.ADMIN, Role.SUPER_ADMIN),
    
    
    scheduleController.getAllSchedules
);


router.get("/todays-schedule",
    scheduleController.getTodaysSchedule
);


router.patch("/update-schedule/:scheduleId",
    auth(Role.DOCTOR),
    validateReqest(UpdateScheduleValidationZodSchema),
    
    scheduleController.updateSchedule
);

router.patch("/publish-schedule/:scheduleId",
    auth(Role.DOCTOR),
    
    scheduleController.publicSchedule
);


router.get("/:scheduleId",
    auth(Role.DOCTOR, Role.ADMIN, Role.SUPER_ADMIN),
   
    scheduleController.getScheduleById
);



router.delete("/:scheduleId",
    auth(Role.DOCTOR),
   
    scheduleController.deleteSchedule
);



export const ScheduleRoutes = router;

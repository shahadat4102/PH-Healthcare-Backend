import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { scheduleService } from "./schedule.service";
import httpStatus from "http-status";
import type { RequstUser } from "../../middleware/checkAuth";



const createSchedule = catchAsync(async (req: Request, res: Response) => {

    const user = req.user as RequstUser;
    const result = await scheduleService.createSchedule(req.body, user);


    res.status(httpStatus.CREATED).json({
        success: true,
        statusCode: httpStatus.CREATED,
        message: "Schedule Created Successfully",
        data: result,
    });
});

const getMySchedules = catchAsync(async (req: Request, res: Response) => {

    const user = req.user as RequstUser;
    const result = await scheduleService.getMySchedules(req.query, user);

    res.status(httpStatus.OK).json({
        success: true,
        statusCode: httpStatus.OK,
        message: "My Schedules Fetched Successfully",
        meta: result.meta,
        data: result.data,
    });
});

const getAllSchedules = catchAsync(async (req: Request, res: Response) => {

    const result = await scheduleService.getAllSchedules(req.query);
    
    res.status(httpStatus.OK).json({
        success: true,
        statusCode: httpStatus.OK,
        message: "All Schedules Fetched Successfully",
        meta: result.meta,
        data: result.data,
    });
});

const getScheduleById = catchAsync(async (req: Request, res: Response) => {

    const result = await scheduleService.getScheduleById(req.params.scheduleId as string);

    res.status(httpStatus.OK).json({
        success: true,
        statusCode: httpStatus.OK,
        message: "Schedule Fetched Successfully",
        data: result,
    });
});

const updateSchedule = catchAsync(async (req: Request, res: Response) => {
    
    const user = req.user as RequstUser;
    const result = await scheduleService.updateSchedule(req.params.scheduleId as string, req.body, user);
    
    res.status(httpStatus.OK).json({
        success: true,
        statusCode: httpStatus.OK,
        message: "Schedule Updated Successfully",
        data: result,
    });
});

const publicSchedule = catchAsync(async (req: Request, res: Response) => {

    const user = req.user as RequstUser;
    const result = await scheduleService.publicSchedule(req.params.scheduleId as string, user);
    
    res.status(httpStatus.OK).json({
        success: true,
        statusCode: httpStatus.OK,
        message: "Schedule Published Successfully",
        data: result,
    });
});

const deleteSchedule = catchAsync(async (req: Request, res: Response) => {

    const user = req.user as RequstUser;
    const result = await scheduleService.deleteSchedule(req.params.scheduleId as string, user);

    res.status(httpStatus.OK).json({
        success: true,
        statusCode: httpStatus.OK,
        message: "Schedule Deleted Successfully",
        data: result,
    });
});

const getTodaysSchedule = catchAsync(async (req: Request, res: Response) => {

    const result = await scheduleService.getTodaysSchedule(req.query);

    res.status(httpStatus.OK).json({
        success: true,
        statusCode: httpStatus.OK,
        message: "Today's Schedules Fetched Successfully",
        meta: result.meta,
        data: result.data,
    });
});


export const scheduleController = {
    createSchedule,
    getMySchedules,
    getAllSchedules,
    getScheduleById,
    updateSchedule,
    publicSchedule,
    deleteSchedule,
    getTodaysSchedule,
};

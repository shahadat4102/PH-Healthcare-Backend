
import httpStatus from 'http-status';
import { prisma } from "../../lib/prisma"
import { RequstUser } from "../../middleware/checkAuth"
import { AppError } from "../../utils/AppError"
import { ICreateSchedulePayload, IUpdateSchedulePayload } from "./schedule.interface"
import { addDays, differenceInMinutes, isAfter, isSameDay, startOfDay } from 'date-fns';
import { IQuery } from '../../interfeses';
import { ScheduleWhereInput } from '../../../generated/prisma/models';
import {ScheduleStatus}  from '../../../generated/prisma/enums';




const createSchedule = async (payload: ICreateSchedulePayload, user: RequstUser) => {

    const doctor = await prisma.doctor.findUnique({
        where: {
            userId: user.userId
        }
    })
    if (!doctor) {
        throw new AppError(httpStatus.NOT_FOUND, "Doctor Profile Not Found")
    }

// 25 August => start time : 9.00 pm
// 26 August => end time : 3.00 pm
    if(!isSameDay(payload.startDateTime, payload.endDateTime)){
        throw new AppError(httpStatus.CONFLICT, "Start Date Time  And End Date Time Must Be on The Same day")
    }

    if(isAfter(payload.startDateTime, payload.endDateTime)){
        throw new AppError(httpStatus.CONFLICT, "Start Date Time cannot Be After End Date Time")
    }

    const startofTheDay = startOfDay(payload.startDateTime)
    const startofTheNextDay = addDays(startofTheDay, 1)

    const ExistingScheduleOnThisDay = await prisma.schedule.findFirst({
        where: {
            doctorId: doctor.id,
            isDeleted: false,
            startDateTime: {
                gte: startofTheDay,
                lt: startofTheNextDay
            }
        }
    })
    if (ExistingScheduleOnThisDay) {
        throw new AppError(httpStatus.CONFLICT, "You Already Have A Schedule For this Date")
    }


    const durationInMinutes = differenceInMinutes(
        payload.endDateTime,    // বড় time আগে
        payload.startDateTime   // ছোট time পরে
    )

    const MINUTES_ALLOCATED_PER_SLOT = 20

    const totalSlots = Math.floor(durationInMinutes / MINUTES_ALLOCATED_PER_SLOT)

    const schedule = await prisma.schedule.create({
        data: {
            startDateTime: payload.startDateTime,
            endDateTime: payload.endDateTime,
            meetingLink: payload.meetingLink,
            totalSlots,
            availableSlots: totalSlots,
            doctorId: doctor.id
        },
        include: {
            doctor: {
                select: {
                    name: true,
                    email: true,
                    contactNumber: true
                }
            }
        }
    })

    return schedule

}

const getMySchedules = async (query: IQuery, user: RequstUser) => {

    const doctor = await prisma.doctor.findUnique({
        where: {
            userId: user.userId
        }
    })
    if (!doctor) {
        throw new AppError(httpStatus.NOT_FOUND, "Doctor Profile Not Found")
    }

    //----______-_______--------__________-----------
    const limit = query.limit ? Number(query.limit) : 10;
    const page = query.page ? Number(query.page) : 1;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ? query.sortBy : "createdAt";
    const sortOrder = query.sortOrder ? query.sortOrder : "desc"


    const andConditions: ScheduleWhereInput[] = [
        {
            doctorId: doctor.id
        },
        {
            isDeleted: false
        }
    ];
    if (query.status) {
        andConditions.push({ status: query.status })
    }

    const schedule = await prisma.schedule.findMany({
        where: {
            AND: andConditions
        },
        take: limit,
        skip,
        orderBy: {
            // sortBy : sortOrder
            [sortBy]: sortOrder
        },
        include: {
            appointments: {
                include: {
                    patient: true
                }
            }
        }

    })

    const total = await prisma.schedule.count({
        where: {
            AND: andConditions
        }
    })


    return {
        data: schedule,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    }


}


const getAllSchedules = async (query: IQuery) => {

    const limit = query.limit ? Number(query.limit) : 10;
    const page = query.page ? Number(query.page) : 1;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ? query.sortBy : "createdAt";
    const sortOrder = query.sortOrder ? query.sortOrder : "desc"


    const andConditions: ScheduleWhereInput[] = [];

    if (query.doctorId) {
        andConditions.push({ doctorId: query.doctorId })
    }
    if (query.email) {
        andConditions.push({
            doctor: {
                email: query.email
            }
        })
    }

    if (query.searchTerm) {
        andConditions.push({
            doctor: {
                OR: [
                    { name: { contains: query.searchTerm, mode: "insensitive" } },
                    { email: { contains: query.searchTerm, mode: "insensitive" } },
                    {
                        specialization: {
                            contains: query.searchTerm,
                            mode: "insensitive"
                        },
                    },

                ]
            }
        })
    };


    const schedule = await prisma.schedule.findMany({
        where: {
            AND: andConditions
        },
        take: limit,
        skip,
        orderBy: {
            // sortBy : sortOrder
            [sortBy]: sortOrder
        },
        include: {
            appointments: {
                include: {
                    patient: true
                }
            }
        }

    })

    const total = await prisma.schedule.count({
        where: {
            AND: andConditions
        }
    })


    return {
        data: schedule,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    }




}


const getScheduleById = async (scheduleId: string) => {

    const schedule = await prisma.schedule.findUnique({
        where: { id: scheduleId },
        include: {
            doctor: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    specialization: true,
                    userId: true
                }
            },
            appointments: {
                include: {
                    patient: true
                }
            }
        }
    });

    if (!schedule || schedule.isDeleted) {
        throw new AppError(httpStatus.NOT_FOUND, "Schedule NOT FOUND")
    }

    return schedule

}

const updateSchedule = async (scheduleId: string, payload: IUpdateSchedulePayload, user: RequstUser) => { 

    const doctor = await prisma.doctor.findUnique({
        where: { userId: user.userId }
    })
    if (!doctor) {
        throw new AppError(httpStatus.NOT_FOUND, "Doctor Not Found")
    }

    const schedule = await prisma.schedule.findUnique({
        where: { id: scheduleId, doctorId: doctor.id }
    })
    if (!schedule || schedule.isDeleted) {
        throw new AppError(httpStatus.NOT_FOUND, "Schedule Not Found")
    }

    if (schedule.status === ScheduleStatus.PUBLISHED && schedule.totalSlots !== schedule.availableSlots){
          throw new AppError(httpStatus.CONFLICT, "Scedule once Published And appointment booked Cannot Be Update")
    }

      

    payload.meetingLink = payload.meetingLink || schedule.meetingLink
    payload.startDateTime = payload.startDateTime || schedule.startDateTime
    payload.endDateTime = payload.endDateTime || schedule.endDateTime

   
 // 25 August => start time : 9.00 pm
// 26 August => end time : 3.00 pm
    if(!isSameDay(payload.startDateTime, payload.endDateTime)){
        throw new AppError(httpStatus.CONFLICT, "Start Date Time  And End Date Time Must Be on The Same day")
    }

    if(isAfter(payload.startDateTime, payload.endDateTime)){
        throw new AppError(httpStatus.CONFLICT, "Start Date Time cannot Be After End Date Time")
    }


     const startofTheDay = startOfDay(payload.startDateTime)
    const startofTheNextDay = addDays(startofTheDay, 1)

    const ExistingScheduleOnThisDay = await prisma.schedule.findFirst({
        where: {
            doctorId: doctor.id,
            isDeleted: false,
            startDateTime: {
                gte: startofTheDay,
                lt: startofTheNextDay
            }
        }
    })
    if (ExistingScheduleOnThisDay) {
        throw new AppError(httpStatus.CONFLICT, "You Already Have A Schedule For this Date")
    }


    const durationInMinutes = differenceInMinutes(
        payload.startDateTime,
        payload.endDateTime
     )

    const MINUTES_ALLOCATED_PER_SLOT = 20

    const totalSlots = Math.floor(durationInMinutes / MINUTES_ALLOCATED_PER_SLOT)

     const updateSchedule = await prisma.schedule.update({
        where : {
            id : schedule.id
        },
        data: {
            startDateTime: payload.startDateTime,
            endDateTime: payload.endDateTime,
            meetingLink: payload.meetingLink,
            totalSlots,
            availableSlots: totalSlots,
            doctorId: doctor.id
        },
        include: {
            doctor: {
                select: {
                    name: true,
                    email: true,
                    contactNumber: true
                }
            }
        }
    })

    return updateSchedule

}

const publicSchedule = async (scheduleId : string, user : RequstUser) => {
      
     const doctor = await prisma.doctor.findUnique({
        where: { userId: user.userId }
    })
    if (!doctor) {
        throw new AppError(httpStatus.NOT_FOUND, "Doctor Not Found")
    }

    const schedule = await prisma.schedule.findUnique({
        where: { id: scheduleId, doctorId: doctor.id }
    })
    if (!schedule || schedule.isDeleted) {
        throw new AppError(httpStatus.NOT_FOUND, "Schedule Not Found")
    }
    
    if (schedule.status === ScheduleStatus.PUBLISHED ){
          throw new AppError(httpStatus.CONFLICT, "Scedule Is Already Published ")
    }
  
    const publishedSchedule = await prisma.schedule.update({
        where : {id : schedule.id},
        data : {
           status: ScheduleStatus.PUBLISHED
        }
    })

    return publishedSchedule
 

}


const deleteSchedule = async (scheduleId : string, user : RequstUser) => {

     const doctor = await prisma.doctor.findUnique({
      where: { userId: user.userId }
    })
    if (!doctor) {
        throw new AppError(httpStatus.NOT_FOUND, "Doctor Not Found")
    }

    const schedule = await prisma.schedule.findUnique({
        where: { id: scheduleId, doctorId: doctor.id }
    })
    if (!schedule || schedule.isDeleted) {
        throw new AppError(httpStatus.NOT_FOUND, "Schedule Not Found")
    }
    
  
    if (schedule.status === ScheduleStatus.PUBLISHED && schedule.totalSlots !== schedule.availableSlots){
          throw new AppError(httpStatus.CONFLICT, "Scedule once Published And appointment booked Cannot Be Deleted")
    }

    const deleteSchedule = await prisma.schedule.update({
        where : {id: schedule.id},
        data : {
            isDeleted : true,
            deletedAt : new Date()
        }
    })

    return deleteSchedule;

}


const getTodaysSchedule = async  (query : IQuery) => {
    
    if(!query.doctorId){
        throw new AppError(httpStatus.NOT_FOUND, "Doctor Id must Be Provided Qury")
    }

    
     const doctor = await prisma.doctor.findUnique({
      where: { id : query.doctorId }
    })
    if (!doctor) {
        throw new AppError(httpStatus.NOT_FOUND, "Doctor Not Found")
    }


     const limit = query.limit ? Number(query.limit) : 10;
    const page = query.page ? Number(query.page) : 1;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ? query.sortBy : "createdAt";
    const sortOrder = query.sortOrder ? query.sortOrder : "desc"
    

    const now = new Date()
    const startOfToday = startOfDay(now)
    const startOfTomorrow = addDays(startOfToday, 1)

    const andConditions: ScheduleWhereInput[] = [
        {
           doctorId : query.doctorId
        },
        {
            isDeleted : false
        },
        {
            status : ScheduleStatus.PUBLISHED
        },
        {
            startDateTime : {
                gte : now,
                lt : startOfTomorrow
            }
        },
        {
            availableSlots : {gt : 0}
        }
    ];

    
     const schedule = await prisma.schedule.findMany({
        where: {
            AND: andConditions
        },
        take: limit,
        skip,
        orderBy: {
            // sortBy : sortOrder
            [sortBy]: sortOrder
        }
       
    })

    const total = await prisma.schedule.count({
        where: {
            AND: andConditions
        }
    })


    return {
        data: schedule,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    }


}
 
export const scheduleService = {
    createSchedule,
    getMySchedules,
    getAllSchedules,
    getScheduleById,
    updateSchedule,
    publicSchedule,
    deleteSchedule,
    getTodaysSchedule
    
}
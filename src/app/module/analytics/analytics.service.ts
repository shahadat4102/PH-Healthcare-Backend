import  httpStatus  from 'http-status';
import { AppointmentStatus, DoctorVerificationStatus, PaymentStatus, ScheduleStatus } from "../../../generated/prisma/enums"
import { prisma } from "../../lib/prisma"
import { RequstUser } from "../../middleware/checkAuth"
import { AppError } from "../../utils/AppError"


const getAdminAnalytics = async () => {

    const totalDoctor = await prisma.doctor.count({

        where : {
            isDeleted : false,

        }
    })

    const totalPaindingDoctorApplicaton = await prisma.doctor.count({

        where : {
            isDeleted: false,
            verificationStatus : DoctorVerificationStatus.PENDING
        }
    })

     const ApprovedDoctor = await prisma.doctor.count({

        where : {
            isDeleted: false,
            verificationStatus : DoctorVerificationStatus.APPROVED
        }
    })


     const rejectedDoctor = await prisma.doctor.count({

        where : {
            isDeleted: false,
            verificationStatus : DoctorVerificationStatus.REJECTED
        }
    })


 // ToTAL PATIENT CODE HERE
      const totalPatient = await prisma.patient.count({

        where : { isDeleted: false,}
    })


//Total Appointments Cound 
     const totalAppointment = await prisma.appointment.count();
 

     const completeAppointment = await prisma.appointment.count({
    where: {
        status: AppointmentStatus.COMPLETED
    }
     })


     const cancelledAppointment = await prisma.appointment.count({
    where: {
        status: AppointmentStatus.CANCELLED
    }
    })


// TotalRevenucResult  ------------------------------------------

 const totalRefundResult = await prisma.payment.aggregate({
       where : {
        status : PaymentStatus.REFUNDED
    },
    _sum : {
        amount : true
    }
 })
 const totalRefund = totalRefundResult._sum.amount?.toNumber() || 0;



 const totalRevenucResult = await prisma.payment.aggregate({
    where : {
        status : PaymentStatus.PAID
    },
    _sum : {
        amount : true
    }
 })
 const totalRevenu = ( totalRevenucResult._sum.amount?.toNumber() || 0) - totalRefund
 




  
  return {
    totalDoctor,
    totalPaindingDoctorApplicaton ,
    ApprovedDoctor,
    rejectedDoctor,
    totalPatient,
    totalAppointment,
    completeAppointment,
    cancelledAppointment,
    totalRefund,
    totalRevenu

  }

  
}

const getPatientAnalytics = async (user: RequstUser) => {
  
 const patient = await prisma.patient.findUnique({
        where : {userId: user.userId},
    })

    if(!patient){
        throw new AppError(httpStatus.NOT_FOUND, "Patient Not Found")
    }

const totalAppointment = await prisma.appointment.count({
    where: {
        patientId: patient.id
    },
}) 


const upComingAppointment = await prisma.appointment.count({
    where: {
        patientId: patient.id,
        status: AppointmentStatus.CONFIRMED
    },
})    


const completedAppointment = await prisma.appointment.count({
    where: {
        patientId: patient.id,
        status: AppointmentStatus.COMPLETED
    },
}) 

const cancelledAppointment = await prisma.appointment.count({
    where: {
        patientId: patient.id,
        status: AppointmentStatus.CANCELLED
    },
})    

//--totalAmountSpentResult &&& totalRefundResult
const totalAmountSpentResult = await prisma.payment.aggregate({
    where: {
        appointment: {
            patientId: patient.id
        },
        status: PaymentStatus.PAID
    },
    _sum: {
        amount: true,
    },
})
const totalAmounSpent = totalAmountSpentResult._sum.amount?.toNumber() || 0;


const totalRefundResult = await prisma.payment.aggregate({
    where: {
        appointment:{
            patientId: patient.id,
        },
        status: PaymentStatus.REFUNDED
    },
    _sum: {
        amount:true
    },
})
const totalRefund = totalRefundResult._sum.amount?.toNumber() || 0;

   return {
    totalAppointment,
    upComingAppointment,
    completedAppointment,
    cancelledAppointment,
    totalAmounSpent,
    totalRefund
    
   }
  
}


const getDoctorAnalytics = async (user: RequstUser) => {

     const doctor = await prisma.doctor.findUnique({
        where: {userId: user.userId }
    })

    if(!doctor){
        throw new AppError(httpStatus.NOT_FOUND, "Doctor Profile Not Found")
    }


//ToTAL SCHEDULE 
const totalSchedule = await prisma.schedule.count({
    where: {
        doctorId: doctor.id,
        isDeleted: false
    }
})    

const publishedSchedule = await prisma.schedule.count({
    where: {
        doctorId: doctor.id,
        isDeleted: false,
        status: ScheduleStatus.PUBLISHED
    }
})  

// Appointment Code Here
const totalAppointment = await prisma.appointment.count({
    where: {
        doctorId: doctor.id
    }
})

const upComingAppointment = await prisma.appointment.count({
    where: {
         doctorId: doctor.id,
        status: AppointmentStatus.CONFIRMED
    },
})    


const ongoingAppointment = await prisma.appointment.count({
    where: {
        doctorId: doctor.id,
        status: AppointmentStatus.ONGOING
    },
}) 

const completedAppointment = await prisma.appointment.count({
    where: {
        doctorId: doctor.id,
        status: AppointmentStatus.COMPLETED
    },
}) 


const cancelledAppointment = await prisma.appointment.count({
    where: {
        doctorId: doctor.id,
        status: AppointmentStatus.CANCELLED
    },
}) 

//

const totalDoctorRefundedResult = await prisma.payment.aggregate({
    where: {
        appointment: {
            doctorId: doctor.id,
        },
        status: PaymentStatus.REFUNDED,
    },
    _sum: {
        amount: true,
    },
});
const totalDoctorRefundedAmount = Number(totalDoctorRefundedResult._sum.amount?.toString() || 0);

const totalDoctorEarningsResult = await prisma.payment.aggregate({
    where: {
        appointment: {
            doctorId: doctor.id,
        },
        status: PaymentStatus.PAID,
    },
    _sum: {
        amount: true,
    },
});
const totalDoctorEarning = (totalDoctorEarningsResult._sum.amount?.toNumber() || 0) - totalDoctorRefundedAmount;


  return {
    totalSchedule,
    publishedSchedule,
    totalAppointment,
    upComingAppointment,
    ongoingAppointment,
    completedAppointment,
    totalDoctorRefundedAmount,
    totalDoctorEarning
  }



}




export const analyticsService = {
    getAdminAnalytics,
    getPatientAnalytics,
    getDoctorAnalytics
} 
import { Appointment } from './../../../generated/prisma/client';

import  httpStatus  from 'http-status';
import { AppointmentStatus, PaymentStatus, Role, ScheduleStatus } from "../../../generated/prisma/enums";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import type { RequstUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { IBookAppointmentPayoad, ICencelAppointmentPayoad, IPayAppointmentPayoad, IUpdateAppointmentPayoad } from './appointment.interface';
import { addMinutes, isBefore, isSameDay, subHours } from 'date-fns';
import { transpost } from "../../lib/nodemailer";
import PDFDocument from 'pdfkit'
import { IQuery } from '../../interfeses';
import { AppointmentWhereInput } from '../../../generated/prisma/models';

// ─── Book Appointment ────────────────────────────────────────────────────────

const bookappointment = async (payload:  IBookAppointmentPayoad, user: RequstUser) => {
	const transactionResult = await prisma.$transaction(async (tx) => {

		// business Logic
		const patient = await prisma.patient.findUnique({
			where : { userId: user.userId }
		});

		if (!patient) {
			throw new AppError(httpStatus.NOT_FOUND, "Patient Not Found");
		}

		const schedule = await prisma.schedule.findUnique({
		where : {id : payload.scheduleId},
		include : {doctor : true}
	})
	if(!schedule || schedule.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND," schelule Not Found");
		
	}
	if(schedule.status !== ScheduleStatus.PUBLISHED){
		throw new AppError(httpStatus.BAD_REQUEST, "This schedule Is Not Published Yet")
	}

	const now = new Date();
	if(!isSameDay(now, schedule.startDateTime)){
		throw new AppError(httpStatus.BAD_REQUEST, "This schedule Is Not Available Today")
	}
  
	if(!isBefore(now, schedule.startDateTime)){
      throw new AppError(httpStatus.BAD_REQUEST, "This schedule Has Already Started")
	}

   
	const ExistingAppointment = await prisma.appointment.findFirst({
		where : {
			patientId : patient.id,
			scheduleId: schedule.id
		}
	})

	if(ExistingAppointment?.status === AppointmentStatus.PENDING){
		throw new AppError(httpStatus.BAD_REQUEST, "Your Already Have A Panding Appointment please Pay For That")
	}

		if(ExistingAppointment?.status === AppointmentStatus.CONFIRMED){
		throw new AppError(httpStatus.BAD_REQUEST, "Your Already Have A Confirmed Appointment ")
	}

	if(ExistingAppointment?.status === AppointmentStatus.ONGOING){
		throw new AppError(httpStatus.BAD_REQUEST, "Your Already Have A Ongoing Appointment ")
	}

	if(ExistingAppointment?.status === AppointmentStatus.COMPLETED){
		throw new AppError(httpStatus.BAD_REQUEST, "Your Already Have Completed Appointment on This Schedule. Please Try Again Anthor Day ")
	}

	if(schedule.availableSlots === 0 ){
		throw new AppError(httpStatus.BAD_REQUEST,"This schedule is Fully Booked")
	}

	if(!schedule.doctor.consultationFee){
		throw new AppError(httpStatus.BAD_REQUEST,"Doctor Has not set a consultation Fee Yet")
	}

	const amount = schedule.doctor.consultationFee.toString();

	// Create appointment with PENDING status
	const appointment = await tx.appointment.create({
		data: {
			status: AppointmentStatus.PENDING,
			patientId: patient.id,
			doctorId: schedule.doctor.id,
			scheduleId: schedule.id,
		},
	});

	const bkashIdToken = await getBkashIdToken();

	if (!bkashIdToken) {
		throw new Error("bKash access token not found");
	}

	// Create bKash payment
	const createPaymentResponse = await fetch(`${config.bkash_base_url}/tokenized/checkout/create`,{

			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				Authorization: bkashIdToken,
				"X-App-Key": config.bkash_app_key,
			},
			body: JSON.stringify({
				mode: "0011",
					payerReference: user.email,
					callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
					amount: amount,
					currency: "BDT",
					intent: "sale",
					merchantInvoiceNumber: appointment.id,
				}),
			},
		);

		const createPaymentResult = await createPaymentResponse.json();

		// Create payment record
		await tx.payment.create({
			data: {
				merchantInvoiceNumber: createPaymentResult.merchantInvoiceNumber,
				appointmentId: appointment.id,
				amount: amount,  
				gatewayResponse: createPaymentResult,
				bkashPaymentId: createPaymentResult.paymentID,
				payerReference: user.email,
			},
		});

		return {
			paymentUrl: createPaymentResult.bkashURL,
		};
	});

	return transactionResult;
};


const payAppointment = async ( payload : IPayAppointmentPayoad, user : RequstUser) => {
    
	const appointmentId = payload.appointmentId 

	const existingappointmentId = await prisma.appointment.findUnique({
		where : {
			id : appointmentId
		},
		include : {
			schedule : {
				include: {
					doctor : true
				}
			}
		}
	})
	if(!existingappointmentId){
		throw new Error("Appointment Does Not Exists")
	}

	if(existingappointmentId.status !== "PENDING"){
		throw new Error("Appointment is Not pending")
	}

	// if(existingappointmentId.status === "CANCELLED" || existingappointmentId.status === "ONGOING" || existingappointmentId.status === "COMPLETED"){
	// 	const appointmentstuts = existingappointmentId.status
	// 	throw new Error(`appointment is already ${appointmentstuts.toLowerCase}`)
	// }
     


	if(!existingappointmentId.schedule.doctor.consultationFee) {
		throw new AppError(httpStatus.BAD_REQUEST, "Doctor Has Not Set A Conusltation Fee Yet")
	}

	 const amount = existingappointmentId.schedule.doctor.consultationFee.toString();
	
		const bkashIdToken = await getBkashIdToken();

		if (!bkashIdToken) {
			throw new Error("bKash access token not found");
		}

		// Create bKash payment
		const createPaymentResponse = await fetch(`${config.bkash_base_url}/tokenized/checkout/create`,{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					Authorization: bkashIdToken,
					"X-App-Key": config.bkash_app_key,
				},
				body: JSON.stringify({
					mode: "0011",
					payerReference: user.email,
					callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
					amount: amount,
					currency: "BDT",
					intent: "sale",
					merchantInvoiceNumber: existingappointmentId.id,
				}),
			},
		);

		const createPaymentResult = await createPaymentResponse.json();

		await prisma.payment.update({
			where : {
					appointmentId : existingappointmentId.id
			},
			data : {
                merchantInvoiceNumber: createPaymentResult.merchantInvoiceNumber,
				gatewayResponse: createPaymentResult,
				bkashPaymentId: createPaymentResult.paymentID,
				
			}
		})
		return {
			paymentUrl: createPaymentResult.bkashURL,
		};

}


const bookappointmentCallback = async (query: Record<string, any>) => {

	const transactionResult = await prisma.$transaction(async (tx) => {

		const paymentId = query.paymentID;

		if (!paymentId) {
			throw new AppError(httpStatus.BAD_REQUEST, "Payment ID is missing");
		}

		const status = query.status;

		if (!status) {
			throw new AppError(httpStatus.BAD_REQUEST, "Payment status is missing");
		}

		const bkashIdToken = await getBkashIdToken();

		if (!bkashIdToken) {
			throw new AppError(httpStatus.BAD_REQUEST,"No bKash access token found");
		}

		// Execute payment with bKash
		const executePaymentResponse = await fetch(`${config.bkash_base_url}/tokenized/checkout/execute`,{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					Authorization: bkashIdToken,
					"X-App-Key": config.bkash_app_key,
				},
				body: JSON.stringify({
					paymentID: paymentId,
				}),
			},
		);

		const executePaymentResult = await executePaymentResponse.json();

		// Get payment record to find appointmentId

		// const paymentRecord = await tx.payment.findFirst({
		// 	where: { bkashPaymentId: paymentId },
		// });

		// if (!paymentRecord) {
		// 	throw new Error("Payment record not found");
		// }

		if (status === "success") {

          const appointment = await prisma.appointment.findUnique({
			where : {
				id : executePaymentResult.merchantInvoiceNumber
			},
			include : {
				schedule : true,
				patient : true,
				doctor : true
			}
		  })

		  if(!appointment){
			throw new AppError(httpStatus.NOT_FOUND, "Appointment Not Found");
		  }

           
		  const alreadyBookSlots = appointment.schedule.totalSlots - appointment.schedule.availableSlots ;
		  const serialNumber = alreadyBookSlots + 1;

		  //start Date Time 3.00, end Date time 4.00
		 const joiningTime = addMinutes(appointment.schedule.startDateTime, (serialNumber - 1) * 20);

			await tx.appointment.update({
				where: { id: executePaymentResult.merchantInvoiceNumber },
				data: { 
					status: AppointmentStatus.CONFIRMED,
					joiningTime,
					serialNumber

				 },
			});


			const newAvailableSlots = appointment.schedule.availableSlots - 1;
			await prisma.schedule.update({
				where : {
					id : appointment.schedule.id
				},
				data : {
					availableSlots : newAvailableSlots
				}
			});


			await tx.payment.update({
				where: { 
					appointmentId: executePaymentResult.merchantInvoiceNumber,
					bkashPaymentId: paymentId 
				},

				data: {
					status: PaymentStatus.PAID,
					bkashTrxId: executePaymentResult.trxID,
					paidAt: executePaymentResult.paymentExecuteTime,
					gatewayResponse: executePaymentResult,
				},
			});

//------------PDF Document Generation-----------------
        const pdfDocumen = new PDFDocument({margin: 50});

		const pdfChunks: Buffer[] = [];

		pdfDocumen.on('data', (chunk : Buffer) => {
			pdfChunks.push(chunk);
		});

		const pdfReadyPromise = new Promise<Buffer>((resolve) => {
			pdfDocumen.on('end', () => {
				resolve(Buffer.concat(pdfChunks));
			});
		});

		pdfDocumen.fontSize(20).text("PH Healthcare System", { align: 'center'});
        pdfDocumen.fontSize(14).text("Appointment Invoice", { align: 'center' });
		pdfDocumen.moveDown(2);

		pdfDocumen.fontSize(12).text(`Patient Name: ${appointment.patient?.name}`);
        pdfDocumen.fontSize(10).text(`Patient Email: ${appointment.patient?.email}`);
		pdfDocumen.moveDown();

		pdfDocumen.fontSize(12).text(`Doctor Name: ${appointment.doctor?.name}`);
        pdfDocumen.text(`specialization: ${appointment.doctor?.specialization}`);
		pdfDocumen.moveDown();


		pdfDocumen.text(`Appointment Date: ${appointment.schedule.startDateTime.toDateString()}`);
		pdfDocumen.text(`Joining Time: ${joiningTime?.toString()}`);
		pdfDocumen.text(`Serial Number: ${serialNumber}`);
		pdfDocumen.text(`Meeting Link: ${appointment.schedule.meetingLink}`);
		pdfDocumen.moveDown();

		pdfDocumen.text(`Amount Paid : $(executePaymentResult.amount)BDT`);
		pdfDocumen.text(`Payment Method : bKash`);
		pdfDocumen.text(`Transaction ID : ${executePaymentResult.trxID}`);
		pdfDocumen.text(`Payment Time : ${executePaymentResult.paymentExecuteTime}`);
		

		pdfDocumen.end();

		const pdfBuffer = await pdfReadyPromise; 


    	await transpost.sendMail({
			from: config.email_sender,
			to: appointment.patient.email,
			subject: "Your Appointment Invoice - PH Healthcare System",
			text : " Thsnk Your for Bookin Appointment with PH Healthcare System. Your Appointment is Confirmed. Please Check Your Dashboard for More Details",
			attachments: [
				{
					filename: 'appointment_invoice.pdf',	
					content: pdfBuffer
				}
			]
		})
		

		return {
			redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=success`,
			};

		} else if (status === "failure") {

			await tx.payment.update({

				where: { bkashPaymentId: paymentId },
				data: {
					status: PaymentStatus.FAILED,
					gatewayResponse: executePaymentResult,
				},
			});

			return {
				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=failure`,
			};

		} else if (status === "cancel") {

			await tx.payment.update({
				where: { bkashPaymentId: paymentId },
				data: {
					status: PaymentStatus.CANCELLED,
					gatewayResponse: executePaymentResult,
				},
			});

			return {
				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=cancel`,
			};

		} else {
			return {
				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?error=payment-failed`,
			};
		}
	},{
		maxWait: 10000,
		timeout: 30000
	});

	return transactionResult;
};


const cencelAppointment = async (payload : ICencelAppointmentPayoad, user :RequstUser ) => {
	
   const transactionResult = await prisma.$transaction(async (tx) => {

    const appointmentId = payload.appointmentId 
	
	const existingappointment = await tx.appointment.findUnique({
		where : {
			id : appointmentId,
			patient : {
				email : user.email
			},
		},
		include : {
			payment : true,
			schedule : true
		}
	})
	if(!existingappointment){
		throw new Error("Appointment Does Not Exists")
	}

	if(existingappointment.status === "ONGOING" || existingappointment.status === "COMPLETED"){
		throw new Error("Appointment ongoing or completed")
	}

	if(existingappointment.status === "CANCELLED"){
		throw new Error("Appointment Already canclled")
	}

	// Update Appointment 
	const updateAppointment = await tx.appointment.update({
		where : {
			id : existingappointment.id
		},
		data : {
			status : AppointmentStatus.CANCELLED
		}
	})

	//schdule available slot update
	await prisma.schedule.update({
		where : {
			id : existingappointment.scheduleId
		},
		data : {
			availableSlots : {increment : 1}
		}
	})

	//now refund Date
	const now = new Date();
    const startDateTime = existingappointment.schedule.startDateTime;

	const refundCoutOfftime = subHours(startDateTime, 1); // 1 hour before the start time
	
	const isEligibleForRefund = isBefore(now, refundCoutOfftime);

    if(isEligibleForRefund){
      
		const bkashIdToken = await getBkashIdToken();

		if (!bkashIdToken) {
			throw new Error("bKash access token not found");
		}

	const bkashRefoundPaymentResponse = await fetch(`${config.bkash_base_url}/tokenized/checkout/payment/refund`,{

			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				Authorization: bkashIdToken,
				"X-App-Key": config.bkash_app_key,
			},
			body: JSON.stringify({
			     paymentID : existingappointment.payment?.bkashPaymentId,
                 trxID : existingappointment.payment?.bkashTrxId,
                 amount : existingappointment.payment?.amount.toString(),
                 sku :"appointment cancellation",
                 reason : "patient cancelled The appointment"
			}),

		});

		const bkashRefundPaymentResult = await bkashRefoundPaymentResponse.json();
        
		 await tx.payment.update({

			where : {
				appointmentId : existingappointment.id
			},
			data : {
				refundTrxId : bkashRefundPaymentResult.refundTrxID,
				refundedAt : bkashRefundPaymentResult.completedTime,
				refundAmount : bkashRefundPaymentResult.amount,
				refundReason : "patient cancelled The appointment",
				status : PaymentStatus.REFUNDED,
				gatewayResponse : bkashRefundPaymentResult
			}
		})

	}
       
	      const newPaymentInfo = await prisma.payment.findUnique({
			where : {
				appointmentId : existingappointment.id
			}
		  })

		 
		return {
			appointment : updateAppointment,
			payment : newPaymentInfo
		}
   })

   return transactionResult

}

// patint appointment service 

const updateAppointmentStatus = async ( AppointmentId: string, payload: IUpdateAppointmentPayoad, user: RequstUser ) => {
       
	const dcotor = await prisma.doctor.findUnique({
		where : {
			userId : user.userId
		}
	})
	if(!dcotor){
		throw new AppError(httpStatus.NOT_FOUND, "Doctor Not Found");
	}


	const appointment = await prisma.appointment.findUnique({
		where : {
			id : AppointmentId,
			doctorId : dcotor.id
		}
	})
	if(!appointment){
		throw new AppError(httpStatus.NOT_FOUND, "Appointment Not Found");
	}

	if(appointment.status === AppointmentStatus.COMPLETED){
		throw new AppError(httpStatus.FORBIDDEN, "Appointment is Already Completed")
	}

	if(appointment.status === AppointmentStatus.CANCELLED){
		throw new AppError(httpStatus.FORBIDDEN, "Appointment is Already Cancelled")
	}

	if(appointment.status === AppointmentStatus.PENDING){
		throw new AppError(httpStatus.FORBIDDEN, "Appointment is Pending. You can change the status after appointment is confirmed")
	}	



	if(appointment.status === AppointmentStatus.CONFIRMED){

		if(payload.status !== "ONGOING"){
			throw new AppError(httpStatus.BAD_REQUEST, "Confirmed Appointment Must Be Ongoing At First")
		}

		await prisma.appointment.update({
			where : {
				id : appointment.id
			},
			data : {
				status : AppointmentStatus.ONGOING
			}
		})

		
	}

	if(appointment.status === AppointmentStatus.ONGOING){

		if(payload.status !== "COMPLETED"){
			throw new AppError(httpStatus.BAD_REQUEST, "Ongoing Appointment Must Be Completed.")

		}

		await prisma.appointment.update({
			where : {
				id : appointment.id
			},
			data : {
				status : AppointmentStatus.COMPLETED
			}
		})
	}	

  
	const updatedAppointment = await prisma.appointment.findUnique({
		where : {
			id : appointment.id
		}
	})

	return updatedAppointment


}


const getMyAppointments = async (query: IQuery, user: RequstUser) => {

	const limit = query.limit ? Number(query.limit) : 10;
    const page = query.page ? Number(query.page) : 1;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ? query.sortBy : "createdAt";
    const sortOrder = query.sortOrder ? query.sortOrder : "desc"


	const patient = await prisma.patient.findUnique({
		where : {
			userId : user.userId
		}
	})
	if(!patient){
		throw new AppError(httpStatus.NOT_FOUND, "Patient Not Found");
	}

	const andConditions: AppointmentWhereInput [] = [
		{
			patientId : patient.id
		}
	];
	if(query.status){
		andConditions.push({
			status : query.status 
		})
	}

	const appointments = await prisma.appointment.findMany({
		where : {AND : andConditions},
		take : limit,
		skip ,
		orderBy : {[sortBy] : sortOrder},
		include : {
			doctor : {select : {id : true, name : true, specialization : true}},
			schedule : true,
			payment : true
		},
		
	})

	const total = await prisma.appointment.count({
		where : {AND : andConditions}
	})

	return { 
		data : appointments,
	    meta : {		
			page,
			limit,
			total,
			totalPages : Math.ceil(total / limit)
		},
	 };


}

const getDcotorAppointments = async (query: IQuery, user: RequstUser) => {

	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  
	const doctor = await prisma.doctor.findUnique({
		where : {
			userId : user.userId
		}
	});
	if(!doctor){
		throw new AppError(httpStatus.NOT_FOUND, "Doctor Profile Not Found");
	}


   const andConditions: AppointmentWhereInput [] = [
		{
			doctorId : doctor.id
		}
	];
	if(query.status){
		andConditions.push({status : query.status })
	}


	const appointments = await prisma.appointment.findMany({
		where : {AND : andConditions},
		take : limit,
		skip ,
		orderBy : {[sortBy] : sortOrder},
		include : {
			patient : {
				select : {id : true, name : true, email : true, contactNumber : true}
			},
			schedule : true,
			payment : true
		},
	});

	const total = await prisma.appointment.count({
		where : {AND : andConditions}
	})

	return {
		data : appointments,
		meta : {
			page,
			limit,
			total,
			totalPages : Math.ceil(total / limit)
		},
	 };

}

const getAllAppointments = async (query: IQuery) => {

	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder ? query.sortOrder : "desc";

	const andConditions: AppointmentWhereInput[] = [];

   if(query.status) {
	andConditions.push({status : query.status})
   }
   
   if(query.doctorId) {
	andConditions.push({ doctorId: query.doctorId })
   }

   if(query.patientId){
	andConditions.push({ patientId: query.patientId })
   }

   if(query.doctorEmail){
	andConditions.push({
		  doctor : {
			email : query.doctorEmail
		  }
	})
   }

   
   if(query.patientEmail){
	andConditions.push({
		  doctor : {
			email : query.patientEmail
		  }
	})
   }



   
	const appointments = await prisma.appointment.findMany({
		where : {AND : andConditions},
		take : limit,
		skip ,
		orderBy : {[sortBy] : sortOrder},
		include : {
			patient : {
				select : {id : true, name : true, email : true, contactNumber : true}
			},
			schedule : true,
			payment : true
		},
	});

	const total = await prisma.appointment.count({
		where : {AND : andConditions}
	})

	return {
		data : appointments,
		meta : {
			page,
			limit,
			total,
			totalPages : Math.ceil(total / limit)
		},
	 };
	
}

const getSingleAppointments = async (appointmentId : string, user: RequstUser) => {

	const appointment = await prisma.appointment.findUnique({
		where: { id : appointmentId },
		include: {
			patient: {
				select: { id: true, name: true, email: true, userId: true }
			},
			doctor: {
				select: { id: true, name: true, email: true, specialization: true, userId: true }
			},
			schedule: true,
			payment: true,
		},
	});

	if (!appointment) {
		throw new AppError(httpStatus.NOT_FOUND, "Appointment Not Found");
	}


	if(user.role === Role.PATIENT){
		if(appointment.patient.userId !== user.userId){
			throw new AppError(httpStatus.FORBIDDEN, "You are not allowed to view This appointment")
		}
	}

	if(user.role === Role.DOCTOR){
		if(appointment.doctor.userId !== user.userId){
			throw new AppError(httpStatus.FORBIDDEN, "You are not allowed to view This appointment")
		}
	}


	return appointment;
}







export const AppointmentService = {
	bookappointment,
	payAppointment,
	bookappointmentCallback,
	cencelAppointment,
	updateAppointmentStatus,
	getMyAppointments,
	getDcotorAppointments,
	getAllAppointments,
	getSingleAppointments,
	
};
  





	// Get payment record to find appointmentId
		
		// const paymentRecord = await tx.payment.findFirst({
		// 	where: { bkashPaymentId: paymentId },
		// });

		// if (!paymentRecord) {
		// 	throw new Error("Payment record not found");
		// }

// 		if (status === "success") {
// 			await tx.appointment.update({
// 				where: { id: paymentRecord.appointmentId },
// 				data: { status: AppointmentStatus.CONFIRMED },
// 			});

// 			await tx.payment.update({
// 				where: { bkashPaymentId: paymentId },
// 				data: {
// 					status: PaymentStatus.PAID,
// 					bkashTrxId: executePaymentResult.trxID,
// 					paidAt: executePaymentResult.paymentExecuteTime,
// 					gatewayResponse: executePaymentResult,
// 				},
// 			});

// 			return {
// 				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=success`,
// 			};
// 		} else if (status === "failure") {
// 			await tx.payment.update({
// 				where: { bkashPaymentId: paymentId },
// 				data: {
// 					status: PaymentStatus.FAILED,
// 					gatewayResponse: executePaymentResult,
// 				},
// 			});

// 			return {
// 				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=failure`,
// 			};
// 		} else if (status === "cancel") {
// 			await tx.payment.update({
// 				where: { bkashPaymentId: paymentId },
// 				data: {
// 					status: PaymentStatus.CANCELLED,
// 					gatewayResponse: executePaymentResult,
// 				},
// 			});

// 			return {
// 				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=cancel`,
// 			};
// 		} else {
// 			return {
// 				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?error=payment-failed`,
// 			};
// 		}
// 	});

// 	return transactionResult;
// };

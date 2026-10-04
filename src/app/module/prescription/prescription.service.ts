import  httpStatus  from 'http-status';
import { prisma } from "../../lib/prisma";
import { RequstUser } from "../../middleware/checkAuth"
import { AppError } from "../../utils/AppError";
import { ICreatePrescriptionPayload } from "./prescription.interface"
import { AppointmentStatus, Role } from '../../../generated/prisma/enums';
import PDFDocument, { resume } from "pdfkit"
import { UploadApiResponse } from 'cloudinary';
import { cloudinary } from '../../lib/cloudinary';
import config from '../../config';
import { transpost } from '../../lib/nodemailer';



const createPrescription = async (payload : ICreatePrescriptionPayload, user: RequstUser) => {
         
    const doctor = await prisma.doctor.findUnique({
			where : { userId: user.userId }
		});

		if (!doctor) {
			throw new AppError(httpStatus.NOT_FOUND, "Doctor Profile Not Found");
		}


      const appointment = await prisma.appointment.findUnique({
			where : { id: payload.appointmentId, doctorId : doctor.id },
            include : {patient: true}
		});

		if (!appointment) {
			throw new AppError(httpStatus.NOT_FOUND, "Appointment Not Found");
		}   
     
        if(appointment.status !== AppointmentStatus.COMPLETED){
            throw new AppError(httpStatus.BAD_REQUEST, "prescription can only Be Written For A Completed Appointment")
        }

        if(appointment.prescriptionUrl) {
            throw new AppError(httpStatus.CONFLICT, "A prescription Already Exists for this Appointment")
        }

        // PDF Document Code Here 
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
     // PDF Contens --------------_____--------------------------------------
         
		pdfDocumen.fontSize(20).text("PH Healthcare System", { align: 'center'});
        pdfDocumen.fontSize(14).text("prescription", { align: 'center' });
		pdfDocumen.moveDown(2);

		pdfDocumen.fontSize(12).text(`Patient Name: ${appointment.patient.name}`);
		pdfDocumen.fontSize(12).text(`Doctor Name: ${doctor.name}`);
        pdfDocumen.text(`specialization: ${doctor.specialization}`);
        pdfDocumen.text(`Date: ${new Date().toDateString()}`);
		pdfDocumen.moveDown();


		pdfDocumen.fontSize(14).text("Findings");
        pdfDocumen.fontSize(12).text(payload.findings);
		pdfDocumen.moveDown();
        
        pdfDocumen.fontSize(14).text("Medicines");
		pdfDocumen.moveDown(0.5);

        for (let i = 0; i < payload.medicines.length; i++){
            const medicine = payload.medicines[i];

            pdfDocumen.fontSize(12).text(`${i + 1}. ${medicine.name}`);
            pdfDocumen.text(` Dosage: ${medicine.dosage}`);
            pdfDocumen.text(` Duration: ${medicine.duration}`);

            if(medicine.instructions) {
                pdfDocumen.text(` Instructions: ${medicine.instructions}`);
            }
            pdfDocumen.moveDown(0.5)
        }  

		pdfDocumen.end();

		const pdfBuffer = await pdfReadyPromise; 


       const UploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
             cloudinary.uploader.upload_stream(
               { resource_type: "raw", format: "pdf" },
               (error, result) => {
                   if (error) return reject(error);
                   if (!result) return reject(new Error("No result returned from Cloudinary"));
                  resolve(result);
               })
              .end(pdfBuffer);
       });

       const updateAppointment = await prisma.appointment.update({
        where: {id: appointment.id},
        data : {
            prescriptionUrl: UploadResult.secure_url,
            prescriptionPublicId: UploadResult.public_id
        }
       })


    await transpost.sendMail({
        from: config.email_sender,
         to: appointment.patient.email,
         subject: "Your prescription - PH Healthcar System",
         text: " Please find your prescription attached",
         attachments : [
            {
                filename: "prescription.pdf",
                content: pdfBuffer,
            }
         ]
         });
 
         return updateAppointment;
        


}

const getSinglePrescripton = async (appointmentId : string, user: RequstUser ) => {

      const appointment = await prisma.appointment.findUnique({
			where : { id : appointmentId },
            include: {
                patient: {select: {id: true , name: true, userId: true}},
                doctor: {select: {id: true , name: true, userId: true}}
            }
		});

		if (!appointment) {
			throw new AppError(httpStatus.NOT_FOUND, "appointment Not Found");
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

            if(!appointment.prescriptionUrl) {
                throw new AppError(httpStatus.NOT_FOUND, "No prescription Has Been Written Yet")
            }

            return {
                appointment,
                prescription: appointment.prescriptionUrl
            }
        




}



export const prescriptinScrvice = {
    createPrescription,
    getSinglePrescripton
}
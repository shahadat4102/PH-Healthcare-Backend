
import cron from 'node-cron';
import {prisma} from './prisma'
import { DoctorVerificationStatus, Role } from '../../generated/prisma/enums';



export const deletUnverifiedDoctor = async () => {

   cron.schedule(' */10 * * * *', async () => {
    
    try {

     const onHourAgo = new Date(Date.now() - 60 * 60 *1000)
     const deletedDoctors =  await prisma.user.deleteMany({
        where : {
            role : Role.DOCTOR,
            emailVerified : false,
            createdAt : {lt : onHourAgo},
            doctor : {
                verificationStatus : DoctorVerificationStatus.PENDING
            }
        }
     })

     if(deletedDoctors.count > 0){
        console.log(`cron : Delete ${deletedDoctors.count} unferified email doctor
            applicatins older than 1 hor`)
     }
        
    } catch (error) {
        console.log("cron: Failed to deleted unveirfied Doctor applocaton ", error)
    }

    console.log("Doctor Delete cron schedul (every 10)")
    
});

}



export interface IBookAppointmentPayoad {
    scheduleId : string
}

export interface IPayAppointmentPayoad {
    appointmentId : string
}

export interface ICencelAppointmentPayoad {
    appointmentId : string
}

export interface IUpdateAppointmentPayoad {
    status : "ONGOING" | "COMPLETED" 
}
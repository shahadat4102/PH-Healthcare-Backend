export interface ICreateOrganizationPayload {
	name: string;
	description?: string;
}

export interface IUpdateOrganizationPayload {
	name?: string;
	description?: string;
}

export interface IAddMemberPayload {
	email: string;
}

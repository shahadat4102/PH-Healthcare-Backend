

export interface IQuery {
    //post model er fields
    // title ?: string;
    // content ?: string

    searchTerm?: string
    page?: string
    limit?: string
    sortOrder?: string
    sortBy?: string


    [key : string] : any
} 
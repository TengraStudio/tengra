export interface ServiceResponse<T = any> {
    success: boolean;
    data?: T;
    result?: T;
    message?: string;
    error?: string;
    details?: any;
}

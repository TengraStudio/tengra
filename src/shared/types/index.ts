export * from './ai'
export * from './chat'
export * from './project'
export * from './ssh'
export * from './system'
export * from './terminal'
export * from './workspace'

export interface ServiceResponse<T = any> {
    success: boolean;
    data?: T;
    result?: T;
    message?: string;
    error?: string;
    details?: any;
}

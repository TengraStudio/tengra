export * from './ai'
export * from './chat'
export * from './project'
export * from './ssh'
export * from './system'
export * from './terminal'
export * from './workspace'
export * from './templates'
export * from './settings'
export * from './quota'
export * from './agent'
export * from './llm-provider-types'
export * from './renderer'
// Export common types
export * from './common';



export interface ServiceResponse<T = void> {
    success: boolean;
    data?: T;
    result?: T;
    content?: T;
    message?: string;
    error?: string;
    details?: string | Record<string, string | number | boolean>;
}

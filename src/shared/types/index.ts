export * from '@/types/agent'
export * from '@/types/ai'
export * from '@/types/chat'
export * from '@/types/llm-provider-types'
export * from '@/types/memory';
export * from '@/types/project'
export * from '@/types/quota'
export * from '@/types/renderer'
export * from '@/types/settings'
export * from '@/types/ssh'
export * from '@/types/system'
export * from '@/types/templates'
export * from '@/types/terminal'
export * from '@/types/workspace'
// Export common types
export * from '@/types/common';



export interface ServiceResponse<T = void> {
    success: boolean;
    data?: T;
    /** @deprecated Use data instead */
    result?: T;
    /** @deprecated Use data instead */
    content?: T;
    message?: string;
    error?: string;
    details?: string | Record<string, string | number | boolean>;
}

export * from './council';
export * from './electron-api.types';
export * from './session-conversation';
export * from './session-domain-apis';
export * from './session-workspace';
export * from './workspace-intelligence';
export * from '@/types/agent';
export * from '@/types/ai';
export * from '@/types/chat';
export * from '@/types/common';
export * from '@/types/db-api';
export * from '@/types/file-diff';
export * from '@/types/ideas';
export * from '@/types/ids';
export * from '@/types/llm-provider-types';
export * from '@/types/memory';
export * from '@/types/model.types';
export * from '@/types/quota';
export * from '@/types/renderer';
export * from '@/types/runtime-manifest';
export * from '@/types/session-engine';
export * from '@/types/settings';
export * from '@/types/ssh';
export * from '@/types/system';
export * from '@/types/templates';
export * from '@/types/terminal';
export * from '@/types/workspace';
export * from '@/types/workspace-agent-session';

export interface ServiceResponse<T = void> {
    success: boolean;
    data?: T;
    /** @deprecated Use data instead */
    result?: T;
    /** @deprecated Use data instead */
    content?: T;
    message?: string;
    messageKey?: string;
    messageParams?: Record<string, string | number>;
    error?: string;
    details?: string | Record<string, string | number | boolean>;
}

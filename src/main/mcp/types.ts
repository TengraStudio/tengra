import { JsonObject, JsonValue } from '@shared/types/common';

export interface McpResult {
    success: boolean
    data?: JsonValue
    error?: string
    messageKey?: string
    messageParams?: Record<string, string | number>
}

export interface McpAction {
    name: string
    description: string
    handler: (args: JsonObject) => Promise<McpResult>
}

export interface McpService {
    name: string
    description: string
    source?: 'core' | 'user'
    actions: McpAction[]
}

export interface McpRegistry {
    services: McpService[]
}

export interface McpDispatchResult extends McpResult {
    service?: string
    action?: string
}

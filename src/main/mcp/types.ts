export interface McpResult {
    success: boolean
    data?: any
    error?: string
}

export interface McpAction {
    name: string
    description: string
    handler: (args: any) => Promise<McpResult>
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

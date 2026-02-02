import { JsonObject } from '@/types/common';

// Basic agent definition
export interface AgentDefinition {
    id: string
    name: string
    description?: string
    systemPrompt: string
    tools?: string[]
    parentModel?: string
    avatar?: string // Optional for UI
}

// Message schema
export interface AgentMessage {
    id: string
    sessionId: string
    sender: string
    content: string
    timestamp: number
    type: 'text' | 'status' | 'code' | 'help'
    metadata?: JsonObject
}

// Log schema (flat structure for storage/history)
export interface AgentLog {
    id: string
    sessionId: string
    agentId: string
    message: string
    timestamp: number
    type: string
}



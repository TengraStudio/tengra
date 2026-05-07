/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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




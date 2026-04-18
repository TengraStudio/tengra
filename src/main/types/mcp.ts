/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * MCP (Model Context Protocol) Types
 * Based on Anthropic's MCP specification
 */

import { JsonObject, JsonValue } from '@shared/types/common';

export interface MCPServerConfig {
    id: string
    name: string
    command: string
    args?: string[]
    env?: Record<string, string>
    enabled: boolean
    extensionType?:
    | 'mcp_server'
    | 'theme'
    | 'command'
    | 'language'
    | 'agent_template'
    | 'widget'
    | 'integration'
    capabilities?: string[]
    dependencies?: string[]
    conflictsWith?: string[]
    sandbox?: {
        enabled?: boolean
        maxMemoryMb?: number
        maxCpuPercent?: number
    }
    storage?: {
        dataPath?: string
        quotaMb?: number
        migrationVersion?: number
    }
    updatePolicy?: {
        channel?: 'stable' | 'beta' | 'alpha'
        autoUpdate?: boolean
        scheduleCron?: string
        signatureSha256?: string
        signatureTimestamp?: number
        lastCheckedAt?: number
        lastUpdatedAt?: number
    }
    settingsSchema?: Record<string, JsonValue>
    settingsValues?: Record<string, JsonValue>
    settingsVersion?: number
    integrityHash?: string
    oauth?: {
        enabled?: boolean
        authUrl?: string
        tokenUrl?: string
        scopes?: string[]
        clientId?: string
    }
    credentials?: {
        provider?: string
        keyRef?: string
        lastRotatedAt?: number
    }
    security?: {
        reviewStatus?: 'pending' | 'approved' | 'rejected'
        securityScore?: number
        malwareFlags?: string[]
        lastScannedAt?: number
    }
    telemetry?: {
        enabled?: boolean
        anonymize?: boolean
        crashReporting?: boolean
        usageCount?: number
        crashCount?: number
        lastCrashAt?: number
    }
}

export interface MCPTool {
    name: string
    description?: string
    inputSchema: {
        type: string
        properties?: JsonObject
        required?: string[]
    }
}

export interface MCPResource {
    uri: string
    name: string
    description?: string
    mimeType?: string
}

export interface MCPPrompt {
    name: string
    description?: string
    arguments?: Array<{
        name: string
        description?: string
        required?: boolean
    }>
}

export interface MCPConnection {
    serverId: string
    status: 'connecting' | 'connected' | 'disconnected' | 'error'
    error?: string
    tools: MCPTool[]
    resources: MCPResource[]
    prompts: MCPPrompt[]
}

export interface MCPServerInfo {
    name: string
    version: string
    capabilities?: {
        tools?: boolean
        resources?: boolean
        prompts?: boolean
    }
}

// JSON-RPC 2.0 types
export interface JSONRPCRequest {
    jsonrpc: '2.0'
    id: number | string
    method: string
    params?: JsonObject
}

export interface JSONRPCResponse {
    jsonrpc: '2.0'
    id: number | string
    result?: JsonValue
    error?: {
        code: number
        message: string
        data?: JsonValue
    }
}

// MCP Methods
export type MCPMethod =
    | 'initialize'
    | 'initialized'
    | 'tools/list'
    | 'tools/call'
    | 'resources/list'
    | 'resources/read'
    | 'prompts/list'
    | 'prompts/get'

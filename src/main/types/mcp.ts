/**
 * MCP (Model Context Protocol) Types
 * Based on Anthropic's MCP specification
 */

import { JsonObject, JsonValue } from '../../shared/types/common'

export interface MCPServerConfig {
    id: string
    name: string
    command: string
    args?: string[]
    env?: Record<string, string>
    enabled: boolean
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

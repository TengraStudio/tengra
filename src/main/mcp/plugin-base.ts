/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { McpDispatchResult, McpService } from '@main/mcp/types';
import { JsonObject } from '@shared/types/common';

/**
 * Interface for an MCP Plugin.
 * Plugins can be internal (compiled-in) or external (separate processes).
 */
export interface IMcpPlugin {
    readonly name: string;
    readonly description: string;
    readonly source: 'core' | 'user' | 'remote';
    readonly version?: string;
    readonly dependencies?: Record<string, string>;

    /** Initialize the plugin (e.g., start process, establish connection) */
    initialize(): Promise<void>;

    /** Shutdown the plugin gracefully */
    dispose(): Promise<void>;

    /** List all available actions/tools in this plugin */
    getActions(): Promise<Array<{ name: string; description: string }>>;

    /** Dispatch a tool call to this plugin */
    dispatch(actionName: string, args: JsonObject): Promise<McpDispatchResult>;

    /** Check if the plugin is currently active and healthy */
    isAlive(): boolean;
}

/**
 * Internal MCP Plugin implementation.
 * Adapts the existing McpService interface to the IMcpPlugin interface.
 */
export class InternalMcpPlugin implements IMcpPlugin {
    public readonly source = 'core';

    constructor(private service: McpService) { }

    get name() { return this.service.name; }
    get description() { return this.service.description ?? this.service.name; }

    async initialize(): Promise<void> {
        // Internal services are already "running" in the main process
    }

    async dispose(): Promise<void> {
        // No-op for internal services
    }

    async getActions() {
        return this.service.actions.map(a => ({
            name: a.name,
            description: a.description ?? a.name
        }));
    }

    async dispatch(actionName: string, args: JsonObject): Promise<McpDispatchResult> {
        const action = this.service.actions.find(a => a.name === actionName);
        if (!action) {
            return { success: false, error: `Unknown action: ${actionName}` };
        }
        try {
            const result = await action.handler(args);
            return { ...result, service: this.name, action: actionName };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }

    isAlive() { return true; }
}

/**
 * Native MCP Plugin implementation.
 * Forwards tool calls to the Rust-based tengra-proxy.
 */
export class NativeMcpPlugin implements IMcpPlugin {
    public readonly source = 'core';

    constructor(
        private proxyService: import('@main/services/proxy/proxy.service').ProxyService,
        public readonly name: string,
        public readonly description: string,
        private actions: Array<{ name: string; description: string }>
    ) { }

    async initialize(): Promise<void> {
        // Native services are managed by the ProxyService lifecycle
    }

    async dispose(): Promise<void> {
        // Managed by ProxyService
    }

    async getActions() {
        return this.actions;
    }

    async dispatch(actionName: string, args: JsonObject): Promise<McpDispatchResult> {
        try {
            interface DispatchResponse {
                success: boolean;
                result?: JsonObject;
                error?: string;
            }

            const response = await this.proxyService.makeRequest<DispatchResponse>(
                '/v0/tools/dispatch',
                await this.proxyService.getRuntimeProxyApiKey(),
                'POST',
                {
                    service: this.name,
                    action: actionName,
                    arguments: args
                }
            ) as DispatchResponse;

            if (response?.success) {
                return { 
                    success: true, 
                    ...(response.result || {}),
                    service: this.name, 
                    action: actionName 
                };
            }

            return { 
                success: false, 
                error: response?.error || 'Unknown native tool error',
                service: this.name,
                action: actionName
            };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : String(error),
                service: this.name,
                action: actionName
            };
        }
    }

    isAlive() {
        return this.proxyService.getEmbeddedProxyStatus().running;
    }
}

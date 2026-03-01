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
    get description() { return this.service.description; }

    async initialize(): Promise<void> {
        // Internal services are already "running" in the main process
    }

    async dispose(): Promise<void> {
        // No-op for internal services
    }

    async getActions() {
        return this.service.actions.map(a => ({
            name: a.name,
            description: a.description
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

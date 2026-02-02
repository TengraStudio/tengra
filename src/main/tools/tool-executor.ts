import { appLogger } from '@main/logging/logger';
import { FileSystemService } from '@main/services/data/filesystem.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { JsonObject, JsonValue } from '@shared/types/common';

export interface InternalToolResult {
    success: boolean;
    result?: JsonValue;
    error?: string;
}

export interface ToolExecutorOptions {
    fileSystem: FileSystemService;
    eventBus: EventBusService;
    command: { executeCommand: (cmd: string, opt?: { cwd?: string }) => Promise<{ success: boolean; stdout?: string; stderr?: string; error?: string }> };
    web: { searchWeb: (q: string) => Promise<{ success: boolean; results?: unknown[]; error?: string }> };
    memory: unknown;
    localImage: unknown;
    screenshot: unknown;
    mcp: { dispatch: (s: string, t: string, a: JsonObject) => Promise<{ success: boolean; data?: unknown; error?: string }> };
    [key: string]: unknown;
}

export class ToolExecutor {
    constructor(private options: ToolExecutorOptions) { }

    async getToolDefinitions() {
        const { toolDefinitions } = await import('./tool-definitions');
        return toolDefinitions;
    }

    async execute(name: string, args: JsonObject): Promise<InternalToolResult> {
        try {
            appLogger.info('ToolExecutor', `Executing tool: ${name}`);
            return await this.routeToolCall(name, args);
        } catch (error) {
            appLogger.error('ToolExecutor', `Error executing tool ${name}`, error as Error);
            return {
                success: false,
                error: (error as Error).message
            };
        }
    }

    private async routeToolCall(name: string, args: JsonObject): Promise<InternalToolResult> {
        if (name === 'update_plan_step' || name === 'propose_plan') {
            return this.handleProjectTool(name, args);
        }

        switch (name) {
            case 'read_file':
                return this.handleFileRead(args);
            case 'write_file':
                return this.handleFileWrite(args);
            case 'list_dir':
                return this.handleListDir(args);
            case 'execute_command':
                return this.handleCommand(args);
            case 'search_web':
                return this.handleWebSearch(args);
            default:
                return this.handleMcpTool(name, args);
        }
    }

    private async handleProjectTool(name: string, args: JsonObject): Promise<InternalToolResult> {
        switch (name) {
            case 'update_plan_step': {
                const index = Number(args['index']);
                const status = String(args['status']) as 'pending' | 'running' | 'completed' | 'failed';
                const message = args['message'] ? String(args['message']) : undefined;

                this.options.eventBus.emit('project:step-update', { index, status, message });
                return { success: true };
            }
            case 'propose_plan': {
                const steps = Array.isArray(args['steps']) ? args['steps'] : [];
                if (steps.length === 0) {
                    return { success: false, error: 'Plan must have at least one step' };
                }

                this.options.eventBus.emit('project:plan-proposed', { steps: steps.map(String) });
                return { success: true };
            }
            default:
                return { success: false, error: `Unknown project tool: ${name}` };
        }
    }

    private async handleFileRead(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['path'] !== 'string') { return { success: false, error: "Missing 'path' argument" }; }
        const path = args['path'];
        try {
            const content = await this.options.fileSystem.readFile(path);
            return { success: true, result: content as unknown as JsonValue };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    }

    private async handleFileWrite(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['path'] !== 'string') { return { success: false, error: "Missing 'path' argument" }; }
        if (typeof args['content'] !== 'string') { return { success: false, error: "Missing 'content' argument" }; }
        const path = args['path'];
        const content = args['content'];
        try {
            await this.options.fileSystem.writeFile(path, content);
            return { success: true };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    }

    private async handleListDir(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['path'] !== 'string') { return { success: false, error: "Missing 'path' argument" }; }
        const path = args['path'];
        try {
            const files = await this.options.fileSystem.listDirectory(path);
            return { success: true, result: files as unknown as JsonValue };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    }

    private async handleCommand(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['command'] !== 'string') { return { success: false, error: "Missing 'command' argument" }; }
        const command = args['command'];
        const cwd = (typeof args['cwd'] === 'string') ? args['cwd'] : undefined;
        try {
            const result = await this.options.command.executeCommand(command, { cwd });
            return { success: result.success, result: result.stdout as JsonValue, error: (result.stderr ?? result.error) ?? undefined };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    }

    private async handleWebSearch(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['query'] !== 'string') { return { success: false, error: "Missing 'query' argument" }; }
        const query = args['query'];
        try {
            const result = await this.options.web.searchWeb(query);
            return { success: result.success, result: result.results as JsonValue, error: result.error ?? undefined };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    }

    private async handleMcpTool(name: string, args: JsonObject): Promise<InternalToolResult> {
        try {
            let server = 'default';
            let tool = name;

            if (name.includes(':')) {
                const parts = name.split(':');
                server = parts[0] ?? 'default';
                tool = parts[1] ?? name;
            }

            const result = await this.options.mcp.dispatch(server, tool, args);
            return {
                success: result.success,
                result: result.data as JsonValue,
                error: result.error ?? undefined
            };
        } catch (e) {
            return { success: false, error: `MCP execution failed: ${String(e)}` };
        }
    }
}

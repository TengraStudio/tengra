import { appLogger } from '@main/logging/logger';
import { McpDispatcher } from '@main/mcp/dispatcher';
import { MonitoringService } from '@main/services/analysis/monitoring.service';
import { PageSpeedService } from '@main/services/analysis/pagespeed.service';
import { ScannerService } from '@main/services/analysis/scanner.service';
import { FileManagementService } from '@main/services/data/file.service';
import { FileSystemService } from '@main/services/data/filesystem.service';
import { ContentService } from '@main/services/external/content.service';
import { UtilityService } from '@main/services/external/utility.service';
import { WebService } from '@main/services/external/web.service';
import { EmbeddingService } from '@main/services/llm/embedding.service';
import { LLMService } from '@main/services/llm/llm.service';
import { LocalImageService } from '@main/services/llm/local-image.service';
import { MemoryService } from '@main/services/llm/memory.service';
import { DockerService } from '@main/services/project/docker.service';
import { GitService } from '@main/services/project/git.service';
import { SSHService } from '@main/services/project/ssh.service';
import { SecurityService } from '@main/services/security/security.service';
import { CommandService } from '@main/services/system/command.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { NetworkService } from '@main/services/system/network.service';
import { SystemService } from '@main/services/system/system.service';
import { ClipboardService } from '@main/services/ui/clipboard.service';
import { NotificationService } from '@main/services/ui/notification.service';
import { ScreenshotService } from '@main/services/ui/screenshot.service';
import { JsonObject, JsonValue } from '@shared/types/common';

export interface InternalToolResult {
    success: boolean;
    result?: JsonValue;
    error?: string;
}

export interface ToolExecutorOptions {
    fileSystem: FileSystemService;
    eventBus: EventBusService;
    command: CommandService;
    web: WebService;
    docker: DockerService;
    ssh: SSHService;
    scanner: ScannerService;
    embedding: EmbeddingService;
    memory: MemoryService;
    localImage: LocalImageService;
    screenshot: ScreenshotService;
    system: SystemService;
    network: NetworkService;
    notification: NotificationService;
    utility: UtilityService;
    content: ContentService;
    file: FileManagementService;
    monitor: MonitoringService;
    clipboard: ClipboardService;
    git: GitService;
    security: SecurityService;
    mcp: McpDispatcher;
    llm: LLMService;
    pageSpeed: PageSpeedService;
}

export class ToolExecutor {
    constructor(private options: ToolExecutorOptions) { }

    async getToolDefinitions() {
        const { toolDefinitions } = await import('./tool-definitions');

        // Add MCP tools if available
        if (this.options.mcp) {
            const mcpTools = await this.options.mcp.getToolDefinitions();
            return [...toolDefinitions, ...mcpTools];
        }

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

        const handlers: Partial<Record<string, (toolArgs: JsonObject) => Promise<InternalToolResult>>> = {
            read_file: (toolArgs) => this.handleFileRead(toolArgs),
            write_file: (toolArgs) => this.handleFileWrite(toolArgs),
            list_directory: (toolArgs) => this.handleListDir(toolArgs),
            list_dir: (toolArgs) => this.handleListDir(toolArgs),
            file_exists: (toolArgs) => this.handleFileExists(toolArgs),
            get_file_info: (toolArgs) => this.handleGetFileInfo(toolArgs),
            create_directory: (toolArgs) => this.handleCreateDirectory(toolArgs),
            delete_file: (toolArgs) => this.handleDeleteFile(toolArgs),
            copy_file: (toolArgs) => this.handleCopyFile(toolArgs),
            move_file: (toolArgs) => this.handleMoveFile(toolArgs),
            execute_command: (toolArgs) => this.handleCommand(toolArgs),
            search_web: (toolArgs) => this.handleWebSearch(toolArgs),
            get_system_info: () => this.handleSystemInfo()
        };

        const handler = handlers[name];
        if (handler) {
            return handler(args);
        }

        return this.handleMcpTool(name, args);
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
            const response = await this.options.fileSystem.readFile(path);
            if (!response.success || typeof response.data !== 'string') {
                return { success: false, error: response.error ?? 'Failed to read file' };
            }
            return { success: true, result: response.data };
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
            const response = await this.options.fileSystem.listDirectory(path);
            if (!response.success || !response.data) {
                return { success: false, error: response.error ?? 'Failed to list directory' };
            }
            return { success: true, result: response.data };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    }

    private async handleFileExists(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['path'] !== 'string') { return { success: false, error: "Missing 'path' argument" }; }
        const path = args['path'];
        try {
            const response = await this.options.fileSystem.fileExists(path);
            return { success: true, result: response.exists };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    }

    private async handleGetFileInfo(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['path'] !== 'string') { return { success: false, error: "Missing 'path' argument" }; }
        const path = args['path'];
        try {
            const response = await this.options.fileSystem.getFileInfo(path);
            if (!response.success || !response.data) {
                return { success: false, error: response.error ?? 'Failed to get file info' };
            }
            return { success: true, result: response.data };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    }

    private async handleCreateDirectory(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['path'] !== 'string') { return { success: false, error: "Missing 'path' argument" }; }
        const path = args['path'];
        try {
            const response = await this.options.fileSystem.createDirectory(path);
            return { success: response.success, error: response.error ?? undefined };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    }

    private async handleDeleteFile(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['path'] !== 'string') { return { success: false, error: "Missing 'path' argument" }; }
        const path = args['path'];
        try {
            const response = await this.options.fileSystem.deleteFile(path);
            return { success: response.success, error: response.error ?? undefined };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    }

    private async handleCopyFile(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['source'] !== 'string') { return { success: false, error: "Missing 'source' argument" }; }
        if (typeof args['destination'] !== 'string') { return { success: false, error: "Missing 'destination' argument" }; }

        try {
            const response = await this.options.fileSystem.copyFile(args['source'], args['destination']);
            return { success: response.success, error: response.error ?? undefined };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    }

    private async handleMoveFile(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['source'] !== 'string') { return { success: false, error: "Missing 'source' argument" }; }
        if (typeof args['destination'] !== 'string') { return { success: false, error: "Missing 'destination' argument" }; }

        try {
            const response = await this.options.fileSystem.moveFile(args['source'], args['destination']);
            return { success: response.success, error: response.error ?? undefined };
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
            return {
                success: result.success,
                result: result.stdout ?? '',
                error: (result.stderr ?? result.error) ?? undefined
            };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    }

    private async handleWebSearch(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['query'] !== 'string') { return { success: false, error: "Missing 'query' argument" }; }
        const query = args['query'];
        try {
            const result = await this.options.web.searchWeb(query);
            return { success: result.success, result: result.results ?? [], error: result.error ?? undefined };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    }

    private async handleSystemInfo(): Promise<InternalToolResult> {
        try {
            const info = await this.options.system.getSystemInfo();
            return { success: true, result: info as JsonValue };
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
                result: result.data ?? null,
                error: result.error ?? undefined
            };
        } catch (e) {
            return { success: false, error: `MCP execution failed: ${String(e)}` };
        }
    }
}

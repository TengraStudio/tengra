import { appLogger } from '@main/logging/logger';
import { McpDispatcher } from '@main/mcp/dispatcher';
import { MonitoringService as MonitorService } from '@main/services/analysis/monitoring.service';
import { PageSpeedService } from '@main/services/analysis/pagespeed.service';
import { ScannerService } from '@main/services/analysis/scanner.service';
import { FileManagementService as FileService } from '@main/services/data/file.service';
import { FileSystemService } from '@main/services/data/filesystem.service';
import { ContentService } from '@main/services/external/content.service';
import { UtilityService } from '@main/services/external/utility.service';
import { WebService } from '@main/services/external/web.service';
import { EmbeddingService } from '@main/services/llm/embedding.service';
import { LLMService } from '@main/services/llm/llm.service';
import { MemoryService } from '@main/services/llm/memory.service';
import { DockerService } from '@main/services/project/docker.service';
import { GitService } from '@main/services/project/git.service';
import { SSHService as SshService } from '@main/services/project/ssh.service';
import { SecurityService } from '@main/services/security/security.service';
import { CommandService } from '@main/services/system/command.service';
import { NetworkService } from '@main/services/system/network.service';
import { SystemService } from '@main/services/system/system.service';
import { ClipboardService } from '@main/services/ui/clipboard.service';
import { NotificationService } from '@main/services/ui/notification.service';
import { ScreenshotService } from '@main/services/ui/screenshot.service';
import { toolDefinitions } from '@main/tools/tool-definitions';
import { JsonObject, JsonValue } from '@shared/types';
import type { ToolDefinition } from '@shared/types/chat';

interface ToolResult {
    success: boolean
    result?: JsonValue
    error?: string
}

interface ToolExecutorOptions {
    fileSystem: FileSystemService,
    command: CommandService,
    web: WebService,
    screenshot: ScreenshotService,
    system: SystemService,
    network: NetworkService,
    notification: NotificationService,
    docker: DockerService,
    ssh: SshService,
    scanner: ScannerService,
    embedding: EmbeddingService,
    utility: UtilityService,
    content: ContentService,
    file: FileService,
    monitor: MonitorService,
    clipboard: ClipboardService,
    git: GitService,
    security: SecurityService,
    mcp: McpDispatcher,
    llm: LLMService,
    memory: MemoryService,
    pageSpeed: PageSpeedService
}

export class ToolExecutor {
    constructor(
        private options: ToolExecutorOptions,
    ) { }

    async getToolDefinitions(): Promise<ToolDefinition[]> {
        const nativeTools = toolDefinitions as ToolDefinition[];
        let mcpTools: ToolDefinition[] = [];
        try {
            mcpTools = await this.options.mcp.getToolDefinitions();
        } catch (e) {
            appLogger.error('ToolExecutor', `Failed to get MCP tool definitions: ${e}`);
        }

        let pageSpeedTool: ToolDefinition | undefined;
        try {
            // Accessing the proxy method returns a promise
            pageSpeedTool = this.options.pageSpeed.getToolDefinition() as ToolDefinition;
        } catch (e) {
            appLogger.error('ToolExecutor', `Failed to get PageSpeed tool definition: ${e}`);
        }

        const tools = [...nativeTools, ...mcpTools];
        if (pageSpeedTool) {
            tools.push(pageSpeedTool);
        }
        return tools;
    }

    private asString(value: JsonValue | undefined): string {
        return typeof value === 'string' ? value : '';
    }

    private toText(value: JsonValue | undefined): string {
        if (typeof value === 'string') { return value; }
        if (typeof value === 'number' || typeof value === 'boolean') { return String(value); }
        if (value === null || value === undefined) { return ''; }
        try {
            return JSON.stringify(value);
        } catch {
            return '';
        }
    }

    async execute(toolName: string | JsonObject, args: JsonObject): Promise<ToolResult> {
        try {
            const normalizedName = typeof toolName === 'string'
                ? toolName
                : (typeof toolName.name === 'string' ? toolName.name : '');

            if (!normalizedName) {
                return { success: false, error: 'Invalid tool name' };
            }

            if (['read_file', 'write_file', 'list_directory', 'create_directory', 'delete_file', 'file_exists'].includes(normalizedName)) {
                return this.handleFileSystemTool(normalizedName, args);
            }

            if (['fetch_webpage', 'search_web'].includes(normalizedName)) {
                return this.handleWebTool(normalizedName, args);
            }

            if (['remember', 'recall', 'forget'].includes(normalizedName)) {
                return this.handleMemoryTool(normalizedName, args);
            }

            return this.handleMiscTool(normalizedName, args);
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    private async handleFileSystemTool(name: string, args: JsonObject): Promise<ToolResult> {
        const getString = (v: JsonValue | undefined) => this.asString(v);
        switch (name) {
            case 'read_file': {
                const res = await this.options.fileSystem.readFile(getString(args.path));
                return { success: res.success, result: res.data, error: res.error };
            }
            case 'write_file': {
                const res = await this.options.fileSystem.writeFile(getString(args.path), this.toText(args.content));
                return { success: res.success, error: res.error };
            }
            case 'list_directory': {
                const res = await this.options.fileSystem.listDirectory(getString(args.path));
                return { success: res.success, result: res.data as JsonValue, error: res.error };
            }
            case 'create_directory': {
                const res = await this.options.fileSystem.createDirectory(getString(args.path));
                return { success: res.success, error: res.error };
            }
            case 'delete_file': {
                const res = await this.options.fileSystem.deleteFile(getString(args.path));
                return { success: res.success, error: res.error };
            }
            case 'file_exists': {
                const res = await this.options.fileSystem.fileExists(getString(args.path));
                return { success: true, result: res.exists };
            }
            default: return { success: false, error: `Unknown fs tool: ${name}` };
        }
    }

    private async handleWebTool(name: string, args: JsonObject): Promise<ToolResult> {
        const getString = (v: JsonValue | undefined) => this.asString(v);
        switch (name) {
            case 'fetch_webpage': {
                const res = await this.options.web.fetchWebPage(getString(args.url));
                return { success: res.success, result: res.content, error: res.error };
            }
            case 'search_web': {
                const res = await this.options.web.searchWeb(getString(args.query));
                return { success: res.success, result: res.results as JsonValue, error: res.error };
            }
            default: return { success: false, error: `Unknown web tool: ${name}` };
        }
    }

    private async handleMemoryTool(name: string, args: JsonObject): Promise<ToolResult> {
        const getString = (v: JsonValue | undefined) => this.asString(v);
        switch (name) {
            case 'remember': {
                const fact = getString(args.fact);
                const tags = Array.isArray(args.tags) ? args.tags.map(t => String(t)) : [];
                const res = await this.options.memory.rememberFact(fact, 'user', 'global', tags);
                return { success: true, result: res as JsonValue };
            }
            case 'recall': {
                const res = await this.options.memory.recallRelevantFacts(getString(args.query));
                return { success: true, result: res as JsonValue };
            }
            case 'forget': {
                const success = await this.options.memory.forgetFact(getString(args.fact_id));
                return { success };
            }
            default: return { success: false, error: `Unknown memory tool: ${name}` };
        }
    }

    private async handleMiscTool(name: string, args: JsonObject): Promise<ToolResult> {
        const getString = (v: JsonValue | undefined) => this.asString(v);
        switch (name) {
            case 'execute_command': {
                const res = await this.options.command.executeCommand(getString(args.command), { cwd: getString(args.cwd) });
                return { success: res.success, result: res.stdout, error: res.error ?? res.stderr };
            }
            case 'capture_screenshot': {
                const res = await this.options.screenshot.captureScreen();
                return { success: res.success, result: res.image, error: res.error };
            }
            default:
                // Try MCP tools if native tool not found
                if (name.startsWith('mcp__')) {
                    const parts = name.split('__');
                    if (parts.length >= 3) {
                        const serviceName = parts[1];
                        const actionName = parts.slice(2).join('__');
                        const mcpResult = await this.options.mcp.dispatch(serviceName, actionName, args);
                        return { success: mcpResult.success, result: mcpResult.data as JsonValue, error: mcpResult.error };
                    }
                }
                return { success: false, error: `Unknown tool: ${name}` };
        }
    }
}

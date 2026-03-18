import { randomUUID } from 'crypto';

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
import { SecurityService } from '@main/services/security/security.service';
import { CommandService } from '@main/services/system/command.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { NetworkService } from '@main/services/system/network.service';
import { SystemService } from '@main/services/system/system.service';
import { ClipboardService } from '@main/services/ui/clipboard.service';
import { NotificationService } from '@main/services/ui/notification.service';
import { ScreenshotService } from '@main/services/ui/screenshot.service';
import { DockerService } from '@main/services/workspace/docker.service';
import { GitService } from '@main/services/workspace/git.service';
import { SSHService } from '@main/services/workspace/ssh.service';
import { SESSION_RUNTIME_EVENTS } from '@shared/constants/session-runtime-events';
import { JsonObject, JsonValue } from '@shared/types/common';
import { WorkspaceStep, WorkspaceStepStatus } from '@shared/types/council';

export interface InternalToolResult {
    success: boolean;
    result?: JsonValue;
    error?: string;
    errorType?: 'timeout' | 'limit' | 'permission' | 'notFound' | 'unknown';
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

export interface ToolExecutionContext {
    taskId?: string;
    workspaceId?: string;
    timeoutMs?: number;
}

export class ToolExecutor {
    private static readonly DEFAULT_TIMEOUT_MS = 30000;
    private static readonly TOOL_TIMEOUT_MS: Partial<Record<string, number>> = {
        generate_image: 120000,
    };

    private idempotentTools = new Set([
        'read_file',
        'list_directory',
        'list_dir',
        'file_exists',
        'get_file_info',
        'get_system_info',
        'search_web'
    ]);

    private toolCache = new Map<string, { result: InternalToolResult; timestamp: number }>();
    private readonly CACHE_TTL = 30000; // 30 seconds

    constructor(private options: ToolExecutorOptions) { }

    private async raceWithTimeout<T>(
        operation: Promise<T>,
        timeoutMs: number,
        timeoutMessage: string
    ): Promise<T> {
        let timer: ReturnType<typeof setTimeout> | null = null;
        const timeoutPromise = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
            if (timer?.unref) { timer.unref(); }
        });

        try {
            return await Promise.race([operation, timeoutPromise]);
        } finally {
            if (timer !== null) {
                clearTimeout(timer);
            }
        }
    }

    async getToolDefinitions() {
        const { toolDefinitions } = await import('./tool-definitions');

        // Add MCP tools if available
        if (this.options.mcp) {
            const mcpTools = await this.options.mcp.getToolDefinitions();
            return [...toolDefinitions, ...mcpTools];
        }

        return toolDefinitions;
    }

    async execute(name: string, args: JsonObject, context?: ToolExecutionContext): Promise<InternalToolResult> {
        const timeoutMs = context?.timeoutMs ?? this.resolveTimeoutMs(name);

        // AGT-10: Caching for idempotent tools
        if (this.idempotentTools.has(name)) {
            const cacheKey = `${name}:${JSON.stringify(args)}`;
            const cached = this.toolCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
                appLogger.info('ToolExecutor', `Cache hit for tool: ${name}`);
                return cached.result;
            }
        }

        try {
            appLogger.info('ToolExecutor', `Executing tool: ${name} (taskId: ${context?.taskId ?? 'none'}, timeout: ${timeoutMs}ms)`);

            const executionPromise = this.routeToolCall(name, args, context);

            if (timeoutMs <= 0) {
                return await executionPromise;
            }

            const result = await this.raceWithTimeout(
                executionPromise,
                timeoutMs,
                `Tool execution timed out after ${timeoutMs}ms`
            ) as InternalToolResult;

            // AGT-10: Update cache for idempotent tools
            if (result.success && this.idempotentTools.has(name)) {
                const cacheKey = `${name}:${JSON.stringify(args)}`;
                this.toolCache.set(cacheKey, { result, timestamp: Date.now() });
            }

            return result;
        } catch (error) {
            const errorMessage = (error as Error).message;
            const isTimeout = errorMessage.includes('timed out');

            appLogger.error('ToolExecutor', `Error executing tool ${name}`, error as Error);

            return {
                success: false,
                error: errorMessage,
                errorType: isTimeout ? 'timeout' : 'unknown'
            };
        }
    }

    private resolveTimeoutMs(name: string): number {
        return ToolExecutor.TOOL_TIMEOUT_MS[name] ?? ToolExecutor.DEFAULT_TIMEOUT_MS;
    }

    private async routeToolCall(name: string, args: JsonObject, context?: ToolExecutionContext): Promise<InternalToolResult> {
        try {
            if (name === 'update_plan_step' || name === 'propose_plan' || name === 'revise_plan') {
                return await this.handleWorkspaceTool(name, args, context);
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
                get_system_info: () => this.handleSystemInfo(),
                generate_image: (toolArgs) => this.handleGenerateImage(toolArgs),
            };

            const handler = handlers[name];
            let result: InternalToolResult;

            if (handler) {
                result = await handler(args);
            } else {
                result = await this.handleMcpTool(name, args);
            }

            // Categorize errors if result failed but didn't throw
            if (!result.success && result.error && !result.errorType) {
                result.errorType = this.categorizeError(result.error);
            }

            return result;
        } catch (error) {
            const errorMessage = (error as Error).message;
            return {
                success: false,
                error: errorMessage,
                errorType: this.categorizeError(errorMessage)
            };
        }
    }

    private categorizeError(message: string): InternalToolResult['errorType'] {
        const msg = message.toLowerCase();
        if (msg.includes('permission') || msg.includes('access denied') || msg.includes('eacces')) {
            return 'permission';
        }
        if (msg.includes('not found') || msg.includes('enoent') || msg.includes('does not exist')) {
            return 'notFound';
        }
        if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('429')) {
            return 'limit';
        }
        if (msg.includes('timeout') || msg.includes('timed out')) {
            return 'timeout';
        }
        return 'unknown';
    }

    private async handleWorkspaceTool(name: string, args: JsonObject, context?: ToolExecutionContext): Promise<InternalToolResult> {
        const taskId = context?.taskId;

        switch (name) {
            case 'update_plan_step': {
                const index = Number(args['index']);
                const status = String(args['status']) as WorkspaceStepStatus;
                const message = args['message'] ? String(args['message']) : undefined;

                this.options.eventBus.emit(SESSION_RUNTIME_EVENTS.AUTOMATION_STEP_UPDATE, {
                    index,
                    status,
                    message,
                    taskId,
                });
                return { success: true };
            }
            case 'propose_plan': {
                const steps = Array.isArray(args['steps']) ? args['steps'] : [];
                if (steps.length === 0) {
                    return { success: false, error: 'Plan must have at least one step' };
                }

                this.options.eventBus.emit(SESSION_RUNTIME_EVENTS.AUTOMATION_PLAN_PROPOSED, {
                    steps: this.normalizeProposedSteps(steps),
                    taskId,
                });
                return { success: true };
            }
            case 'revise_plan': {
                // AGT-PLN-02: Dynamic plan revision mid-execution
                const action = String(args['action']) as 'add' | 'remove' | 'modify' | 'insert';
                const index = args['index'] !== undefined ? Number(args['index']) : undefined;
                const stepText = args['step_text'] ? String(args['step_text']) : undefined;
                const reason = args['reason'] ? String(args['reason']) : 'No reason provided';

                // Validate required args based on action
                if ((action === 'add' || action === 'modify' || action === 'insert') && !stepText) {
                    return { success: false, error: `Action '${action}' requires 'step_text' argument` };
                }
                if ((action === 'remove' || action === 'modify' || action === 'insert') && index === undefined) {
                    return { success: false, error: `Action '${action}' requires 'index' argument` };
                }

                this.options.eventBus.emit(SESSION_RUNTIME_EVENTS.AUTOMATION_PLAN_REVISED, {
                    action,
                    index,
                    stepText,
                    reason,
                    taskId,
                });
                return { success: true, result: { message: `Plan revision '${action}' applied: ${reason}` } };
            }
            default:
                return { success: false, error: `Unknown workspace tool: ${name}` };
        }
    }

    private normalizeProposedSteps(steps: JsonValue[]): Array<string | WorkspaceStep> {
        const normalized: Array<string | WorkspaceStep> = [];
        for (const step of steps) {
            if (typeof step === 'string') {
                normalized.push(step);
                continue;
            }
            if (step && typeof step === 'object' && !Array.isArray(step)) {
                const stepObject = step as Record<string, JsonValue>;
                const textValue = stepObject['text'];
                if (typeof textValue !== 'string' || textValue.trim().length === 0) {
                    continue;
                }
                const normalizedStep: WorkspaceStep = {
                    id: randomUUID(),
                    text: textValue,
                    status: 'pending',
                    type: 'task',
                    dependsOn: [],
                    priority: 'normal',
                    parallelLane: 0,
                };
                const typeValue = stepObject['type'];
                if (typeValue === 'task' || typeValue === 'fork' || typeValue === 'join') {
                    normalizedStep.type = typeValue;
                }
                const priorityValue = stepObject['priority'];
                if (
                    priorityValue === 'low' ||
                    priorityValue === 'normal' ||
                    priorityValue === 'high' ||
                    priorityValue === 'critical'
                ) {
                    normalizedStep.priority = priorityValue;
                }
                const dependsOnValue = stepObject['depends_on'];
                if (Array.isArray(dependsOnValue)) {
                    normalizedStep.dependsOn = dependsOnValue
                        .filter((dep): dep is string => typeof dep === 'string')
                        .map(dep => dep.trim())
                        .filter(dep => dep.length > 0);
                }
                const branchId = stepObject['branch_id'];
                if (typeof branchId === 'string' && branchId.trim().length > 0) {
                    normalizedStep.branchId = branchId.trim();
                }
                const lane = stepObject['lane'];
                if (typeof lane === 'number' && Number.isFinite(lane)) {
                    normalizedStep.parallelLane = lane;
                }
                normalized.push(normalizedStep);
            }
        }
        return normalized;
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

    private async handleGenerateImage(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['prompt'] !== 'string' || args['prompt'].trim().length === 0) {
            return { success: false, error: "Missing 'prompt' argument" };
        }

        const requestedCount = typeof args['count'] === 'number' && Number.isFinite(args['count'])
            ? Math.floor(args['count'])
            : 1;
        const imageCount = Math.max(1, Math.min(requestedCount, 5));
        const images: string[] = [];

        try {
            for (let index = 0; index < imageCount; index += 1) {
                const imagePath = await this.options.localImage.generateImage({
                    prompt: args['prompt'],
                });
                images.push(imagePath);
            }
            return { success: true, result: { images } };
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


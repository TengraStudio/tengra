/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { McpDispatcher } from '@main/mcp/dispatcher';
import { FileManagementService } from '@main/services/data/file.service';
import { FileSystemService } from '@main/services/data/filesystem.service';
import { WebService } from '@main/services/external/web.service';
import { EmbeddingService } from '@main/services/llm/embedding.service';
import { LLMService } from '@main/services/llm/llm.service';
import { LocalImageService } from '@main/services/llm/local/local-image.service';
import { MemoryService } from '@main/services/llm/memory.service';
import { SecurityService } from '@main/services/security/security.service';
import { CommandService } from '@main/services/system/command.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { NetworkService } from '@main/services/system/network.service';
import { SystemService } from '@main/services/system/system.service';
import { DockerService } from '@main/services/workspace/docker.service';
import { GitService } from '@main/services/workspace/git.service';
import { SSHService } from '@main/services/workspace/ssh.service';
import { TerminalService } from '@main/services/workspace/terminal.service';
import { validateCommand } from '@main/utils/command-validator.util';
import { SESSION_RUNTIME_EVENTS } from '@shared/constants/session-runtime-events';
import { ToolDefinition } from '@shared/types/chat';
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
    embedding: EmbeddingService;
    memory: MemoryService;
    localImage: LocalImageService;
    system: SystemService;
    network: NetworkService;
    file: FileManagementService;
    git: GitService;
    security: SecurityService;
    mcp: McpDispatcher;
    llm: LLMService;
    terminal: TerminalService;
}

export interface ToolExecutionContext {
    taskId?: string;
    workspaceId?: string;
    timeoutMs?: number;
}

export class ToolExecutor {
    private static readonly DEFAULT_TIMEOUT_MS = 30000;
    private static readonly MAX_BATCH_WRITE_FILES = 50;
    private static readonly MAX_BATCH_READ_FILES = 20;
    private static readonly MAX_PATCH_EDITS = 20;
    private static readonly MAX_SEARCH_RESULTS = 200;
    private static readonly MAX_TERMINAL_WRITE_SIZE = 20000;
    private static readonly MAX_TERMINAL_READ_BYTES = 60000;
    private static readonly MAX_TERMINAL_WAIT_MS = 120000;
    private static readonly TERMINAL_POLL_INTERVAL_MS = 250;
    private static readonly MAX_TOOL_CACHE_ENTRIES = 200;
    private static readonly TOOL_DEFINITIONS_CACHE_TTL_MS = 5000;
    private static readonly TOOL_TIMEOUT_MS: Partial<Record<string, number>> = {
        execute_command: 180000,
        'mcp__terminal__run_command': 180000,
        generate_image: 120000,
        terminal_session_wait: 125000,
    };
    private static readonly MCP_COMPAT_ALIASES: Record<string, string> = {
        read_file: 'mcp__filesystem__read',
        write_file: 'mcp__filesystem__write',
        list_directory: 'mcp__filesystem__list',
        list_dir: 'mcp__filesystem__list',
        execute_command: 'mcp__terminal__run_command',
        search_web: 'mcp__web__search',
        get_system_info: 'mcp__system__get_info',
    };

    private idempotentTools = new Set([
        'read_file',
        'read_many_files',
        'resolve_path',
        'search_files',
        'list_directory',
        'list_dir',
        'file_exists',
        'get_file_info',
        'create_directory',
        'get_system_info',
        'search_web',
        'mcp__filesystem__read',
        'mcp__filesystem__list',
        'mcp__system__get_info',
        'mcp__web__search',
        'mcp__web__read_page',
        'mcp__web__fetch_json',
        'mcp__terminal__list_sessions',
        'mcp__git__status',
        'mcp__git__diff',
        'mcp__git__blame',
        'mcp__git__log',
        'mcp__git__branches',
        'mcp__network__interfaces',
        'mcp__network__ports',
        'mcp__network__ping',
        'mcp__network__traceroute',
        'mcp__network__whois',
        'mcp__internet__weather',
        'mcp__workspace__listContainers',
        'mcp__workspace__stats',
        'mcp__workspace__listImages',
        'mcp__llm__listModels',
        'mcp__llm__ps'
    ]);

    private toolCache = new Map<string, { result: InternalToolResult; timestamp: number }>();
    private toolDefinitionsCache: { definitions: ToolDefinition[]; timestamp: number } | null = null;
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
        if (
            this.toolDefinitionsCache &&
            Date.now() - this.toolDefinitionsCache.timestamp < ToolExecutor.TOOL_DEFINITIONS_CACHE_TTL_MS
        ) {
            return this.toolDefinitionsCache.definitions;
        }

        const { toolDefinitions } = await import('./tool-definitions');

        // Add MCP tools if available
        let definitions: ToolDefinition[];
        if (this.options.mcp) {
            const mcpTools = await this.options.mcp.getToolDefinitions();
            definitions = [...toolDefinitions, ...mcpTools];
        } else {
            definitions = toolDefinitions;
        }

        // Avoid duplicate tool names to prevent downstream provider schema conflicts.
        const seen = new Set<string>();
        definitions = definitions.filter(tool => {
            const name = tool.function.name;
            if (seen.has(name)) {
                return false;
            }
            seen.add(name);
            return true;
        });

        this.toolDefinitionsCache = { definitions, timestamp: Date.now() };
        return definitions;
    }

    async execute(name: string, args: JsonObject, context?: ToolExecutionContext): Promise<InternalToolResult> {
        const timeoutMs = context?.timeoutMs ?? this.resolveTimeoutMs(name);
        const executionId = randomUUID().slice(0, 8);
        const startedAt = Date.now();

        // AGT-10: Caching for idempotent tools
        if (this.idempotentTools.has(name)) {
            const cacheKey = `${name}:${JSON.stringify(args)}`;
            const cached = this.toolCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
                const cacheAgeMs = Date.now() - cached.timestamp;
                appLogger.info(
                    'ToolExecutor',
                    `Tool cache hit (id=${executionId}, name=${name}, ageMs=${cacheAgeMs}, taskId=${context?.taskId ?? 'none'})`
                );
                // Annotate cached results so the model knows this data was previously returned
                const annotatedResult = { ...cached.result };
                if (annotatedResult.success && annotatedResult.result !== undefined) {
                    const hint = `This is a cached result. You already received this data from '${name}'. Use it to answer the user instead of calling this tool again.`;
                    if (typeof annotatedResult.result === 'object' && annotatedResult.result !== null && !Array.isArray(annotatedResult.result)) {
                        annotatedResult.result = { ...(annotatedResult.result), _cached: true, _cacheHint: hint };
                    } else {
                        annotatedResult.result = { data: annotatedResult.result, _cached: true, _cacheHint: hint };
                    }
                }
                return annotatedResult;
            }
        }

        try {
            appLogger.info(
                'ToolExecutor',
                `Tool execution started (id=${executionId}, name=${name}, taskId=${context?.taskId ?? 'none'}, timeoutMs=${timeoutMs})`,
                { args }
            );

            const executionContext: ToolExecutionContext = {
                ...context,
                timeoutMs,
            };
            const executionPromise = this.routeToolCall(name, args, executionContext);

            if (timeoutMs <= 0) {
                return await executionPromise;
            }

            const result = await this.raceWithTimeout(
                executionPromise,
                timeoutMs,
                `Tool execution timed out after ${timeoutMs}ms`
            ) as InternalToolResult;

            appLogger.info(
                'ToolExecutor',
                `Tool execution completed (id=${executionId}, name=${name}, success=${result.success}, durationMs=${Date.now() - startedAt}, errorType=${result.errorType ?? 'none'})`,
                result.success
                    ? undefined
                    : { error: result.error ?? 'Tool returned failure without an error message', result: result.result }
            );

            // AGT-10: Update cache for idempotent tools
            if (result.success && this.idempotentTools.has(name)) {
                const cacheKey = `${name}:${JSON.stringify(args)}`;
                if (this.toolCache.size >= ToolExecutor.MAX_TOOL_CACHE_ENTRIES) {
                    const oldestKey = this.toolCache.keys().next().value;
                    if (typeof oldestKey === 'string') {
                        this.toolCache.delete(oldestKey);
                    }
                }
                this.toolCache.set(cacheKey, { result, timestamp: Date.now() });
            }

            return result;
        } catch (error) {
            const errorMessage = (error as Error).message;
            const isTimeout = errorMessage.includes('timed out');

            appLogger.error(
                'ToolExecutor',
                `Tool execution failed (id=${executionId}, name=${name}, durationMs=${Date.now() - startedAt}, timeoutMs=${timeoutMs})`,
                error as Error
            );

            return {
                success: false,
                error: errorMessage,
                errorType: isTimeout ? 'timeout' : 'unknown'
            };
        }
    }

    private resolveTimeoutMs(name: string): number {
        const canonicalName = ToolExecutor.MCP_COMPAT_ALIASES[name] ?? name;
        return ToolExecutor.TOOL_TIMEOUT_MS[canonicalName] ?? ToolExecutor.DEFAULT_TIMEOUT_MS;
    }

    private async routeToolCall(name: string, args: JsonObject, context?: ToolExecutionContext): Promise<InternalToolResult> {
        try {
            if (name === 'update_plan_step' || name === 'propose_plan' || name === 'revise_plan') {
                return await this.handleWorkspaceTool(name, args, context);
            }

            const handlers: Partial<Record<string, (toolArgs: JsonObject) => Promise<InternalToolResult>>> = {
                resolve_path: (toolArgs) => this.handleResolvePath(toolArgs),
                read_file: (toolArgs) => this.handleFileRead(toolArgs),
                read_many_files: (toolArgs) => this.handleReadManyFiles(toolArgs),
                write_file: (toolArgs) => this.handleFileWrite(toolArgs),
                write_files: (toolArgs) => this.handleWriteFiles(toolArgs),
                patch_file: (toolArgs) => this.handlePatchFile(toolArgs),
                search_files: (toolArgs) => this.handleSearchFiles(toolArgs),
                list_directory: (toolArgs) => this.handleListDir(toolArgs),
                list_dir: (toolArgs) => this.handleListDir(toolArgs),
                file_exists: (toolArgs) => this.handleFileExists(toolArgs),
                get_file_info: (toolArgs) => this.handleGetFileInfo(toolArgs),
                create_directory: (toolArgs) => this.handleCreateDirectory(toolArgs),
                delete_file: (toolArgs) => this.handleDeleteFile(toolArgs),
                copy_file: (toolArgs) => this.handleCopyFile(toolArgs),
                move_file: (toolArgs) => this.handleMoveFile(toolArgs),
                execute_command: (toolArgs) => this.handleCommand(toolArgs, context),
                terminal_session_start: (toolArgs) => this.handleTerminalSessionStart(toolArgs, context),
                terminal_session_write: (toolArgs) => this.handleTerminalSessionWrite(toolArgs),
                terminal_session_read: (toolArgs) => this.handleTerminalSessionRead(toolArgs),
                terminal_session_wait: (toolArgs) => this.handleTerminalSessionWait(toolArgs),
                terminal_session_signal: (toolArgs) => this.handleTerminalSessionSignal(toolArgs),
                terminal_session_stop: (toolArgs) => this.handleTerminalSessionStop(toolArgs),
                terminal_session_list: () => this.handleTerminalSessionList(),
                terminal_session_snapshot: (toolArgs) => this.handleTerminalSessionSnapshot(toolArgs),
                search_web: (toolArgs) => this.handleWebSearch(toolArgs),
                get_system_info: () => this.handleSystemInfo(),
                generate_image: (toolArgs) => this.handleGenerateImage(toolArgs),
            };

            const handler = handlers[name];
            let result: InternalToolResult;

            if (handler) {
                result = await handler(args);
            } else {
                const canonicalName = ToolExecutor.MCP_COMPAT_ALIASES[name] ?? name;
                result = await this.handleMcpTool(canonicalName, args);
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
        if (
            msg.includes('permission') ||
            msg.includes('access denied') ||
            msg.includes('eacces') ||
            msg.includes('blocked by safety policy') ||
            msg.includes('blocked operation') ||
            msg.includes('invalid null control character')
        ) {
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

    private expandPathInput(inputPath: string): string {
        let expandedPath = inputPath.trim();
        expandedPath = expandedPath.replace(/%([^%]+)%/g, (_match, varName: string) => {
            return process.env[varName] ?? process.env[varName.toUpperCase()] ?? `%${varName}%`;
        });
        expandedPath = expandedPath.replace(/\$env:([A-Za-z_][A-Za-z0-9_]*)/giu, (_match, varName: string) => {
            return process.env[varName] ?? process.env[varName.toUpperCase()] ?? `$env:${varName}`;
        });
        expandedPath = expandedPath.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/gu, (_match, varName: string) => {
            return process.env[varName] ?? process.env[varName.toUpperCase()] ?? `$${varName}`;
        });
        if (expandedPath === '~' || expandedPath.startsWith('~/') || expandedPath.startsWith('~\\')) {
            const homePath = process.env.USERPROFILE ?? process.env.HOME ?? '';
            if (homePath.length > 0) {
                expandedPath = path.join(homePath, expandedPath.slice(2));
            }
        }
        return expandedPath;
    }

    private getDefaultFsBasePath(): string {
        const homePath = process.env.USERPROFILE ?? process.env.HOME ?? '';
        if (homePath.trim().length === 0) {
            return process.cwd();
        }
        const desktopCandidate = path.join(homePath, 'Desktop');
        return existsSync(desktopCandidate) ? desktopCandidate : homePath;
    }

    private resolveFsPathCandidate(candidatePath: string, basePath?: string): string {
        const trimmed = candidatePath.trim();
        const effectiveBase = (typeof basePath === 'string' && basePath.trim().length > 0)
            ? basePath.trim()
            : this.getDefaultFsBasePath();

        if (trimmed === '.' || trimmed === './' || trimmed === '.\\') {
            return path.resolve(this.expandPathInput(effectiveBase));
        }

        return this.resolveUserPath(trimmed, effectiveBase);
    }

    private resolveUserPath(inputPath: string, basePath?: string): string {
        const expandedPath = this.expandPathInput(inputPath);
        const rewriteWindowsUserHome = (candidatePath: string): string => {
            if (process.platform !== 'win32') {
                return candidatePath;
            }
            const currentHome = process.env.USERPROFILE ?? process.env.HOME ?? '';
            if (currentHome.trim().length === 0) {
                return candidatePath;
            }
            const normalizedHome = path.resolve(currentHome);
            const userPathMatch = path.resolve(candidatePath).match(/^[a-z]:[\\/]users[\\/][^\\/]+([\\/].*)?$/iu);
            if (!userPathMatch) {
                return candidatePath;
            }

            const pathUnderUsers = path.resolve(candidatePath);
            const currentHomeLower = normalizedHome.toLowerCase();
            const candidateLower = pathUnderUsers.toLowerCase();
            if (candidateLower.startsWith(currentHomeLower)) {
                return candidatePath;
            }

            const relativeFromUsersRoot = pathUnderUsers.replace(/^[a-z]:[\\/]users[\\/][^\\/]+/iu, '');
            const remappedPath = `${normalizedHome}${relativeFromUsersRoot}`;
            appLogger.warn(
                'ToolExecutor',
                `Remapped absolute path from another Windows profile: input=${candidatePath}, remapped=${remappedPath}`
            );
            return remappedPath;
        };
        if (path.isAbsolute(expandedPath)) {
            return path.resolve(rewriteWindowsUserHome(expandedPath));
        }

        const firstSegment = expandedPath.split(/[\\/]/u)[0]?.toLowerCase() ?? '';
        const homeRelativeFolders = new Set(['desktop', 'documents', 'downloads', 'projects']);
        const homePath = process.env.USERPROFILE ?? process.env.HOME ?? '';
        if (homePath.length > 0 && homeRelativeFolders.has(firstSegment)) {
            return path.resolve(homePath, expandedPath);
        }

        if (typeof basePath === 'string' && basePath.trim().length > 0) {
            return path.resolve(this.expandPathInput(basePath), expandedPath);
        }

        return path.resolve(expandedPath);
    }

    private async handleResolvePath(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['path'] !== 'string') { return { success: false, error: "Missing 'path' argument" }; }
        const inputPath = args['path'];
        const basePath = typeof args['basePath'] === 'string' ? args['basePath'] : undefined;
        const resolvedPath = this.resolveUserPath(inputPath, basePath);
        const parentPath = path.dirname(resolvedPath);
        const [existsResult, parentExistsResult] = await Promise.all([
            this.options.fileSystem.fileExists(resolvedPath),
            this.options.fileSystem.fileExists(parentPath),
        ]);

        return {
            success: true,
            result: {
                success: true,
                resultKind: 'path_resolution',
                inputPath,
                basePath: basePath ?? null,
                path: resolvedPath,
                parentPath,
                pathExists: existsResult.exists,
                parentExists: parentExistsResult.exists,
                complete: true,
                displaySummary: parentExistsResult.exists
                    ? `Resolved path: ${resolvedPath}`
                    : `Resolved path but parent does not exist: ${resolvedPath}`,
            },
        };
    }

    private async handleFileRead(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['path'] !== 'string') { return { success: false, error: "Missing 'path' argument" }; }
        const basePath = typeof args['basePath'] === 'string' ? args['basePath'] : undefined;
        const path = this.resolveFsPathCandidate(args['path'], basePath);
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

    private async handleReadManyFiles(args: JsonObject): Promise<InternalToolResult> {
        if (!Array.isArray(args['paths'])) { return { success: false, error: "Missing 'paths' argument" }; }
        const basePath = typeof args['basePath'] === 'string' ? args['basePath'] : undefined;
        const paths = args['paths']
            .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
            .map(item => this.resolveFsPathCandidate(item, basePath));
        if (paths.length === 0) {
            return { success: false, error: 'At least one path is required' };
        }
        if (paths.length > ToolExecutor.MAX_BATCH_READ_FILES) {
            return { success: false, error: `Too many files requested (max ${ToolExecutor.MAX_BATCH_READ_FILES})`, errorType: 'limit' };
        }

        const files = await Promise.all(paths.map(async (filePath): Promise<JsonObject> => {
            const response = await this.options.fileSystem.readFile(filePath);
            return {
                path: filePath,
                success: response.success,
                content: response.success ? response.data ?? '' : null,
                error: response.success ? null : response.error ?? 'Failed to read file',
            };
        }));
        const failedCount = files.filter(file => file['success'] !== true).length;
        return {
            success: failedCount === 0,
            result: {
                success: failedCount === 0,
                resultKind: 'multi_file_read',
                complete: true,
                requestedCount: paths.length,
                readCount: files.length - failedCount,
                failedCount,
                files,
                displaySummary: failedCount === 0
                    ? `Read ${files.length} files`
                    : `Read ${files.length - failedCount} of ${files.length} files; ${failedCount} failed`,
            },
            error: failedCount === 0 ? undefined : `${failedCount} file(s) failed to read`,
        };
    }

    private async handleFileWrite(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['path'] !== 'string') { return { success: false, error: "Missing 'path' argument" }; }
        if (typeof args['content'] !== 'string') { return { success: false, error: "Missing 'content' argument" }; }
        const basePath = typeof args['basePath'] === 'string' ? args['basePath'] : undefined;
        const path = this.resolveFsPathCandidate(args['path'], basePath);
        const content = args['content'];
        try {
            const tracking = this.getFileTrackingContext(args);
            let diffId: string | undefined;
            let diffStats: JsonObject | undefined;
            let existedBefore: boolean | undefined;

            if (tracking) {
                const response = await this.options.fileSystem.writeFileWithTracking(path, content, tracking);
                if (!response.success) {
                    return { success: false, error: response.error ?? 'Failed to write file' };
                }
                const details = response.details && typeof response.details === 'object' && !Array.isArray(response.details)
                    ? response.details as Record<string, unknown>
                    : {};
                diffId = typeof details.diffId === 'string' ? details.diffId : undefined;
                const additions = typeof details.additions === 'number' && Number.isFinite(details.additions) ? details.additions : 0;
                const deletions = typeof details.deletions === 'number' && Number.isFinite(details.deletions) ? details.deletions : 0;
                const changes = typeof details.changes === 'number' && Number.isFinite(details.changes) ? details.changes : (additions + deletions);
                diffStats = (additions > 0 || deletions > 0) ? { additions, deletions, changes } : undefined;
                existedBefore = typeof details.existedBefore === 'boolean' ? details.existedBefore : undefined;
                if (diffId?.trim().length === 0) {
                    diffId = undefined;
                }
            } else {
                await this.options.fileSystem.writeFile(path, content);
            }
            const bytesWritten = Buffer.byteLength(content, 'utf8');
            return {
                success: true,
                result: {
                    success: true,
                    resultKind: 'file_write',
                    path,
                    bytesWritten,
                    ...(diffId ? { diffId } : {}),
                    ...(diffStats ? { diffStats } : {}),
                    ...(typeof existedBefore === 'boolean' ? { existedBefore, created: !existedBefore } : {}),
                    complete: true,
                    displaySummary: `Wrote ${bytesWritten} bytes to ${path}`,
                },
            };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    }

    private async handleWriteFiles(args: JsonObject): Promise<InternalToolResult> {
        if (!Array.isArray(args['files'])) { return { success: false, error: "Missing 'files' argument" }; }
        if (args['files'].length === 0) {
            return { success: false, error: 'At least one file is required' };
        }
        if (args['files'].length > ToolExecutor.MAX_BATCH_WRITE_FILES) {
            return { success: false, error: `Too many files requested (max ${ToolExecutor.MAX_BATCH_WRITE_FILES})`, errorType: 'limit' };
        }

        const basePath = typeof args['basePath'] === 'string' ? args['basePath'] : undefined;
        const files = await Promise.all(args['files'].map(async (entry): Promise<JsonObject> => {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
                return { success: false, path: null, bytesWritten: 0, error: 'Invalid file entry' };
            }
            const record = entry as Record<string, JsonValue>;
            const filePath = record['path'];
            const content = record['content'];
            if (typeof filePath !== 'string' || typeof content !== 'string') {
                return { success: false, path: typeof filePath === 'string' ? filePath : null, bytesWritten: 0, error: 'Invalid path or content' };
            }
            const resolvedPath = this.resolveFsPathCandidate(filePath, basePath);
            const tracking = this.getFileTrackingContext(args);
            const response = tracking
                ? await this.options.fileSystem.writeFileWithTracking(resolvedPath, content, tracking)
                : await this.options.fileSystem.writeFile(resolvedPath, content);
            const bytesWritten = response.success ? Buffer.byteLength(content, 'utf8') : 0;
            const details = response.details && typeof response.details === 'object' && !Array.isArray(response.details)
                ? response.details as Record<string, unknown>
                : {};
            const diffId = typeof details.diffId === 'string' && details.diffId.trim().length > 0 ? details.diffId : null;
            const additions = typeof details.additions === 'number' && Number.isFinite(details.additions) ? details.additions : 0;
            const deletions = typeof details.deletions === 'number' && Number.isFinite(details.deletions) ? details.deletions : 0;
            const changes = typeof details.changes === 'number' && Number.isFinite(details.changes) ? details.changes : (additions + deletions);
            const diffStats = (additions > 0 || deletions > 0) ? { additions, deletions, changes } : null;
            const existedBefore = typeof details.existedBefore === 'boolean' ? details.existedBefore : null;
            return {
                success: response.success,
                path: resolvedPath,
                bytesWritten,
                diffId,
                diffStats,
                existedBefore,
                error: response.success ? null : response.error ?? 'Failed to write file',
            };
        }));

        const failedCount = files.filter(file => file['success'] !== true).length;
        const bytesWritten = files.reduce((total, file) => {
            const count = typeof file['bytesWritten'] === 'number' ? file['bytesWritten'] : 0;
            return total + count;
        }, 0);
        return {
            success: failedCount === 0,
            result: {
                success: failedCount === 0,
                resultKind: 'multi_file_write',
                complete: true,
                requestedCount: args['files'].length,
                writtenCount: files.length - failedCount,
                failedCount,
                bytesWritten,
                files,
                displaySummary: failedCount === 0
                    ? `Wrote ${files.length} files (${bytesWritten} bytes)`
                    : `Wrote ${files.length - failedCount} of ${files.length} files; ${failedCount} failed`,
            },
            error: failedCount === 0 ? undefined : `${failedCount} file(s) failed to write`,
        };
    }

    private parseLineEdits(value: JsonValue): Array<{ startLine: number; endLine: number; replacement: string }> | null {
        if (!Array.isArray(value)) {
            return null;
        }
        if (value.length === 0 || value.length > ToolExecutor.MAX_PATCH_EDITS) {
            return null;
        }
        const edits: Array<{ startLine: number; endLine: number; replacement: string }> = [];
        for (const item of value) {
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
                return null;
            }
            const edit = item as Record<string, JsonValue>;
            const startLine = edit['startLine'];
            const endLine = edit['endLine'];
            const replacement = edit['replacement'];
            if (
                typeof startLine !== 'number' ||
                typeof endLine !== 'number' ||
                !Number.isInteger(startLine) ||
                !Number.isInteger(endLine) ||
                typeof replacement !== 'string'
            ) {
                return null;
            }
            edits.push({ startLine, endLine, replacement });
        }
        return edits;
    }

    private async handlePatchFile(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['path'] !== 'string') { return { success: false, error: "Missing 'path' argument" }; }
        const basePath = typeof args['basePath'] === 'string' ? args['basePath'] : undefined;
        const filePath = this.resolveFsPathCandidate(args['path'], basePath);
        const edits = this.parseLineEdits(args['edits'] ?? null);

        if (edits) {
            const tracking = this.getFileTrackingContext(args);
            const response = tracking
                ? await this.options.fileSystem.applyEditsWithTracking(filePath, edits, tracking)
                : await this.options.fileSystem.applyEdits(filePath, edits);
            if (!response.success) {
                return { success: false, error: response.error ?? 'Failed to apply edits' };
            }
            const details = response.details && typeof response.details === 'object' && !Array.isArray(response.details)
                ? response.details as Record<string, unknown>
                : {};
            const diffId = typeof details.diffId === 'string' && details.diffId.trim().length > 0 ? details.diffId : undefined;
            const additions = typeof details.additions === 'number' && Number.isFinite(details.additions) ? details.additions : 0;
            const deletions = typeof details.deletions === 'number' && Number.isFinite(details.deletions) ? details.deletions : 0;
            const changes = typeof details.changes === 'number' && Number.isFinite(details.changes) ? details.changes : (additions + deletions);
            const diffStats = (additions > 0 || deletions > 0) ? { additions, deletions, changes } : undefined;
            return {
                success: true,
                result: {
                    success: true,
                    resultKind: 'file_patch',
                    path: filePath,
                    editCount: edits.length,
                    ...(diffId ? { diffId } : {}),
                    ...(diffStats ? { diffStats } : {}),
                    complete: true,
                    displaySummary: `Applied ${edits.length} line edit(s) to ${filePath}`,
                },
            };
        }

        if (typeof args['search'] !== 'string' || typeof args['replace'] !== 'string') {
            return { success: false, error: "Provide either 'edits' or both 'search' and 'replace'" };
        }
        const readResponse = await this.options.fileSystem.readFile(filePath);
        if (!readResponse.success || typeof readResponse.data !== 'string') {
            return { success: false, error: readResponse.error ?? 'Failed to read file before patching' };
        }
        if (!readResponse.data.includes(args['search'])) {
            return { success: false, error: 'Search text was not found in file', errorType: 'notFound' };
        }
        const nextContent = readResponse.data.replace(args['search'], args['replace']);
        const tracking = this.getFileTrackingContext(args);
        const writeResponse = tracking
            ? await this.options.fileSystem.writeFileWithTracking(filePath, nextContent, tracking)
            : await this.options.fileSystem.writeFile(filePath, nextContent);
        if (!writeResponse.success) {
            return { success: false, error: writeResponse.error ?? 'Failed to write patched file' };
        }
        const details = writeResponse.details && typeof writeResponse.details === 'object' && !Array.isArray(writeResponse.details)
            ? writeResponse.details as Record<string, unknown>
            : {};
        const diffId = typeof details.diffId === 'string' && details.diffId.trim().length > 0 ? details.diffId : undefined;
        const additions = typeof details.additions === 'number' && Number.isFinite(details.additions) ? details.additions : 0;
        const deletions = typeof details.deletions === 'number' && Number.isFinite(details.deletions) ? details.deletions : 0;
        const changes = typeof details.changes === 'number' && Number.isFinite(details.changes) ? details.changes : (additions + deletions);
        const diffStats = (additions > 0 || deletions > 0) ? { additions, deletions, changes } : undefined;
        return {
            success: true,
            result: {
                success: true,
                resultKind: 'file_patch',
                path: filePath,
                editCount: 1,
                ...(diffId ? { diffId } : {}),
                ...(diffStats ? { diffStats } : {}),
                complete: true,
                displaySummary: `Applied exact-text patch to ${filePath}`,
            },
        };
    }

    private async handleSearchFiles(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['rootPath'] !== 'string') { return { success: false, error: "Missing 'rootPath' argument" }; }
        if (typeof args['pattern'] !== 'string' || args['pattern'].trim().length === 0) {
            return { success: false, error: "Missing 'pattern' argument" };
        }
        const requestedLimit = typeof args['maxResults'] === 'number' && Number.isFinite(args['maxResults'])
            ? Math.floor(args['maxResults'])
            : 50;
        const maxResults = Math.max(1, Math.min(requestedLimit, ToolExecutor.MAX_SEARCH_RESULTS));
        const basePath = typeof args['basePath'] === 'string' ? args['basePath'] : undefined;
        const resolvedRootPath = this.resolveFsPathCandidate(args['rootPath'], basePath);
        const response = await this.options.fileSystem.searchFiles(resolvedRootPath, args['pattern'], maxResults);
        if (!response.success || !Array.isArray(response.data)) {
            return { success: false, error: response.error ?? 'Failed to search files' };
        }
        const results = response.data.slice(0, maxResults);
        return {
            success: true,
            result: {
                success: true,
                resultKind: 'file_search',
                rootPath: resolvedRootPath,
                pattern: args['pattern'],
                resultCount: results.length,
                truncated: response.data.length > results.length,
                results,
                complete: true,
                displaySummary: `Found ${results.length}${response.data.length > results.length ? ` of ${response.data.length}` : ''} file(s) matching '${args['pattern']}'`,
            },
        };
    }

    private async handleListDir(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['path'] !== 'string') { return { success: false, error: "Missing 'path' argument" }; }
        const basePath = typeof args['basePath'] === 'string' ? args['basePath'] : undefined;
        const path = this.resolveFsPathCandidate(args['path'], basePath);
        try {
            const response = await this.options.fileSystem.listDirectory(path);
            if (!response.success || !response.data) {
                return { success: false, error: response.error ?? 'Failed to list directory' };
            }
            const entries = response.data;
            const directoryCount = entries.filter(entry => entry.isDirectory).length;
            const fileCount = entries.length - directoryCount;
            return {
                success: true,
                result: {
                    path,
                    complete: true,
                    pathExists: true,
                    entryCount: entries.length,
                    fileCount,
                    directoryCount,
                    entries,
                },
            };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    }

    private async handleFileExists(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['path'] !== 'string') { return { success: false, error: "Missing 'path' argument" }; }
        const basePath = typeof args['basePath'] === 'string' ? args['basePath'] : undefined;
        const path = this.resolveFsPathCandidate(args['path'], basePath);
        try {
            const response = await this.options.fileSystem.fileExists(path);
            return { success: true, result: response.exists };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    }

    private async handleGetFileInfo(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['path'] !== 'string') { return { success: false, error: "Missing 'path' argument" }; }
        const basePath = typeof args['basePath'] === 'string' ? args['basePath'] : undefined;
        const path = this.resolveFsPathCandidate(args['path'], basePath);
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
        if (typeof args['path'] !== 'string' || args['path'].trim().length === 0) {
            return {
                success: false,
                result: {
                    success: false,
                    resultKind: 'directory_create',
                    path: null,
                    complete: false,
                    retrySameCall: false,
                    displaySummary: "Cannot create directory without a non-empty 'path' argument",
                },
                error: "Missing non-empty 'path' argument",
                errorType: 'unknown',
            };
        }
        const inputPath = args['path'].trim();
        const basePath = typeof args['basePath'] === 'string' ? args['basePath'] : undefined;
        const path = this.resolveFsPathCandidate(inputPath, basePath);
        try {
            const existedBefore = (await this.options.fileSystem.fileExists(path)).exists;
            const response = await this.options.fileSystem.createDirectory(path);
            if (!response.success) {
                return {
                    success: false,
                    result: {
                        success: false,
                        resultKind: 'directory_create',
                        path,
                        inputPath,
                        pathExists: existedBefore,
                        complete: false,
                        displaySummary: `Failed to create directory: ${path}`,
                    },
                    error: response.error ?? 'Failed to create directory',
                    errorType: response.error ? this.categorizeError(response.error) : 'unknown',
                };
            }
            return {
                success: true,
                result: {
                    success: true,
                    resultKind: 'directory_create',
                    path,
                    inputPath,
                    pathExists: true,
                    existedBefore,
                    created: !existedBefore,
                    complete: true,
                    displaySummary: existedBefore
                        ? `Directory already existed: ${path}`
                        : `Created directory: ${path}`,
                },
            };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    }

    private async handleDeleteFile(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['path'] !== 'string') { return { success: false, error: "Missing 'path' argument" }; }
        const basePath = typeof args['basePath'] === 'string' ? args['basePath'] : undefined;
        const path = this.resolveFsPathCandidate(args['path'], basePath);
        try {
            const tracking = this.getFileTrackingContext(args);
            const response = tracking
                ? await this.options.fileSystem.deleteFileWithTracking(path, tracking)
                : await this.options.fileSystem.deleteFile(path);
            const details = response.details && typeof response.details === 'object' && !Array.isArray(response.details)
                ? response.details as Record<string, unknown>
                : {};
            const diffId = typeof details.diffId === 'string' && details.diffId.trim().length > 0 ? details.diffId : undefined;
            const additions = typeof details.additions === 'number' && Number.isFinite(details.additions) ? details.additions : 0;
            const deletions = typeof details.deletions === 'number' && Number.isFinite(details.deletions) ? details.deletions : 0;
            const changes = typeof details.changes === 'number' && Number.isFinite(details.changes) ? details.changes : (additions + deletions);
            const diffStats = (additions > 0 || deletions > 0) ? { additions, deletions, changes } : undefined;
            return {
                success: response.success,
                result: {
                    success: response.success,
                    resultKind: 'file_delete',
                    path,
                    ...(diffId ? { diffId } : {}),
                    ...(diffStats ? { diffStats } : {}),
                    complete: true,
                    displaySummary: response.success ? `Deleted file ${path}` : `Failed to delete file ${path}`,
                },
                error: response.success ? undefined : response.error ?? undefined,
            };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    }

    private async handleCopyFile(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['source'] !== 'string') { return { success: false, error: "Missing 'source' argument" }; }
        if (typeof args['destination'] !== 'string') { return { success: false, error: "Missing 'destination' argument" }; }

        try {
            const basePath = typeof args['basePath'] === 'string' ? args['basePath'] : undefined;
            const source = this.resolveFsPathCandidate(args['source'], basePath);
            const destination = this.resolveFsPathCandidate(args['destination'], basePath);
            const response = await this.options.fileSystem.copyFile(source, destination);
            return { success: response.success, error: response.error ?? undefined };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    }

    private async handleMoveFile(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['source'] !== 'string') { return { success: false, error: "Missing 'source' argument" }; }
        if (typeof args['destination'] !== 'string') { return { success: false, error: "Missing 'destination' argument" }; }

        try {
            const basePath = typeof args['basePath'] === 'string' ? args['basePath'] : undefined;
            const source = this.resolveFsPathCandidate(args['source'], basePath);
            const destination = this.resolveFsPathCandidate(args['destination'], basePath);
            const response = await this.options.fileSystem.moveFile(source, destination);
            return { success: response.success, error: response.error ?? undefined };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    }

    private getFileTrackingContext(args: JsonObject): { aiSystem: 'workspace'; chatSessionId?: string; changeReason?: string; metadata?: JsonObject } | null {
        const sessionId = typeof args['__chatSessionId'] === 'string' && args['__chatSessionId'].trim().length > 0
            ? args['__chatSessionId'].trim()
            : null;
        if (!sessionId) {
            return null;
        }
        return {
            aiSystem: 'workspace',
            chatSessionId: sessionId,
            changeReason: 'AI file modification',
            metadata: {},
        };
    }

    private getTailBytes(args: JsonObject, defaultBytes: number): number {
        const requested = typeof args['tailBytes'] === 'number' && Number.isFinite(args['tailBytes'])
            ? Math.floor(args['tailBytes'])
            : defaultBytes;
        return Math.max(1, Math.min(requested, ToolExecutor.MAX_TERMINAL_READ_BYTES));
    }

    private tailTerminalOutput(output: string, tailBytes: number): { output: string; bytes: number; truncated: boolean } {
        const bytes = Buffer.byteLength(output, 'utf-8');
        if (bytes <= tailBytes) {
            return { output, bytes, truncated: false };
        }
        return {
            output: Buffer.from(output, 'utf-8').subarray(bytes - tailBytes).toString('utf-8'),
            bytes,
            truncated: true,
        };
    }

    private async wait(ms: number): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, ms));
    }

    private async observeTerminalSession(
        sessionId: string,
        options?: {
            pattern?: string;
            timeoutMs?: number;
            idleMs?: number;
            tailBytes?: number;
        }
    ): Promise<{
        output: string;
        fullOutput: string;
        totalBytes: number;
        truncated: boolean;
        matched: boolean;
        idle: boolean;
        timedOut: boolean;
        elapsedMs: number;
    }> {
        const pattern = options?.pattern;
        const requestedTimeout = typeof options?.timeoutMs === 'number' && Number.isFinite(options.timeoutMs)
            ? Math.floor(options.timeoutMs)
            : 30000;
        const timeoutMs = Math.max(250, Math.min(requestedTimeout, ToolExecutor.MAX_TERMINAL_WAIT_MS));
        const requestedIdle = typeof options?.idleMs === 'number' && Number.isFinite(options.idleMs)
            ? Math.floor(options.idleMs)
            : 1000;
        const idleMs = Math.max(250, Math.min(requestedIdle, 10000));
        const tailBytes = typeof options?.tailBytes === 'number' && Number.isFinite(options.tailBytes)
            ? Math.floor(options.tailBytes)
            : 20000;

        const startedAt = Date.now();
        const maxPolls = Math.ceil(timeoutMs / ToolExecutor.TERMINAL_POLL_INTERVAL_MS);
        let lastOutput = await this.options.terminal.getSessionBuffer(sessionId);
        let lastChangeAt = Date.now();
        let matched = pattern ? lastOutput.includes(pattern) : false;
        let idle = false;

        for (let poll = 0; poll < maxPolls && !matched && !idle; poll += 1) {
            await this.wait(ToolExecutor.TERMINAL_POLL_INTERVAL_MS);
            const nextOutput = await this.options.terminal.getSessionBuffer(sessionId);
            if (nextOutput !== lastOutput) {
                lastOutput = nextOutput;
                lastChangeAt = Date.now();
            }
            matched = pattern ? nextOutput.includes(pattern) : false;
            idle = Date.now() - lastChangeAt >= idleMs;
        }

        const elapsedMs = Date.now() - startedAt;
        const timedOut = elapsedMs >= timeoutMs && !matched && !idle;
        const tail = this.tailTerminalOutput(lastOutput, Math.max(1, Math.min(tailBytes, ToolExecutor.MAX_TERMINAL_READ_BYTES)));
        return {
            output: tail.output,
            fullOutput: lastOutput,
            totalBytes: tail.bytes,
            truncated: tail.truncated,
            matched,
            idle,
            timedOut,
            elapsedMs,
        };
    }

    private async handleTerminalSessionStart(args: JsonObject, context?: ToolExecutionContext): Promise<InternalToolResult> {
        const sessionId = typeof args['sessionId'] === 'string' && args['sessionId'].trim().length > 0
            ? args['sessionId'].trim()
            : `agent-term-${randomUUID().slice(0, 8)}`;
        const cwd = typeof args['cwd'] === 'string' && args['cwd'].trim().length > 0 ? args['cwd'] : undefined;
        const shell = typeof args['shell'] === 'string' && args['shell'].trim().length > 0 ? args['shell'] : undefined;
        const backendId = typeof args['backendId'] === 'string' && args['backendId'].trim().length > 0 ? args['backendId'] : undefined;
        const title = typeof args['title'] === 'string' && args['title'].trim().length > 0 ? args['title'] : 'Agent Terminal';
        const cols = typeof args['cols'] === 'number' && Number.isFinite(args['cols']) ? Math.max(20, Math.min(Math.floor(args['cols']), 300)) : 120;
        const rows = typeof args['rows'] === 'number' && Number.isFinite(args['rows']) ? Math.max(8, Math.min(Math.floor(args['rows']), 100)) : 30;

        const created = await this.options.terminal.createSession({
            id: sessionId,
            cwd,
            shell,
            backendId,
            cols,
            rows,
            title,
            workspaceId: context?.workspaceId,
            metadata: { owner: 'agent', toolManaged: true },
            onData: () => undefined,
            onExit: () => undefined,
        });

        if (!created) {
            return { success: false, error: `Failed to create terminal session '${sessionId}'` };
        }

        return {
            success: true,
            result: {
                success: true,
                resultKind: 'terminal_session',
                sessionId,
                cwd: cwd ?? null,
                shell: shell ?? null,
                title,
                cols,
                rows,
                complete: true,
                displaySummary: `Started terminal session ${sessionId}`,
            },
        };
    }

    private async handleTerminalSessionWrite(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['sessionId'] !== 'string') { return { success: false, error: "Missing 'sessionId' argument" }; }
        if (typeof args['input'] !== 'string') { return { success: false, error: "Missing 'input' argument" }; }

        const sessionId = args['sessionId'];
        const input = args['input'];
        if (input.length > ToolExecutor.MAX_TERMINAL_WRITE_SIZE) {
            return { success: false, error: 'Terminal input is too long', errorType: 'limit' };
        }

        const inputKind = args['inputKind'] === 'input' ? 'input' : 'command';
        if (inputKind === 'command') {
            const validation = validateCommand(input);
            if (!validation.allowed) {
                return { success: false, error: validation.reason ?? 'Command blocked by safety policy', errorType: 'permission' };
            }
        }

        const submit = args['submit'] !== false;
        const payload = submit && !input.endsWith('\r') && !input.endsWith('\n') ? `${input}\r` : input;
        const preWriteOutput = await this.options.terminal.getSessionBuffer(sessionId);
        const written = this.options.terminal.write(sessionId, payload);
        if (!written) {
            return { success: false, error: `Terminal session '${sessionId}' was not found`, errorType: 'notFound' };
        }

        const shouldWaitForCompletion =
            inputKind === 'command'
            && submit
            && args['waitForCompletion'] !== false;

        if (shouldWaitForCompletion) {
            const observed = await this.observeTerminalSession(sessionId, {
                timeoutMs: typeof args['timeoutMs'] === 'number' ? args['timeoutMs'] : 30000,
                idleMs: typeof args['idleMs'] === 'number' ? args['idleMs'] : 1200,
                tailBytes: typeof args['tailBytes'] === 'number' ? args['tailBytes'] : 20000,
            });
            const outputDelta = observed.fullOutput.startsWith(preWriteOutput)
                ? observed.fullOutput.slice(preWriteOutput.length)
                : observed.output;
            const commandComplete = observed.idle || observed.matched;

            return {
                success: true,
                result: {
                    success: true,
                    resultKind: 'terminal_write',
                    sessionId,
                    inputKind,
                    submitted: submit,
                    bytesWritten: Buffer.byteLength(payload, 'utf-8'),
                    waitedForCompletion: true,
                    complete: commandComplete,
                    idle: observed.idle,
                    matched: observed.matched,
                    timedOut: observed.timedOut,
                    elapsedMs: observed.elapsedMs,
                    output: outputDelta,
                    totalBytes: observed.totalBytes,
                    truncated: observed.truncated,
                    displaySummary: commandComplete
                        ? `Command finished in terminal session ${sessionId}`
                        : `Command is still running in terminal session ${sessionId}`,
                },
            };
        }

        return {
            success: true,
            result: {
                success: true,
                resultKind: 'terminal_write',
                sessionId,
                inputKind,
                submitted: submit,
                bytesWritten: Buffer.byteLength(payload, 'utf-8'),
                waitedForCompletion: false,
                complete: true,
                displaySummary: `Wrote ${inputKind} input to terminal session ${sessionId}`,
            },
        };
    }

    private async handleTerminalSessionRead(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['sessionId'] !== 'string') { return { success: false, error: "Missing 'sessionId' argument" }; }
        const sessionId = args['sessionId'];
        if (!this.options.terminal.getActiveSessions().includes(sessionId)) {
            return { success: false, error: `Terminal session '${sessionId}' was not found`, errorType: 'notFound' };
        }

        const buffer = await this.options.terminal.getSessionBuffer(sessionId);
        const tail = this.tailTerminalOutput(buffer, this.getTailBytes(args, 20000));
        return {
            success: true,
            result: {
                success: true,
                resultKind: 'terminal_read',
                sessionId,
                output: tail.output,
                totalBytes: tail.bytes,
                truncated: tail.truncated,
                complete: true,
                displaySummary: `Read terminal session ${sessionId}`,
            },
        };
    }

    private async handleTerminalSessionWait(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['sessionId'] !== 'string') { return { success: false, error: "Missing 'sessionId' argument" }; }
        const sessionId = args['sessionId'];
        if (!this.options.terminal.getActiveSessions().includes(sessionId)) {
            return { success: false, error: `Terminal session '${sessionId}' was not found`, errorType: 'notFound' };
        }

        const observed = await this.observeTerminalSession(sessionId, {
            pattern: typeof args['pattern'] === 'string' && args['pattern'].length > 0 ? args['pattern'] : undefined,
            timeoutMs: typeof args['timeoutMs'] === 'number' ? args['timeoutMs'] : 30000,
            idleMs: typeof args['idleMs'] === 'number' ? args['idleMs'] : 1000,
            tailBytes: this.getTailBytes(args, 20000),
        });
        return {
            success: true,
            result: {
                success: true,
                resultKind: 'terminal_wait',
                sessionId,
                pattern: (typeof args['pattern'] === 'string' && args['pattern'].length > 0) ? args['pattern'] : null,
                matched: observed.matched,
                idle: observed.idle,
                timedOut: observed.timedOut,
                elapsedMs: observed.elapsedMs,
                output: observed.output,
                totalBytes: observed.totalBytes,
                truncated: observed.truncated,
                complete: observed.matched || observed.idle,
                displaySummary: observed.matched
                    ? `Terminal session ${sessionId} matched the requested pattern`
                    : observed.idle
                        ? `Terminal session ${sessionId} became idle`
                        : `Terminal session ${sessionId} wait timed out`,
            },
        };
    }

    private async handleTerminalSessionSignal(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['sessionId'] !== 'string') { return { success: false, error: "Missing 'sessionId' argument" }; }
        const sessionId = args['sessionId'];
        const signal = typeof args['signal'] === 'string' ? args['signal'] : 'interrupt';
        const payloads: Record<string, string> = {
            interrupt: '\x03',
            eof: '\x04',
            enter: '\r',
        };
        const payload = payloads[signal];
        if (!payload) {
            return { success: false, error: "Invalid 'signal' argument. Use interrupt, eof, or enter." };
        }
        const written = this.options.terminal.write(sessionId, payload);
        if (!written) {
            return { success: false, error: `Terminal session '${sessionId}' was not found`, errorType: 'notFound' };
        }
        return { success: true, result: { resultKind: 'terminal_signal', sessionId, signal, complete: true } };
    }

    private async handleTerminalSessionStop(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['sessionId'] !== 'string') { return { success: false, error: "Missing 'sessionId' argument" }; }
        const stopped = this.options.terminal.kill(args['sessionId']);
        if (!stopped) {
            return { success: false, error: `Terminal session '${args['sessionId']}' was not found`, errorType: 'notFound' };
        }
        return { success: true, result: { resultKind: 'terminal_stop', sessionId: args['sessionId'], complete: true } };
    }

    private async handleTerminalSessionList(): Promise<InternalToolResult> {
        const sessions = this.options.terminal.getActiveSessions();
        return { success: true, result: { resultKind: 'terminal_sessions', sessions, count: sessions.length, complete: true } };
    }

    private async handleTerminalSessionSnapshot(args: JsonObject): Promise<InternalToolResult> {
        if (typeof args['sessionId'] !== 'string') { return { success: false, error: "Missing 'sessionId' argument" }; }
        const sessionId = args['sessionId'];
        if (!this.options.terminal.getActiveSessions().includes(sessionId)) {
            return { success: false, error: `Terminal session '${sessionId}' was not found`, errorType: 'notFound' };
        }

        const [buffer, analytics] = await Promise.all([
            this.options.terminal.getSessionBuffer(sessionId),
            this.options.terminal.getSessionAnalytics(sessionId),
        ]);
        const tail = this.tailTerminalOutput(buffer, this.getTailBytes(args, 30000));
        const analyticsPayload: JsonObject = {
            sessionId: analytics.sessionId,
            bytes: analytics.bytes,
            lineCount: analytics.lineCount,
            commandCount: analytics.commandCount,
            updatedAt: analytics.updatedAt,
        };
        return {
            success: true,
            result: {
                resultKind: 'terminal_snapshot',
                sessionId,
                output: tail.output,
                totalBytes: tail.bytes,
                truncated: tail.truncated,
                analytics: analyticsPayload,
                complete: true,
            },
        };
    }

    private async handleCommand(args: JsonObject, context?: ToolExecutionContext): Promise<InternalToolResult> {
        if (typeof args['command'] !== 'string') { return { success: false, error: "Missing 'command' argument" }; }
        const command = args['command'];
        const cwd = (typeof args['cwd'] === 'string') ? args['cwd'] : undefined;
        const timeout = typeof context?.timeoutMs === 'number' && Number.isFinite(context.timeoutMs)
            ? Math.max(1000, context.timeoutMs - 1000)
            : undefined;
        try {
            const result = await this.options.command.executeCommand(command, { cwd, timeout });
            const commandSuccess = result.success === true;
            const commandPayload: JsonObject = {
                success: commandSuccess,
                resultKind: 'command_execution',
                command,
                cwd: cwd ?? null,
                stdout: result.stdout ?? '',
                stderr: result.stderr ?? '',
                exitCode: typeof result.exitCode === 'number' ? result.exitCode : null,
                complete: commandSuccess,
                displaySummary: commandSuccess
                    ? `Command completed with exit code ${typeof result.exitCode === 'number' ? result.exitCode : 0}`
                    : 'Command failed before completing',
            };

            if (commandSuccess) {
                return {
                    success: true,
                    result: commandPayload,
                    error: undefined,
                };
            }

            const commandError = result.error ?? result.stderr ?? 'Command execution failed';
            commandPayload.displaySummary = `Command failed: ${commandError}`;
            return {
                success: false,
                result: commandPayload,
                error: commandError,
                errorType: this.categorizeError(commandError),
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

            if (name.startsWith('mcp__')) {
                const [, serviceName, ...toolParts] = name.split('__');
                server = serviceName ?? 'default';
                tool = toolParts.join('__') || name;
            } else if (name.includes(':')) {
                const parts = name.split(':');
                server = parts[0] ?? 'default';
                tool = parts[1] ?? name;
            }

            const normalizedArgs: JsonObject = { ...args };
            if (server === 'filesystem') {
                const basePath = typeof normalizedArgs['basePath'] === 'string' ? (normalizedArgs['basePath'] as string) : undefined;
                const pathKeys = ['path', 'rootPath', 'zipPath', 'destPath', 'source', 'destination'] as const;
                for (const key of pathKeys) {
                    const value = normalizedArgs[key];
                    if (typeof value === 'string' && value.trim().length > 0) {
                        normalizedArgs[key] = this.resolveFsPathCandidate(value, basePath);
                    }
                }

                const filesValue = normalizedArgs['files'];
                if (Array.isArray(filesValue)) {
                    normalizedArgs['files'] = filesValue.map(entry => {
                        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
                            return entry;
                        }
                        const record = entry as JsonObject;
                        const filePath = record['path'];
                        if (typeof filePath === 'string' && filePath.trim().length > 0) {
                            return { ...record, path: this.resolveFsPathCandidate(filePath, basePath) };
                        }
                        return record;
                    });
                }
            }

            const result = await this.options.mcp.dispatch(server, tool, normalizedArgs);
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


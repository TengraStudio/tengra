/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as path from 'path';

import { ipc } from '@main/core/ipc-decorators';
import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { AdvancedMemoryService } from '@main/services/llm/advanced-memory.service';
import { MemoryContextService } from '@main/services/llm/memory-context.service';
import { CommandService } from '@main/services/system/command.service';
import { ToolExecutor } from '@main/tools/tool-executor';
import { withOperationGuard } from '@main/utils/operation-wrapper.util';
import { WORKSPACE_AGENT_METADATA_KEY } from '@shared/constants/defaults';
import { TOOLS_CHANNELS } from '@shared/constants/ipc-channels';
import { JsonObject, RuntimeValue } from '@shared/types/common';
import type { WorkspaceAgentPermissionPolicy } from '@shared/types/workspace-agent-session';
import { z } from 'zod';

type UnsafeValue = ReturnType<typeof JSON.parse>;

// Schemas
const toolNameSchema = z.string().min(1).max(64);
const toolCallIdSchema = z.string().min(1).max(128);
const toolArgsSchema = z.record(z.string(), z.any());

const toolExecuteRequestSchema = z.object({
    toolName: toolNameSchema,
    args: toolArgsSchema,
    toolCallId: toolCallIdSchema.optional(),
    workspaceAgentSessionId: z.string().uuid().optional(),
});

const toolExecuteResponseSchema = z.object({
    success: z.boolean(),
    result: z.unknown().optional(),
    error: z.string().optional(),
    errorType: z.enum(['timeout', 'limit', 'permission', 'notFound', 'unknown']).optional(),
});

const DEFAULT_PERMISSION_POLICY: WorkspaceAgentPermissionPolicy = {
    commandPolicy: 'ask-every-time',
    pathPolicy: 'workspace-root-only',
    allowedCommands: [],
    disallowedCommands: [],
    allowedPaths: [],
};

const URI_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;
const WINDOWS_ENV_PATTERN = /%([^%]+)%/g;

export class ToolsService extends BaseService {
    private readonly memoryContextService: MemoryContextService;

    constructor(
        private readonly toolExecutor: ToolExecutor,
        private readonly commandService: CommandService,
        private readonly databaseService: DatabaseService,
        private readonly advancedMemoryService?: AdvancedMemoryService
    ) {
        super('ToolsService');
        this.memoryContextService = new MemoryContextService(advancedMemoryService);
    }

    @ipc({
        channel: 'tools:execute',
        argsSchema: z.tuple([toolExecuteRequestSchema]),
        defaultValue: { success: false, error: 'Execution failed', errorType: 'unknown' }
    })
    async executeTool(payload: {
        toolName: string;
        args: JsonObject;
        toolCallId?: string;
        workspaceAgentSessionId?: string;
    }) {
        const startedAt = Date.now();

        appLogger.info(
            'tools',
            `execute:start tool=${payload.toolName}, toolCallId=${payload.toolCallId ?? 'none'}, sessionId=${payload.workspaceAgentSessionId ?? 'none'}`
        );

        if (payload.workspaceAgentSessionId) {
            (payload.args as Record<string, UnsafeValue>)['__chatSessionId'] = payload.workspaceAgentSessionId;
            const permissionContext = await this.getWorkspaceAgentPermissionContext(
                payload.workspaceAgentSessionId
            );

            if (permissionContext) {
                const { workspacePath } = permissionContext;
                this.applyWorkspacePathNormalization(payload.args as JsonObject, workspacePath);
            }
        }

        const permissionResult = await this.guardWorkspaceAgentToolExecution({
            toolName: payload.toolName,
            args: payload.args as JsonObject,
            sessionId: payload.workspaceAgentSessionId,
        });

        if (permissionResult) {
            appLogger.warn(
                'tools',
                `execute:permission-blocked tool=${payload.toolName}, toolCallId=${payload.toolCallId ?? 'none'}, durationMs=${Date.now() - startedAt}, error=${permissionResult.error}`
            );
            if (this.advancedMemoryService) {
                const workspaceContext = payload.workspaceAgentSessionId
                    ? await this.getWorkspaceAgentPermissionContext(payload.workspaceAgentSessionId)
                    : null;
                this.memoryContextService.rememberInsight({
                    content:
                    this.compactToolText(
                        `Tool execution blocked by permission policy. tool=${payload.toolName}; reason=${permissionResult.error}`,
                        800
                    ),
                    sourceId: `tools:${payload.toolCallId ?? payload.workspaceAgentSessionId ?? Date.now()}`,
                    category: 'workflow',
                    tags: ['tool-execution', 'permission-policy', `tool:${payload.toolName}`],
                    workspaceId: workspaceContext?.workspaceId
                });
            }
            return permissionResult;
        }

        const result = await withOperationGuard('tools', () => this.toolExecutor.execute(payload.toolName, payload.args as JsonObject));
        
        appLogger.info(
            'tools',
            `execute:finish tool=${payload.toolName}, toolCallId=${payload.toolCallId ?? 'none'}, success=${String(result.success)}, durationMs=${Date.now() - startedAt}, errorType=${result.errorType ?? 'none'}`
        );

        if (this.advancedMemoryService) {
            const workspaceContext = payload.workspaceAgentSessionId
                ? await this.getWorkspaceAgentPermissionContext(payload.workspaceAgentSessionId)
                : null;
            const workspaceId = workspaceContext?.workspaceId;
            const commandText = typeof payload.args.command === 'string'
                ? payload.args.command
                : typeof payload.args.input === 'string'
                    ? payload.args.input
                    : '';

            if (!result.success) {
                const failureContent = this.compactToolText(
                    `Tool execution failed. tool=${payload.toolName}; errorType=${result.errorType ?? 'UnsafeValue'}; error=${result.error ?? 'UnsafeValue'}; command=${commandText || 'n/a'}`,
                    1000
                );
                this.memoryContextService.rememberInsight({
                    content: failureContent,
                    sourceId: `tools:${payload.toolCallId ?? payload.workspaceAgentSessionId ?? Date.now()}`,
                    category: 'technical',
                    tags: ['tool-execution', 'error-fix', `tool:${payload.toolName}`],
                    workspaceId
                });
            } else {
                const serializedResult = this.safeStringifyToolPayload((result.result ?? null) as RuntimeValue);
                const signalText = `${commandText}\n${serializedResult}`;
                if (this.looksLikeErrorText(signalText)) {
                    const successResolution = this.compactToolText(
                        `Tool-assisted resolution path. tool=${payload.toolName}; command=${commandText || 'n/a'}; result=${serializedResult}`,
                        1000
                    );
                    this.memoryContextService.rememberInsight({
                        content: successResolution,
                        sourceId: `tools:${payload.toolCallId ?? payload.workspaceAgentSessionId ?? Date.now()}`,
                        category: 'technical',
                        tags: ['tool-execution', 'resolution', `tool:${payload.toolName}`],
                        workspaceId
                    });
                }
            }
        }

        return result;
    }

    @ipc({
        channel: 'tools:kill',
        argsSchema: z.tuple([z.string()]),
        defaultValue: false
    })
    async killTool(toolCallId: string) {
        return this.commandService.killCommand(toolCallId);
    }

    @ipc({
        channel: TOOLS_CHANNELS.GET_DEFINITIONS,
        defaultValue: []
    })
    async getDefinitions() {
        appLogger.info('tools', `[Main] ${TOOLS_CHANNELS.GET_DEFINITIONS} called`);
        try {
            const defs = await this.toolExecutor.getToolDefinitions();
            appLogger.info('tools', '[Main] tool definitions returned:', defs.length);
            return JSON.parse(JSON.stringify(defs));
        } catch (e) {
            appLogger.error('tools', `[Main] ${TOOLS_CHANNELS.GET_DEFINITIONS} error:`, e as Error);
            return [];
        }
    }

    private async guardWorkspaceAgentToolExecution(options: {
        toolName: string;
        args: JsonObject;
        sessionId?: string;
    }): Promise<null | {
        success: false;
        error: string;
        errorType: 'permission';
    }> {
        if (!options.sessionId) {
            return null;
        }

        const permissionContext = await this.getWorkspaceAgentPermissionContext(options.sessionId);
        if (!permissionContext) {
            return null;
        }

        const { permissionPolicy, workspacePath } = permissionContext;
        const pathCandidates = this.getPathCandidates(options.args);

        if (options.toolName === 'execute_command' || options.toolName === 'terminal_session_write') {
            const command = typeof options.args.command === 'string'
                ? options.args.command
                : typeof options.args.input === 'string' && options.args.inputKind !== 'input'
                    ? options.args.input
                    : '';
            const commandBase = this.getCommandBase(command);
            if (
                permissionPolicy.disallowedCommands.some(disallowedCommand =>
                    disallowedCommand.trim().toLowerCase() === commandBase
                )
            ) {
                return {
                    success: false,
                    error: `Command '${commandBase || command}' is explicitly blocked for this workspace session.`,
                    errorType: 'permission',
                };
            }
            if (permissionPolicy.commandPolicy === 'blocked') {
                return {
                    success: false,
                    error: 'Command execution is blocked for this workspace session.',
                    errorType: 'permission',
                };
            }
            if (permissionPolicy.commandPolicy === 'ask-every-time') {
                return {
                    success: false,
                    error: 'Command execution requires explicit approval for this workspace session.',
                    errorType: 'permission',
                };
            }
            if (
                permissionPolicy.commandPolicy === 'allowlist' &&
                !permissionPolicy.allowedCommands.some(allowedCommand =>
                    allowedCommand.trim().toLowerCase() === commandBase
                )
            ) {
                return {
                    success: false,
                    error: `Command '${commandBase || command}' is not allowed for this workspace session.`,
                    errorType: 'permission',
                };
            }
        }

        const blockedPath = this.getBlockedPathCandidate(pathCandidates, workspacePath, permissionPolicy);
        if (blockedPath) {
            const resolvedBlockedPath = this.getResolvedCandidatePathForLog(blockedPath, workspacePath);
            const resolvedWorkspacePath = this.canonicalizePath(workspacePath);
            const resolvedAllowedPaths = this.getResolvedAllowedPathsForLog(permissionPolicy, workspacePath);
            appLogger.warn(
                'tools',
                `execute:path-policy-blocked policy=${permissionPolicy.pathPolicy}, blocked=${resolvedBlockedPath}, workspace=${resolvedWorkspacePath}, allowed=${JSON.stringify(resolvedAllowedPaths)}`
            );
            return {
                success: false,
                error: `Path access is not allowed for this workspace session: ${resolvedBlockedPath}`,
                errorType: 'permission',
            };
        }

        return null;
    }

    private async getWorkspaceAgentPermissionContext(sessionId: string): Promise<{
        permissionPolicy: WorkspaceAgentPermissionPolicy;
        workspacePath: string;
        workspaceId?: string;
    } | null> {
        const chat = await this.databaseService.getChat(sessionId);
        if (!chat?.workspaceId) {
            return null;
        }

        const workspace = await this.databaseService.getWorkspace(chat.workspaceId);
        if (!workspace?.path) {
            return null;
        }

        const metadata = chat.metadata?.[WORKSPACE_AGENT_METADATA_KEY];
        const sessionMetadata =
            metadata && typeof metadata === 'object' && !Array.isArray(metadata)
                ? metadata as { permissionPolicy?: WorkspaceAgentPermissionPolicy }
                : {};

        return {
            permissionPolicy: sessionMetadata.permissionPolicy ?? {
                ...DEFAULT_PERMISSION_POLICY,
                allowedPaths: [workspace.path],
            },
            workspacePath: workspace.path,
            workspaceId: chat.workspaceId,
        };
    }

    private getPathCandidates(args: JsonObject): string[] {
        const candidates: string[] = [];
        const pathKeys = [
            'path', 'cwd', 'source', 'destination', 'oldPath', 'newPath', 'localPath', 'remotePath',
        ] as const;

        for (const key of pathKeys) {
            const candidate = this.normalizePathCandidate(args[key]);
            if (candidate) {
                candidates.push(candidate);
            }
        }

        const files = args.files;
        if (Array.isArray(files)) {
            for (const entry of files) {
                if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
                    const candidate = this.normalizePathCandidate((entry as UnsafeValue).path);
                    if (candidate) {
                        candidates.push(candidate);
                    }
                }
            }
        }

        const paths = args.paths;
        if (Array.isArray(paths)) {
            for (const entry of paths) {
                const candidate = this.normalizePathCandidate(entry);
                if (candidate) {
                    candidates.push(candidate);
                }
            }
        }

        return candidates;
    }

    private normalizePathCandidate(value: RuntimeValue): string | null {
        if (typeof value !== 'string') {
            return null;
        }
        const trimmed = value.trim().replace(/^["']|["']$/g, '');
        return trimmed.length > 0 ? trimmed : null;
    }

    private isUriLikePath(candidatePath: string): boolean {
        return URI_SCHEME_PATTERN.test(candidatePath);
    }

    private canonicalizePath(inputPath: string): string {
        const resolvedPath = path.resolve(path.normalize(inputPath));
        const unixLike = resolvedPath.replace(/[\\/]+$/g, '').replace(/\\/g, '/');
        return process.platform === 'win32' ? unixLike.toLowerCase() : unixLike;
    }

    private expandEnvAndHomePath(inputPath: string): string {
        const withWindowsEnv = inputPath.replace(WINDOWS_ENV_PATTERN, (_match, variableName: string) => {
            const envValue = process.env[variableName];
            return typeof envValue === 'string' && envValue.length > 0 ? envValue : `%${variableName}%`;
        });

        const unixEnvMatch = withWindowsEnv.match(/^\$(\{)?([A-Za-z_][A-Za-z0-9_]*)(\})?/);
        const unixEnvName = unixEnvMatch?.[2];
        let expanded = withWindowsEnv;

        if (unixEnvName) {
            const envValue = process.env[unixEnvName];
            if (typeof envValue === 'string' && envValue.length > 0) {
                expanded = expanded.replace(unixEnvMatch[0], envValue);
            }
        }

        if (expanded === '~' || expanded.startsWith('~/') || expanded.startsWith('~\\')) {
            const homeDirectory = process.env.USERPROFILE ?? process.env.HOME;
            if (homeDirectory && homeDirectory.length > 0) {
                if (expanded === '~') { return homeDirectory; }
                return path.join(homeDirectory, expanded.slice(2));
            }
        }

        return expanded;
    }

    private resolvePathForWorkspace(candidatePath: string, workspacePath: string): string {
        if (this.isUriLikePath(candidatePath)) { return candidatePath; }
        const expandedPath = this.expandEnvAndHomePath(candidatePath);
        const absolutePath = path.isAbsolute(expandedPath) ? expandedPath : path.resolve(workspacePath, expandedPath);
        return this.canonicalizePath(absolutePath);
    }

    private isSubPath(candidatePath: string, rootPath: string): boolean {
        const normalizedCandidate = this.canonicalizePath(candidatePath);
        const normalizedRoot = this.canonicalizePath(rootPath);
        return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}/`);
    }

    private isPathAllowed(candidatePath: string, workspacePath: string, permissionPolicy: WorkspaceAgentPermissionPolicy): boolean {
        if (permissionPolicy.pathPolicy === 'restricted-off-dangerous' || permissionPolicy.pathPolicy === 'full-access') {
            return true;
        }
        if (this.isUriLikePath(candidatePath)) { return true; }
        const resolvedCandidatePath = this.resolvePathForWorkspace(candidatePath, workspacePath);
        const resolvedWorkspacePath = this.canonicalizePath(workspacePath);
        if (permissionPolicy.pathPolicy === 'workspace-root-only') {
            return this.isSubPath(resolvedCandidatePath, resolvedWorkspacePath);
        }
        return permissionPolicy.allowedPaths.some(allowedPath => {
            const resolvedAllowedPath = this.resolvePathForWorkspace(allowedPath, workspacePath);
            return this.isSubPath(resolvedCandidatePath, resolvedAllowedPath);
        }) || this.isSubPath(resolvedCandidatePath, resolvedWorkspacePath);
    }

    private applyWorkspacePathNormalization(args: JsonObject, workspacePath: string): void {
        const pathKeys = ['path', 'cwd', 'dirPath', 'filePath', 'source', 'destination'] as const;
        for (const key of pathKeys) {
            const val = args[key];
            const candidate = this.normalizePathCandidate(val);
            if (candidate) {
                args[key] = this.resolvePathForWorkspace(candidate, workspacePath);
            }
        }

        const files = args.files;
        if (Array.isArray(files)) {
            for (const entry of files) {
                if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
                    const candidate = this.normalizePathCandidate((entry as UnsafeValue).path);
                    if (candidate) {
                        (entry as UnsafeValue).path = this.resolvePathForWorkspace(candidate, workspacePath);
                    }
                }
            }
        }

        const paths = args.paths;
        if (Array.isArray(paths)) {
            args.paths = paths.map(entry => {
                const candidate = this.normalizePathCandidate(entry);
                return candidate ? this.resolvePathForWorkspace(candidate, workspacePath) : entry;
            });
        }
    }

    private getBlockedPathCandidate(pathCandidates: string[], workspacePath: string, permissionPolicy: WorkspaceAgentPermissionPolicy): string | null {
        for (const candidatePath of pathCandidates) {
            if (!this.isPathAllowed(candidatePath, workspacePath, permissionPolicy)) {
                return candidatePath;
            }
        }
        return null;
    }

    private getResolvedCandidatePathForLog(candidatePath: string, workspacePath: string): string {
        return this.isUriLikePath(candidatePath) ? candidatePath : this.resolvePathForWorkspace(candidatePath, workspacePath);
    }

    private getResolvedAllowedPathsForLog(permissionPolicy: WorkspaceAgentPermissionPolicy, workspacePath: string): string[] {
        return permissionPolicy.allowedPaths.map(allowedPath => this.resolvePathForWorkspace(allowedPath, workspacePath));
    }

    private getCommandBase(command: string): string {
        return command.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
    }

    private safeStringifyToolPayload(value: RuntimeValue): string {
        try { return JSON.stringify(value); } catch { return '[unserializable-tool-payload]'; }
    }

    private compactToolText(value: string, maxLength: number): string {
        const normalized = value.replace(/\s+/g, ' ').trim();
        return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
    }

    private looksLikeErrorText(value: string): boolean {
        return /\b(error|exception|failed|failure|cannot|timeout|typeerror|referenceerror|enoent|eacces)\b/i.test(value);
    }
}


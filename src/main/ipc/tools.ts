import * as path from 'path';

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import { DatabaseService } from '@main/services/data/database.service';
import { CommandService } from '@main/services/system/command.service';
import { ToolExecutor } from '@main/tools/tool-executor';
import { createSafeIpcHandler, createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { withOperationGuard } from '@main/utils/operation-wrapper.util';
import { TOOLS_CHANNELS } from '@shared/constants/ipc-channels';
import { JsonObject, RuntimeValue } from '@shared/types/common';
import type { WorkspaceAgentPermissionPolicy } from '@shared/types/workspace-agent-session';
import { BrowserWindow, ipcMain } from 'electron';
import { z } from 'zod';

import { toolArgsSchema, toolCallIdSchema, toolNameSchema } from './validation';

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

import { WORKSPACE_AGENT_METADATA_KEY } from '@shared/constants/defaults';

const DEFAULT_PERMISSION_POLICY: WorkspaceAgentPermissionPolicy = {
    commandPolicy: 'ask-every-time',
    pathPolicy: 'workspace-root-only',
    allowedCommands: [],
    disallowedCommands: [],
    allowedPaths: [],
};

const URI_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;
const WINDOWS_ENV_PATTERN = /%([^%]+)%/g;

function normalizePathCandidate(value: RuntimeValue): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim().replace(/^["']|["']$/g, '');
    return trimmed.length > 0 ? trimmed : null;
}

function isUriLikePath(candidatePath: string): boolean {
    return URI_SCHEME_PATTERN.test(candidatePath);
}

function trimTrailingSeparators(inputPath: string): string {
    if (inputPath === '/' || /^[a-z]:\/$/i.test(inputPath)) {
        return inputPath;
    }
    return inputPath.replace(/[\\/]+$/g, '');
}

function canonicalizePath(inputPath: string): string {
    const resolvedPath = path.resolve(path.normalize(inputPath));
    const unixLike = trimTrailingSeparators(resolvedPath.replace(/\\/g, '/'));
    return process.platform === 'win32' ? unixLike.toLowerCase() : unixLike;
}

function expandEnvAndHomePath(inputPath: string): string {
    const withWindowsEnv = inputPath.replace(WINDOWS_ENV_PATTERN, (_match, variableName: string) => {
        const envValue = process.env[variableName];
        return typeof envValue === 'string' && envValue.length > 0
            ? envValue
            : `%${variableName}%`;
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
            if (expanded === '~') {
                return homeDirectory;
            }
            return path.join(homeDirectory, expanded.slice(2));
        }
    }

    return expanded;
}

function resolvePathForWorkspace(candidatePath: string, workspacePath: string): string {
    if (isUriLikePath(candidatePath)) {
        return candidatePath;
    }

    const expandedPath = expandEnvAndHomePath(candidatePath);
    const absolutePath = path.isAbsolute(expandedPath)
        ? expandedPath
        : path.resolve(workspacePath, expandedPath);
    return canonicalizePath(absolutePath);
}

function resolveAllowedPath(allowedPath: string, workspacePath: string): string {
    return resolvePathForWorkspace(allowedPath, workspacePath);
}

function getCommandBase(command: string): string {
    return command
        .trim()
        .split(/\s+/)[0]
        ?.toLowerCase() ?? '';
}

function getPathCandidates(args: JsonObject): string[] {
    const candidates: string[] = [];
    const pathKeys = [
        'path',
        'cwd',
        'source',
        'destination',
        'oldPath',
        'newPath',
        'localPath',
        'remotePath',
    ] as const;

    for (const key of pathKeys) {
        const candidate = normalizePathCandidate(args[key]);
        if (candidate) {
            candidates.push(candidate);
        }
    }

    const files = args.files;
    if (Array.isArray(files)) {
        for (const entry of files) {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
                continue;
            }
            const candidate = normalizePathCandidate(entry.path);
            if (candidate) {
                candidates.push(candidate);
            }
        }
    }

    const paths = args.paths;
    if (Array.isArray(paths)) {
        for (const entry of paths) {
            const candidate = normalizePathCandidate(entry);
            if (candidate) {
                candidates.push(candidate);
            }
        }
    }

    return candidates;
}

function isSubPath(candidatePath: string, rootPath: string): boolean {
    const normalizedCandidate = canonicalizePath(candidatePath);
    const normalizedRoot = canonicalizePath(rootPath);
    return (
        normalizedCandidate === normalizedRoot ||
        normalizedCandidate.startsWith(`${normalizedRoot}/`)
    );
}

function isPathAllowed(
    candidatePath: string,
    workspacePath: string,
    permissionPolicy: WorkspaceAgentPermissionPolicy
): boolean {
    if (permissionPolicy.pathPolicy === 'restricted-off-dangerous' || permissionPolicy.pathPolicy === 'full-access') {
        return true;
    }

    if (isUriLikePath(candidatePath)) {
        return true;
    }

    const resolvedCandidatePath = resolvePathForWorkspace(candidatePath, workspacePath);
    const resolvedWorkspacePath = canonicalizePath(workspacePath);

    if (permissionPolicy.pathPolicy === 'workspace-root-only') {
        return isSubPath(resolvedCandidatePath, resolvedWorkspacePath);
    }

    return permissionPolicy.allowedPaths.some(allowedPath => {
        const resolvedAllowedPath = resolveAllowedPath(allowedPath, workspacePath);
        return isSubPath(resolvedCandidatePath, resolvedAllowedPath);
    }) || isSubPath(resolvedCandidatePath, resolvedWorkspacePath);
}

function normalizeWorkspacePathArg(
    inputValue: RuntimeValue,
    workspacePath: string
): string | null {
    const candidate = normalizePathCandidate(inputValue);
    if (!candidate) {
        return null;
    }
    return resolvePathForWorkspace(candidate, workspacePath);
}

function normalizeWorkspacePathKey(
    args: JsonObject,
    key: string,
    workspacePath: string
): void {
    const normalized = normalizeWorkspacePathArg(args[key], workspacePath);
    if (normalized) {
        args[key] = normalized;
    }
}

function normalizeWorkspaceScalarPaths(args: JsonObject, workspacePath: string): void {
    const pathKeys = ['path', 'cwd', 'dirPath', 'filePath', 'source', 'destination'] as const;
    for (const key of pathKeys) {
        normalizeWorkspacePathKey(args, key, workspacePath);
    }
}

function normalizeWorkspaceBatchPaths(args: JsonObject, workspacePath: string): void {
    const files = args.files;
    if (Array.isArray(files)) {
        for (const entry of files) {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
                continue;
            }
            const candidate = normalizeWorkspacePathArg(entry.path, workspacePath);
            if (candidate) {
                entry.path = candidate;
            }
        }
    }

    const paths = args.paths;
    if (Array.isArray(paths)) {
        args.paths = paths.map(entry => {
            const candidate = normalizeWorkspacePathArg(entry, workspacePath);
            return candidate ?? entry;
        });
    }
}

function applyWorkspacePathNormalization(args: JsonObject, workspacePath: string): void {
    normalizeWorkspaceScalarPaths(args, workspacePath);
    normalizeWorkspaceBatchPaths(args, workspacePath);
}

function getBlockedPathCandidate(
    pathCandidates: string[],
    workspacePath: string,
    permissionPolicy: WorkspaceAgentPermissionPolicy
): string | null {
    for (const candidatePath of pathCandidates) {
        if (!isPathAllowed(candidatePath, workspacePath, permissionPolicy)) {
            return candidatePath;
        }
    }
    return null;
}

function getResolvedCandidatePathForLog(candidatePath: string, workspacePath: string): string {
    if (isUriLikePath(candidatePath)) {
        return candidatePath;
    }
    return resolvePathForWorkspace(candidatePath, workspacePath);
}

function getResolvedAllowedPathsForLog(
    permissionPolicy: WorkspaceAgentPermissionPolicy,
    workspacePath: string
): string[] {
    return permissionPolicy.allowedPaths.map(allowedPath =>
        resolveAllowedPath(allowedPath, workspacePath)
    );
}

async function getWorkspaceAgentPermissionContext(
    sessionId: string,
    databaseService: DatabaseService
): Promise<{
    permissionPolicy: WorkspaceAgentPermissionPolicy;
    workspacePath: string;
} | null> {
    const chat = await databaseService.getChat(sessionId);
    if (!chat?.workspaceId) {
        return null;
    }

    const workspace = await databaseService.getWorkspace(chat.workspaceId);
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
    };
}

async function guardWorkspaceAgentToolExecution(options: {
    toolName: string;
    args: JsonObject;
    sessionId?: string;
    databaseService: DatabaseService;
}): Promise<null | {
    success: false;
    error: string;
    errorType: 'permission';
}> {
    if (!options.sessionId) {
        return null;
    }

    const permissionContext = await getWorkspaceAgentPermissionContext(
        options.sessionId,
        options.databaseService
    );
    if (!permissionContext) {
        return null;
    }

    const { permissionPolicy, workspacePath } = permissionContext;
    const pathCandidates = getPathCandidates(options.args);

    if (options.toolName === 'execute_command' || options.toolName === 'terminal_session_write') {
        const command = typeof options.args.command === 'string'
            ? options.args.command
            : typeof options.args.input === 'string' && options.args.inputKind !== 'input'
                ? options.args.input
                : '';
        const commandBase = getCommandBase(command);
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

    const blockedPath = getBlockedPathCandidate(pathCandidates, workspacePath, permissionPolicy);
    if (blockedPath) {
        const resolvedBlockedPath = getResolvedCandidatePathForLog(blockedPath, workspacePath);
        const resolvedWorkspacePath = canonicalizePath(workspacePath);
        const resolvedAllowedPaths = getResolvedAllowedPathsForLog(permissionPolicy, workspacePath);
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

export function registerToolsIpc(
    getMainWindow: () => BrowserWindow | null,
    toolExecutor: ToolExecutor,
    commandService: CommandService,
    databaseService: DatabaseService
) {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'tools operation');

    ipcMain.handle('tools:execute', createValidatedIpcHandler('tools:execute', async (event, payload: {
        toolName: string;
        args: JsonObject;
        toolCallId?: string;
        workspaceAgentSessionId?: string;
    }) => {
        validateSender(event);
        const startedAt = Date.now();
        appLogger.info(
            'tools',
            `execute:start tool=${payload.toolName}, toolCallId=${payload.toolCallId ?? 'none'}, sessionId=${payload.workspaceAgentSessionId ?? 'none'}`
        );

        // AGT-LOOP-03: Pre-process arguments to normalize paths against workspace root
        if (payload.workspaceAgentSessionId) {
            const permissionContext = await getWorkspaceAgentPermissionContext(
                payload.workspaceAgentSessionId,
                databaseService
            );

            if (permissionContext) {
                const { workspacePath } = permissionContext;
                applyWorkspacePathNormalization(payload.args, workspacePath);
            }
        }

        const permissionResult = await guardWorkspaceAgentToolExecution({
            toolName: payload.toolName,
            args: payload.args,
            sessionId: payload.workspaceAgentSessionId,
            databaseService,
        });

        if (permissionResult) {
            appLogger.warn(
                'tools',
                `execute:permission-blocked tool=${payload.toolName}, toolCallId=${payload.toolCallId ?? 'none'}, durationMs=${Date.now() - startedAt}, error=${permissionResult.error}`
            );
            return permissionResult;
        }

        const result = await withOperationGuard('tools', () => toolExecutor.execute(payload.toolName, payload.args));
        appLogger.info(
            'tools',
            `execute:finish tool=${payload.toolName}, toolCallId=${payload.toolCallId ?? 'none'}, success=${String(result.success)}, durationMs=${Date.now() - startedAt}, errorType=${result.errorType ?? 'none'}`
        );
        return result;
    }, {
        argsSchema: z.tuple([toolExecuteRequestSchema]),
        responseSchema: toolExecuteResponseSchema
    }));

    ipcMain.handle('tools:kill', createValidatedIpcHandler('tools:kill', async (event, toolCallId: string) => {
        validateSender(event);
        return commandService.killCommand(toolCallId);
    }, {
        argsSchema: z.tuple([toolCallIdSchema])
    }));

    ipcMain.handle(TOOLS_CHANNELS.GET_DEFINITIONS, createSafeIpcHandler(TOOLS_CHANNELS.GET_DEFINITIONS, async (event) => {
        validateSender(event);
        appLogger.info('tools', `[Main] ${TOOLS_CHANNELS.GET_DEFINITIONS} called`);
        try {
            const defs = await toolExecutor.getToolDefinitions();
            appLogger.info('tools', '[Main] tool definitions returned:', defs.length);
            // Ensure the definitions are serializable by converting to plain JSON
            return JSON.parse(JSON.stringify(defs));
        } catch (e) {
            appLogger.error('tools', `[Main] ${TOOLS_CHANNELS.GET_DEFINITIONS} error:`, e as Error);
            return [];
        }
    }, []));
}

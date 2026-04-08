import * as path from 'path';

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import { DatabaseService } from '@main/services/data/database.service';
import { CommandService } from '@main/services/system/command.service';
import { ToolExecutor } from '@main/tools/tool-executor';
import { createSafeIpcHandler, createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { withRateLimit } from '@main/utils/rate-limiter.util';
import { TOOLS_CHANNELS } from '@shared/constants/ipc-channels';
import { JsonObject } from '@shared/types/common';
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

function normalizePathCandidate(value: RuntimeValue): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
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
    const normalizedCandidate = candidatePath.replace(/\\/g, '/').toLowerCase();
    const normalizedRoot = rootPath.replace(/\\/g, '/').toLowerCase();
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

    if (!candidatePath.includes(':') && !candidatePath.startsWith('/') && !candidatePath.startsWith('\\')) {
        return true;
    }

    if (permissionPolicy.pathPolicy === 'workspace-root-only') {
        return isSubPath(candidatePath, workspacePath);
    }

    return permissionPolicy.allowedPaths.some(allowedPath =>
        isSubPath(candidatePath, allowedPath)
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

    const blockedPath = pathCandidates.find(
        candidatePath =>
            !isPathAllowed(candidatePath, workspacePath, permissionPolicy)
    );
    if (blockedPath) {
        return {
            success: false,
            error: `Path access is not allowed for this workspace session: ${blockedPath}`,
            errorType: 'permission',
        };
    }

    return null;
}

function normalizeWorkspaceBatchPaths(args: JsonObject, workspacePath: string): void {
    const files = args.files;
    if (Array.isArray(files)) {
        for (const entry of files) {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
                continue;
            }
            if (typeof entry.path === 'string' && entry.path.trim().length > 0 && !path.isAbsolute(entry.path)) {
                entry.path = path.join(workspacePath, entry.path);
            }
        }
    }

    const paths = args.paths;
    if (Array.isArray(paths)) {
        args.paths = paths.map(entry =>
            typeof entry === 'string' && entry.trim().length > 0 && !path.isAbsolute(entry)
                ? path.join(workspacePath, entry)
                : entry
        );
    }
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

        // AGT-LOOP-03: Pre-process arguments to normalize paths against workspace root
        if (payload.workspaceAgentSessionId) {
            const permissionContext = await getWorkspaceAgentPermissionContext(
                payload.workspaceAgentSessionId,
                databaseService
            );

            if (permissionContext) {
                const { workspacePath } = permissionContext;
                const pathKeys = ['path', 'cwd', 'dirPath', 'filePath', 'source', 'destination'];

                for (const key of pathKeys) {
                    const argValue = payload.args[key];
                    if (typeof argValue === 'string' && argValue.trim().length > 0 && !path.isAbsolute(argValue)) {
                        payload.args[key] = path.join(workspacePath, argValue);
                    }
                }

                normalizeWorkspaceBatchPaths(payload.args, workspacePath);
            }
        }

        const permissionResult = await guardWorkspaceAgentToolExecution({
            toolName: payload.toolName,
            args: payload.args,
            sessionId: payload.workspaceAgentSessionId,
            databaseService,
        });

        if (permissionResult) {
            return permissionResult;
        }

        return await withRateLimit('tools', () => toolExecutor.execute(payload.toolName, payload.args));
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

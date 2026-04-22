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

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import { AuditLogService } from '@main/services/analysis/audit-log.service';
import { DatabaseService } from '@main/services/data/database.service';
import { LogoService } from '@main/services/external/logo.service';
import { InlineSuggestionService } from '@main/services/llm/inline-suggestion.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { CodeIntelligenceService } from '@main/services/workspace/code-intelligence.service';
import { WorkspaceService } from '@main/services/workspace/workspace.service';
import {
    DEFAULT_WORKSPACE_SCAN_IGNORE_PATTERNS,
    getWorkspaceIgnoreMatcher,
} from '@main/services/workspace/workspace-ignore.util';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import {
    inlineSuggestionRequestSchema,
    inlineSuggestionResponseSchema,
    inlineSuggestionTelemetrySchema,
} from '@shared/schemas/inline-suggestions.schema';
import {
    DirectoryAnalysisSchema,
    GenerateLogoOptionsSchema,
    WorkspaceActiveRootPathSchema,
    WorkspaceActiveStateSchema,
    WorkspaceAnalysisSchema,
    WorkspaceDefinitionLocationsSchema,
    WorkspaceEnvVarsSchema,
    WorkspaceFileDiagnosticsSchema,
    WorkspaceIdentitySchema,
    WorkspaceIdSchema,
    WorkspaceRootPathSchema,
    LargeDataUriSchema,
} from '@shared/schemas/service-hardening.schema';
import { dialog, ipcMain } from 'electron';
import { z } from 'zod';

/** Dependencies required by the workspace IPC handlers. */
export interface WorkspaceIpcDeps {
    /** Service for workspace analysis, watching, and environment management. */
    workspaceService: WorkspaceService;
    /** Service for logo generation and workspace identity analysis. */
    logoService: LogoService;
    /** Service for inline code suggestions and completions. */
    inlineSuggestionService: InlineSuggestionService;
    /** Service for code indexing and symbol search. */
    codeIntelligenceService: CodeIntelligenceService;
    /** Service for scheduling background jobs with debouncing. */
    jobSchedulerService: JobSchedulerService;
    /** Service for database access and workspace lookups. */
    databaseService: DatabaseService;
    /** Optional service for audit logging sensitive/destructive workspace operations. */
    auditLogService?: AuditLogService;
}

interface WorkspaceLookup {
    workspaceId: string;
    rootPath: string;
    indexingEnabled: boolean;
    ignorePatterns: string[];
}

interface WorkspaceLookupCacheEntry {
    lookup: WorkspaceLookup | null;
    expiresAt: number;
}

interface AutoIndexQueueState {
    pendingPaths: Set<string>;
    running: boolean;
}

interface WorkspaceFileChangeEventPayload {
    event: string;
    path: string;
    rootPath: string;
}

interface WorkspaceFileChangeBatchState {
    events: WorkspaceFileChangeEventPayload[];
    timer: ReturnType<typeof setTimeout> | null;
}

const AUTO_INDEX_LOOKUP_TTL_MS = 10_000;
const AUTO_INDEX_DELAY_MS = 2_000;
const AUTO_INDEX_BATCH_SIZE = 12;
const AUTO_INDEX_MAX_PENDING_PATHS = 128;
const WORKSPACE_FILE_CHANGE_BATCH_WINDOW_MS = 50;
const WORKSPACE_FILE_CHANGE_MAX_BATCH_SIZE = 100;
const AUTO_INDEX_SKIPPED_SEGMENTS = [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '.turbo',
    '.cache',
    '.tengra',
    'coverage',
    'logs',
    'vendor',
    'bin',
    'obj',
    'out',
    'target',
    '__pycache__',
    '.venv',
    'venv',
    '.gradle',
    '.idea',
    '.vscode',
    'artifacts',
    'deps',
    'pkg',
    'lib',
    '.svn',
    '.hg',
] as const;

const AUTO_INDEX_SKIPPED_SUFFIXES = [
    '.tmp',
    '.temp',
    '.swp',
    '.swo',
    '.log',
    '.map',
    '~',
    '.exe',
    '.dll',
    '.so',
    '.dylib',
    '.pyc',
    '.class',
] as const;

const WORKSPACE_LOGO_ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']);

function normalizeWorkspacePath(value: string): string {
    return value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function shouldAutoIndexPath(filePath: string): boolean {
    const normalizedPath = normalizeWorkspacePath(filePath);
    const pathSegments = normalizedPath.split('/');
    if (AUTO_INDEX_SKIPPED_SEGMENTS.some(segment => pathSegments.includes(segment))) {
        return false;
    }
    return !AUTO_INDEX_SKIPPED_SUFFIXES.some(suffix => normalizedPath.endsWith(suffix));
}

function isAllowedWorkspaceLogoPath(filePath: string): boolean {
    const extension = path.extname(filePath).toLowerCase();
    return WORKSPACE_LOGO_ALLOWED_EXTENSIONS.has(extension);
}

function createWorkspaceAutoIndexer(
    databaseService: DatabaseService,
    codeIntelligenceService: CodeIntelligenceService,
    jobSchedulerService: JobSchedulerService
): { schedule: (rootPath: string, filePath: string) => void } {
    const workspaceLookupCache = new Map<string, WorkspaceLookupCacheEntry>();
    const autoIndexQueues = new Map<string, AutoIndexQueueState>();

    const resolveWorkspaceLookup = async (
        rootPath: string
    ): Promise<WorkspaceLookup | null> => {
        const normalizedRootPath = normalizeWorkspacePath(rootPath);
        const cachedLookup = workspaceLookupCache.get(normalizedRootPath);
        if (cachedLookup && cachedLookup.expiresAt > Date.now()) {
            return cachedLookup.lookup;
        }

        const workspaces = await databaseService.getWorkspaces();
        const matchedWorkspace = workspaces.find(
            workspace => normalizeWorkspacePath(workspace.path) === normalizedRootPath
        );
        const lookup = matchedWorkspace
            ? {
                workspaceId: matchedWorkspace.id,
                rootPath: matchedWorkspace.path,
                indexingEnabled: matchedWorkspace.advancedOptions?.indexingEnabled !== false,
                ignorePatterns: matchedWorkspace.advancedOptions?.fileWatchIgnore ?? [],
            }
            : null;

        workspaceLookupCache.set(normalizedRootPath, {
            lookup,
            expiresAt: Date.now() + AUTO_INDEX_LOOKUP_TTL_MS,
        });

        return lookup;
    };

    const scheduleQueueRun = (rootPath: string): void => {
        const normalizedRootPath = normalizeWorkspacePath(rootPath);
        jobSchedulerService.schedule(
            `workspace:auto-index:${normalizedRootPath}`,
            async () => {
                const queueState = autoIndexQueues.get(normalizedRootPath);
                if (!queueState || queueState.running) {
                    return;
                }

                queueState.running = true;
                try {
                    const lookup = await resolveWorkspaceLookup(rootPath);
                    if (!lookup) {
                        autoIndexQueues.delete(normalizedRootPath);
                        return;
                    }
                    if (!lookup.indexingEnabled) {
                        autoIndexQueues.delete(normalizedRootPath);
                        return;
                    }

                    const ignoreMatcher = await getWorkspaceIgnoreMatcher(lookup.rootPath, {
                        defaultPatterns: DEFAULT_WORKSPACE_SCAN_IGNORE_PATTERNS,
                        extraPatterns: lookup.ignorePatterns,
                    });

                    const pendingPaths = Array.from(queueState.pendingPaths).slice(
                        0,
                        AUTO_INDEX_BATCH_SIZE
                    );
                    for (const pendingPath of pendingPaths) {
                        queueState.pendingPaths.delete(pendingPath);
                        if (ignoreMatcher.ignoresAbsolute(pendingPath)) {
                            continue;
                        }
                        await codeIntelligenceService.updateFileIndex(
                            lookup.workspaceId,
                            lookup.rootPath,
                            pendingPath
                        );
                    }
                } catch (error) {
                    appLogger.error(
                        'WorkspaceIPC',
                        `Auto-index failed: ${error instanceof Error ? error.message : String(error)}`
                    );
                } finally {
                    queueState.running = false;
                    if (queueState.pendingPaths.size === 0) {
                        autoIndexQueues.delete(normalizedRootPath);
                    } else {
                        scheduleQueueRun(rootPath);
                    }
                }
            },
            AUTO_INDEX_DELAY_MS
        );
    };

    return {
        schedule: (rootPath: string, filePath: string): void => {
            if (!shouldAutoIndexPath(filePath)) {
                return;
            }

            const normalizedRootPath = normalizeWorkspacePath(rootPath);
            const queueState = autoIndexQueues.get(normalizedRootPath) ?? {
                pendingPaths: new Set<string>(),
                running: false,
            };

            if (queueState.pendingPaths.size < AUTO_INDEX_MAX_PENDING_PATHS) {
                queueState.pendingPaths.add(path.resolve(filePath));
            }

            autoIndexQueues.set(normalizedRootPath, queueState);
            scheduleQueueRun(rootPath);
        },
    };
}

/**
 * Registers all workspace-related IPC handlers including analysis, file watching,
 * logo generation, directory analysis, and environment variable management.
 * @param getWindow - Factory function to retrieve the main BrowserWindow
 * @param deps - The workspace IPC dependency container
 * @param allowedFileRoots - Set of allowed root paths for safe-file protocol
 */
export const registerWorkspaceIpc = (
    getWindow: () => Electron.BrowserWindow | null,
    deps: WorkspaceIpcDeps,
    allowedFileRoots: Set<string>
): void => {
    const {
        workspaceService,
        logoService,
        inlineSuggestionService,
        codeIntelligenceService,
        jobSchedulerService,
        databaseService,
        auditLogService,
    } = deps;
    const resolvedWorkspaceService = workspaceService;
    const workspaceAutoIndexer = createWorkspaceAutoIndexer(
        databaseService,
        codeIntelligenceService,
        jobSchedulerService
    );
    const fileChangeBatches = new Map<string, WorkspaceFileChangeBatchState>();

    const flushFileChangeBatch = (rootPath: string): void => {
        const batchState = fileChangeBatches.get(rootPath);
        if (!batchState || batchState.events.length === 0) {
            return;
        }

        if (batchState.timer) {
            clearTimeout(batchState.timer);
            batchState.timer = null;
        }

        const events = batchState.events;
        batchState.events = [];

        const win = getWindow();
        if (!win || win.isDestroyed()) {
            return;
        }

        win.webContents.send('workspace:file-change', events);
    };

    const enqueueFileChangeEvent = (payload: WorkspaceFileChangeEventPayload): void => {
        const existingBatch = fileChangeBatches.get(payload.rootPath);
        const batchState = existingBatch ?? { events: [], timer: null };
        batchState.events.push(payload);
        if (!existingBatch) {
            fileChangeBatches.set(payload.rootPath, batchState);
        }

        if (batchState.events.length >= WORKSPACE_FILE_CHANGE_MAX_BATCH_SIZE) {
            flushFileChangeBatch(payload.rootPath);
            return;
        }

        if (batchState.timer) {
            return;
        }

        batchState.timer = setTimeout(() => {
            flushFileChangeBatch(payload.rootPath);
        }, WORKSPACE_FILE_CHANGE_BATCH_WINDOW_MS);
    };

    const clearFileChangeBatch = (rootPath: string): void => {
        const batchState = fileChangeBatches.get(rootPath);
        if (!batchState) {
            return;
        }
        if (batchState.timer) {
            clearTimeout(batchState.timer);
        }
        fileChangeBatches.delete(rootPath);
    };

    const getActiveWorkspaceState = (): z.infer<typeof WorkspaceActiveStateSchema> => {
        const activeWorkspaceRootPath = resolvedWorkspaceService.getActiveWorkspace();
        return {
            rootPath: typeof activeWorkspaceRootPath === 'string' ? activeWorkspaceRootPath : null,
        };
    };

    /**
     * Internal utility for audit logging sensitive file system operations.
     */
    const logDestructiveAction = async (
        action: string,
        rootPath: string,
        success: boolean,
        details?: Record<string, string | number | boolean>,
        error?: string
    ): Promise<void> => {
        if (!auditLogService) {
            return;
        }
        const context = resolvedWorkspaceService.getAuditContext(rootPath);
        await auditLogService.logFileSystemOperation(action, success, {
            ...context,
            ...(details ?? {}),
            ...(error ? { error } : {}),
        });
    };

    const validateSender = createMainWindowSenderValidator(getWindow, 'workspace operation');

    /**
     * Start deep workspace analysis
     */
    ipcMain.handle(
        'workspace:analyze',
        createValidatedIpcHandler<z.infer<typeof WorkspaceAnalysisSchema>, [string, string | undefined]>(
            'workspace:analyze',
            async (event, rootPath: string, workspaceId: string | undefined): Promise<z.infer<typeof WorkspaceAnalysisSchema>> => {
                validateSender(event);
                appLogger.info(
                    'WorkspaceIPC',
                    `Analyze requested for ${rootPath} (ID: ${workspaceId})`
                );
                
                // Dynamically allow this workspace root for safe-file protocol
                allowedFileRoots.add(path.resolve(rootPath));
                
                const results = await resolvedWorkspaceService.analyzeWorkspace(rootPath);
                return results;
            },
            {
                argsSchema: z.tuple([WorkspaceRootPathSchema, WorkspaceIdSchema.optional()]),
                responseSchema: WorkspaceAnalysisSchema,
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'workspace:getFileDiagnostics',
        createValidatedIpcHandler(
            'workspace:getFileDiagnostics',
            async (event, rootPath: string, filePath: string, content: string) => {
                validateSender(event);
                if (rootPath) {
                    allowedFileRoots.add(path.resolve(rootPath));
                }
                return await resolvedWorkspaceService.getFileDiagnostics(rootPath, filePath, content);
            },
            {
                argsSchema: z.tuple([
                    WorkspaceRootPathSchema,
                    z.string().max(4096),
                    z.string(),
                ]),
                responseSchema: WorkspaceFileDiagnosticsSchema,
                wrapResponse: true,
            }
        )
    );

    ipcMain.handle(
        'workspace:getFileDefinition',
        createValidatedIpcHandler(
            'workspace:getFileDefinition',
            async (
                event,
                rootPath: string,
                filePath: string,
                content: string,
                position: { line: number; column: number }
            ) => {
                validateSender(event);
                if (rootPath) {
                    allowedFileRoots.add(path.resolve(rootPath));
                }
                return await resolvedWorkspaceService.getFileDefinition(
                    rootPath,
                    filePath,
                    content,
                    position.line,
                    position.column
                );
            },
            {
                argsSchema: z.tuple([
                    WorkspaceRootPathSchema,
                    z.string().max(4096),
                    z.string(),
                    z.object({
                        line: z.number().int().positive(),
                        column: z.number().int().positive(),
                    }),
                ]),
                responseSchema: WorkspaceDefinitionLocationsSchema,
                wrapResponse: true,
            }
        )
    );

    /**
     * Start workspace file watching
     */
    ipcMain.handle(
        'workspace:watch',
        createValidatedIpcHandler(
            'workspace:watch',
            async (event, rootPath: string) => {
                validateSender(event);
                if (rootPath) {
                    allowedFileRoots.add(path.resolve(rootPath));
                }
                
                await resolvedWorkspaceService.watchWorkspace(rootPath, (watchEvent: string, filePath: string) => {
                    enqueueFileChangeEvent({
                        event: watchEvent,
                        path: filePath,
                        rootPath,
                    });
                    if (watchEvent === 'change' || watchEvent === 'rename') {
                        workspaceAutoIndexer.schedule(rootPath, filePath);
                    }
                });
                return { success: true };
            },
            {
                argsSchema: z.tuple([WorkspaceRootPathSchema]),
                responseSchema: z.object({ success: z.boolean() }),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'workspace:analyzeSummary',
        createValidatedIpcHandler<
            z.infer<typeof WorkspaceAnalysisSchema>,
            [string, string | undefined]
        >(
            'workspace:analyzeSummary',
            async (
                event,
                rootPath: string,
                workspaceId: string | undefined
            ): Promise<z.infer<typeof WorkspaceAnalysisSchema>> => {
                validateSender(event);
                appLogger.info(
                    'WorkspaceIPC',
                    `Summary analysis requested for ${rootPath} (ID: ${workspaceId})`
                );

                // Dynamically allow this workspace root for safe-file protocol
                allowedFileRoots.add(path.resolve(rootPath));
                
                const results = await resolvedWorkspaceService.analyzeWorkspaceSummary(rootPath);
                return results;
            },
            {
                argsSchema: z.tuple([WorkspaceRootPathSchema, WorkspaceIdSchema.optional()]),
                responseSchema: WorkspaceAnalysisSchema,
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'workspace:setActive',
        createValidatedIpcHandler(
            'workspace:setActive',
            async (event, rootPath: string | null) => {
                validateSender(event);
                if (rootPath) {
                    allowedFileRoots.add(path.resolve(rootPath));
                }
                await resolvedWorkspaceService.setActiveWorkspace(rootPath);
                return getActiveWorkspaceState();
            },
            {
                argsSchema: z.tuple([WorkspaceActiveRootPathSchema]),
                responseSchema: WorkspaceActiveStateSchema,
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'workspace:clearActive',
        createValidatedIpcHandler(
            'workspace:clearActive',
            async (event, rootPath: string | undefined) => {
                validateSender(event);
                await resolvedWorkspaceService.clearActiveWorkspace(rootPath);
                return getActiveWorkspaceState();
            },
            {
                argsSchema: z.tuple([WorkspaceRootPathSchema.optional()]),
                responseSchema: WorkspaceActiveStateSchema,
                wrapResponse: true
            }
        )
    );

    /**
     * Stop workspace file watching
     */
    ipcMain.handle(
        'workspace:unwatch',
        createValidatedIpcHandler(
            'workspace:unwatch',
            async (event, rootPath: string) => {
                validateSender(event);
                flushFileChangeBatch(rootPath);
                clearFileChangeBatch(rootPath);
                await resolvedWorkspaceService.stopWatch(rootPath);
                return { success: true };
            },
            {
                argsSchema: z.tuple([WorkspaceRootPathSchema]),
                responseSchema: z.object({ success: z.boolean() }),
                wrapResponse: true
            }
        )
    );

    /**
     * Generate visual workspace logo
     */
    ipcMain.handle(
        'workspace:generateLogo',
        createValidatedIpcHandler(
            'workspace:generateLogo',
            async (
                event,
                workspacePath: string,
                options: { prompt: string; style: string; model: string; count: number }
            ) => {
                validateSender(event);
                return await logoService.generateLogo(
                    workspacePath,
                    options.prompt,
                    options.style,
                    options.model,
                    options.count
                );
            },
            {
                argsSchema: z.tuple([WorkspaceRootPathSchema, GenerateLogoOptionsSchema]),
                responseSchema: z.array(z.string().max(4096)).max(10),
                wrapResponse: true
            }
        )
    );

    /**
     * Run brand identity analysis for a workspace
     */
    ipcMain.handle(
        'workspace:analyzeIdentity',
        createValidatedIpcHandler(
            'workspace:analyzeIdentity',
            async (event, workspacePath: string) => {
                validateSender(event);
                return await logoService.analyzeWorkspaceIdentity(workspacePath);
            },
            {
                argsSchema: z.tuple([WorkspaceRootPathSchema]),
                responseSchema: WorkspaceIdentitySchema,
                wrapResponse: true
            }
        )
    );

    /**
     * Analyze directory structure
     */
    ipcMain.handle(
        'workspace:analyzeDirectory',
        createValidatedIpcHandler<z.infer<typeof DirectoryAnalysisSchema>, [string]>(
            'workspace:analyzeDirectory',
            async (event, dirPath: string): Promise<z.infer<typeof DirectoryAnalysisSchema>> => {
                validateSender(event);
                return await resolvedWorkspaceService.analyzeDirectory(dirPath);
            },
            {
                argsSchema: z.tuple([WorkspaceRootPathSchema]),
                responseSchema: DirectoryAnalysisSchema,
                wrapResponse: true
            }
        )
    );

    /**
     * Apply a generated logo to the workspace
     */
    ipcMain.handle(
        'workspace:applyLogo',
        createValidatedIpcHandler(
            'workspace:applyLogo',
            async (event, workspacePath: string, tempLogoPath: string) => {
                validateSender(event);
                try {
                    const result = await logoService.applyLogo(workspacePath, tempLogoPath);
                    
                    // Dynamically allow this workspace root for safe-file protocol
                    allowedFileRoots.add(path.resolve(workspacePath));
                    
                    await logDestructiveAction('workspace.apply-logo', workspacePath, true, {
                        hasTempLogoPath: Boolean(tempLogoPath),
                    });
                    return result;
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    await logDestructiveAction('workspace.apply-logo', workspacePath, false, undefined, message);
                    throw error;
                }
            },
            {
                argsSchema: z.tuple([WorkspaceRootPathSchema, LargeDataUriSchema]),
                responseSchema: LargeDataUriSchema,
                wrapResponse: true
            }
        )
    );

    /**
     * Get simple code completion (deprecated pattern, prefer inlineSuggestion)
     */
    ipcMain.handle(
        'workspace:getCompletion',
        createValidatedIpcHandler(
            'workspace:getCompletion',
            async (event, text: string) => {
                validateSender(event);
                return await inlineSuggestionService.getCompletion(text);
            },
            {
                argsSchema: z.tuple([z.string().max(10000)]),
                responseSchema: z.string(),
                wrapResponse: true
            }
        )
    );

    /**
     * Get smart inline code suggestion
     */
    ipcMain.handle(
        'workspace:getInlineSuggestion',
        createValidatedIpcHandler(
            'workspace:getInlineSuggestion',
            async (event, request: z.infer<typeof inlineSuggestionRequestSchema>) => {
                validateSender(event);
                return await inlineSuggestionService.getInlineSuggestion(request);
            },
            {
                argsSchema: z.tuple([inlineSuggestionRequestSchema]),
                responseSchema: inlineSuggestionResponseSchema,
                wrapResponse: true,
            }
        )
    );

    /**
     * Track user interaction with inline suggestions
     */
    ipcMain.handle(
        'workspace:trackInlineSuggestionTelemetry',
        createValidatedIpcHandler(
            'workspace:trackInlineSuggestionTelemetry',
            async (event, eventData: z.infer<typeof inlineSuggestionTelemetrySchema>) => {
                validateSender(event);
                return await inlineSuggestionService.trackTelemetry(eventData);
            },
            {
                argsSchema: z.tuple([inlineSuggestionTelemetrySchema]),
                responseSchema: z.object({ success: z.boolean() }),
                wrapResponse: true,
            }
        )
    );

    /**
     * Refine and improve a logo prompt
     */
    ipcMain.handle(
        'workspace:improveLogoPrompt',
        createValidatedIpcHandler(
            'workspace:improveLogoPrompt',
            async (event, prompt: string) => {
                validateSender(event);
                return await logoService.improveLogoPrompt(prompt);
            },
            {
                argsSchema: z.tuple([z.string().max(5000)]),
                responseSchema: z.string().max(10000),
                wrapResponse: true
            }
        )
    );

    /**
     * Use native dialog to upload an existing logo
     */
    ipcMain.handle(
        'workspace:uploadLogo',
        createValidatedIpcHandler(
            'workspace:uploadLogo',
            async (event, workspacePath: string) => {
                validateSender(event);
                if (workspacePath) {
                    allowedFileRoots.add(path.resolve(workspacePath));
                }
                const result = await dialog.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif', 'webp', 'svg'] }],
                });

                if (result.canceled || result.filePaths.length === 0) {
                    return null;
                }

                const selectedFilePath = result.filePaths[0];
                if (!selectedFilePath || !isAllowedWorkspaceLogoPath(selectedFilePath)) {
                    throw new Error('Invalid logo file type selected');
                }

                return await logoService.applyLogo(workspacePath, selectedFilePath);
            },
            {
                argsSchema: z.tuple([WorkspaceRootPathSchema]),
                responseSchema: LargeDataUriSchema.nullable(),
                wrapResponse: true
            }
        )
    );

    /**
     * Retrieve environment variables for a workspace
     */
    ipcMain.handle(
        'workspace:getEnv',
        createValidatedIpcHandler(
            'workspace:getEnv',
            async (event, rootPath: string) => {
                validateSender(event);
                return await resolvedWorkspaceService.getEnvVars(rootPath);
            },
            {
                argsSchema: z.tuple([WorkspaceRootPathSchema]),
                responseSchema: WorkspaceEnvVarsSchema,
                wrapResponse: true
            }
        )
    );

    /**
     * Save environment variables for a workspace
     */
    ipcMain.handle(
        'workspace:saveEnv',
        createValidatedIpcHandler(
            'workspace:saveEnv',
            async (event, rootPath: string, vars: Record<string, string>) => {
                validateSender(event);
                try {
                    await resolvedWorkspaceService.saveEnvVars(rootPath, vars);
                    await logDestructiveAction('workspace.save-env', rootPath, true, {
                        variableCount: Object.keys(vars).length,
                    });
                    return { success: true };
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    await logDestructiveAction('workspace.save-env', rootPath, false, {
                        variableCount: Object.keys(vars).length,
                    }, message);
                    throw error;
                }
            },
            {
                argsSchema: z.tuple([WorkspaceRootPathSchema, WorkspaceEnvVarsSchema]),
                responseSchema: z.object({ success: z.boolean() }),
                wrapResponse: true
            }
        )
    );
};

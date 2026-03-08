import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import { AuditLogService } from '@main/services/analysis/audit-log.service';
import { DatabaseService } from '@main/services/data/database.service';
import { LogoService } from '@main/services/external/logo.service';
import { InlineSuggestionService } from '@main/services/llm/inline-suggestion.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { CodeIntelligenceService } from '@main/services/workspace/code-intelligence.service';
import { WorkspaceService } from '@main/services/workspace/workspace.service';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import {
    inlineSuggestionRequestSchema,
    inlineSuggestionResponseSchema,
    inlineSuggestionTelemetrySchema,
} from '@shared/schemas/inline-suggestions.schema';
import {
    DirectoryAnalysisSchema,
    GenerateLogoOptionsSchema,
    WorkspaceAnalysisSchema,
    WorkspaceEnvVarsSchema,
    WorkspaceIdentitySchema,
    WorkspaceIdSchema,
    WorkspaceRootPathSchema,
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


/**
 * Registers all workspace-related IPC handlers including analysis, file watching,
 * logo generation, directory analysis, and environment variable management.
 * @param getWindow - Factory function to retrieve the main BrowserWindow
 * @param deps - The workspace IPC dependency container
 */
export const registerWorkspaceIpc = (
    getWindow: () => Electron.BrowserWindow | null,
    deps: WorkspaceIpcDeps
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
                const results = await resolvedWorkspaceService.analyzeWorkspace(rootPath);

                // Trigger background indexing
                if (workspaceId) {
                    codeIntelligenceService.indexWorkspace(rootPath, workspaceId).catch((err: unknown) => {
                        appLogger.error('WorkspaceIPC', `Failed to auto-index workspace: ${err}`);
                    });
                }
                return results;
            },
            {
                argsSchema: z.tuple([WorkspaceRootPathSchema, WorkspaceIdSchema.optional()]),
                responseSchema: WorkspaceAnalysisSchema,
                wrapResponse: true
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
                const win = getWindow();
                await resolvedWorkspaceService.watchWorkspace(rootPath, (watchEvent: string, filePath: string) => {
                    void (async () => {
                        if (win && !win.isDestroyed()) {
                            win.webContents.send('workspace:file-change', {
                                event: watchEvent,
                                path: filePath,
                                rootPath,
                            });
                        }

                        // Proactive Intelligence Indexing
                        if (watchEvent === 'change' || watchEvent === 'rename') {
                            jobSchedulerService.schedule(
                                `index:${filePath}`,
                                async () => {
                                    try {
                                        const workspaces = await databaseService.getWorkspaces();
                                        const exactWorkspace = workspaces.find(
                                            p => p.path === rootPath
                                        );
                                        if (exactWorkspace) {
                                            await codeIntelligenceService.updateFileIndex(
                                                exactWorkspace.id,
                                                exactWorkspace.path,
                                                filePath
                                            );
                                        }
                                    } catch (e) {
                                        appLogger.error(
                                            'WorkspaceIPC',
                                            `Auto-index failed: ${e instanceof Error ? e.message : String(e)}`
                                        );
                                    }
                                },
                                5000
                            );
                        }
                    })();
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

    /**
     * Stop workspace file watching
     */
    ipcMain.handle(
        'workspace:unwatch',
        createValidatedIpcHandler(
            'workspace:unwatch',
            async (event, rootPath: string) => {
                validateSender(event);
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
                argsSchema: z.tuple([WorkspaceRootPathSchema, WorkspaceRootPathSchema]),
                responseSchema: z.string().max(4096),
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
                const result = await dialog.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif', 'webp', 'svg'] }],
                });

                if (result.canceled || result.filePaths.length === 0) {
                    return null;
                }

                return await logoService.applyLogo(workspacePath, result.filePaths[0] || '');
            },
            {
                argsSchema: z.tuple([WorkspaceRootPathSchema]),
                responseSchema: z.string().max(4096).nullable(),
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

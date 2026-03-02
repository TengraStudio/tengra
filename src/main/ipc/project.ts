import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import { AuditLogService } from '@main/services/analysis/audit-log.service';
import { DatabaseService } from '@main/services/data/database.service';
import { LogoService } from '@main/services/external/logo.service';
import { InlineSuggestionService } from '@main/services/llm/inline-suggestion.service';
import { CodeIntelligenceService } from '@main/services/project/code-intelligence.service';
import { ProjectService } from '@main/services/project/project.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import {
    inlineSuggestionRequestSchema,
    inlineSuggestionResponseSchema,
    inlineSuggestionTelemetrySchema,
} from '@shared/schemas/inline-suggestions.schema';
import {
    DirectoryAnalysisSchema,
    GenerateLogoOptionsSchema,
    ProjectAnalysisSchema,
    ProjectEnvVarsSchema,
    ProjectIdentitySchema,
    ProjectIdSchema,
    ProjectRootPathSchema,
} from '@shared/schemas/service-hardening.schema';
import { dialog, ipcMain } from 'electron';
import { z } from 'zod';

/** Dependencies required by the project IPC handlers. */
export interface ProjectIpcDeps {
    /** Service for project analysis, watching, and environment management. */
    projectService: ProjectService;
    /** Service for logo generation and project identity analysis. */
    logoService: LogoService;
    /** Service for inline code suggestions and completions. */
    inlineSuggestionService: InlineSuggestionService;
    /** Service for code indexing and symbol search. */
    codeIntelligenceService: CodeIntelligenceService;
    /** Service for scheduling background jobs with debouncing. */
    jobSchedulerService: JobSchedulerService;
    /** Service for database access and project lookups. */
    databaseService: DatabaseService;
    /** Optional service for audit logging sensitive/destructive project operations. */
    auditLogService?: AuditLogService;
}


/**
 * Registers all project-related IPC handlers including analysis, file watching,
 * logo generation, directory analysis, and environment variable management.
 * @param getWindow - Factory function to retrieve the main BrowserWindow
 * @param deps - The project IPC dependency container
 */
export const registerProjectIpc = (
    getWindow: () => Electron.BrowserWindow | null,
    deps: ProjectIpcDeps
): void => {
    const {
        projectService,
        logoService,
        inlineSuggestionService,
        codeIntelligenceService,
        jobSchedulerService,
        databaseService,
        auditLogService,
    } = deps;

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
        const context = projectService.getAuditContext(rootPath);
        await auditLogService.logFileSystemOperation(action, success, {
            ...context,
            ...(details ?? {}),
            ...(error ? { error } : {}),
        });
    };

    const validateSender = createMainWindowSenderValidator(getWindow, 'project operation');

    /**
     * Start deep project analysis
     */
    ipcMain.handle(
        'project:analyze',
        createValidatedIpcHandler<z.infer<typeof ProjectAnalysisSchema>, [string, string | undefined]>(
            'project:analyze',
            async (event, rootPath: string, projectId: string | undefined): Promise<z.infer<typeof ProjectAnalysisSchema>> => {
                validateSender(event);
                appLogger.info(
                    'ProjectIPC',
                    `Analyze requested for ${rootPath} (ID: ${projectId})`
                );
                const results = await projectService.analyzeProject(rootPath);

                // Trigger background indexing
                if (projectId) {
                    codeIntelligenceService.indexProject(rootPath, projectId).catch(err => {
                        appLogger.error('ProjectIPC', `Failed to auto-index project: ${err}`);
                    });
                }
                return results;
            },
            {
                argsSchema: z.tuple([ProjectRootPathSchema, ProjectIdSchema]),
                responseSchema: ProjectAnalysisSchema,
                wrapResponse: true
            }
        )
    );

    /**
     * Start project file watching
     */
    ipcMain.handle(
        'project:watch',
        createValidatedIpcHandler(
            'project:watch',
            async (event, rootPath: string) => {
                validateSender(event);
                const win = getWindow();
                await projectService.watchProject(rootPath, (watchEvent, filePath) => {
                    void (async () => {
                        if (win && !win.isDestroyed()) {
                            win.webContents.send('project:file-change', {
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
                                        const projects = await databaseService.getProjects();
                                        const exactProject = projects.find(
                                            p => p.path === rootPath
                                        );
                                        if (exactProject) {
                                            await codeIntelligenceService.updateFileIndex(
                                                exactProject.id,
                                                exactProject.path,
                                                filePath
                                            );
                                        }
                                    } catch (e) {
                                        appLogger.error(
                                            'ProjectIPC',
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
                argsSchema: z.tuple([ProjectRootPathSchema]),
                responseSchema: z.object({ success: z.boolean() }),
                wrapResponse: true
            }
        )
    );

    /**
     * Stop project file watching
     */
    ipcMain.handle(
        'project:unwatch',
        createValidatedIpcHandler(
            'project:unwatch',
            async (event, rootPath: string) => {
                validateSender(event);
                await projectService.stopWatch(rootPath);
                return { success: true };
            },
            {
                argsSchema: z.tuple([ProjectRootPathSchema]),
                responseSchema: z.object({ success: z.boolean() }),
                wrapResponse: true
            }
        )
    );

    /**
     * Generate visual project logo
     */
    ipcMain.handle(
        'project:generateLogo',
        createValidatedIpcHandler(
            'project:generateLogo',
            async (
                event,
                projectPath: string,
                options: { prompt: string; style: string; model: string; count: number }
            ) => {
                validateSender(event);
                return await logoService.generateLogo(
                    projectPath,
                    options.prompt,
                    options.style,
                    options.model,
                    options.count
                );
            },
            {
                argsSchema: z.tuple([ProjectRootPathSchema, GenerateLogoOptionsSchema]),
                responseSchema: z.array(z.string().max(4096)).max(10),
                wrapResponse: true
            }
        )
    );

    /**
     * Run brand identity analysis for a project
     */
    ipcMain.handle(
        'project:analyzeIdentity',
        createValidatedIpcHandler(
            'project:analyzeIdentity',
            async (event, projectPath: string) => {
                validateSender(event);
                return await logoService.analyzeProjectIdentity(projectPath);
            },
            {
                argsSchema: z.tuple([ProjectRootPathSchema]),
                responseSchema: ProjectIdentitySchema,
                wrapResponse: true
            }
        )
    );

    /**
     * Analyze directory structure
     */
    ipcMain.handle(
        'project:analyzeDirectory',
        createValidatedIpcHandler<z.infer<typeof DirectoryAnalysisSchema>, [string]>(
            'project:analyzeDirectory',
            async (event, dirPath: string): Promise<z.infer<typeof DirectoryAnalysisSchema>> => {
                validateSender(event);
                return await projectService.analyzeDirectory(dirPath);
            },
            {
                argsSchema: z.tuple([ProjectRootPathSchema]),
                responseSchema: DirectoryAnalysisSchema,
                wrapResponse: true
            }
        )
    );

    /**
     * Apply a generated logo to the project
     */
    ipcMain.handle(
        'project:applyLogo',
        createValidatedIpcHandler(
            'project:applyLogo',
            async (event, projectPath: string, tempLogoPath: string) => {
                validateSender(event);
                try {
                    const result = await logoService.applyLogo(projectPath, tempLogoPath);
                    await logDestructiveAction('project.apply-logo', projectPath, true, {
                        hasTempLogoPath: Boolean(tempLogoPath),
                    });
                    return result;
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    await logDestructiveAction('project.apply-logo', projectPath, false, undefined, message);
                    throw error;
                }
            },
            {
                argsSchema: z.tuple([ProjectRootPathSchema, ProjectRootPathSchema]),
                responseSchema: z.string().max(4096),
                wrapResponse: true
            }
        )
    );

    /**
     * Get simple code completion (deprecated pattern, prefer inlineSuggestion)
     */
    ipcMain.handle(
        'project:getCompletion',
        createValidatedIpcHandler(
            'project:getCompletion',
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
        'project:getInlineSuggestion',
        createValidatedIpcHandler(
            'project:getInlineSuggestion',
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
        'project:trackInlineSuggestionTelemetry',
        createValidatedIpcHandler(
            'project:trackInlineSuggestionTelemetry',
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
        'project:improveLogoPrompt',
        createValidatedIpcHandler(
            'project:improveLogoPrompt',
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
        'project:uploadLogo',
        createValidatedIpcHandler(
            'project:uploadLogo',
            async (event, projectPath: string) => {
                validateSender(event);
                const result = await dialog.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif', 'webp', 'svg'] }],
                });

                if (result.canceled || result.filePaths.length === 0) {
                    return null;
                }

                return await logoService.applyLogo(projectPath, result.filePaths[0] || '');
            },
            {
                argsSchema: z.tuple([ProjectRootPathSchema]),
                responseSchema: z.string().max(4096).nullable(),
                wrapResponse: true
            }
        )
    );

    /**
     * Retrieve environment variables for a project
     */
    ipcMain.handle(
        'project:getEnv',
        createValidatedIpcHandler(
            'project:getEnv',
            async (event, rootPath: string) => {
                validateSender(event);
                return await projectService.getEnvVars(rootPath);
            },
            {
                argsSchema: z.tuple([ProjectRootPathSchema]),
                responseSchema: ProjectEnvVarsSchema,
                wrapResponse: true
            }
        )
    );

    /**
     * Save environment variables for a project
     */
    ipcMain.handle(
        'project:saveEnv',
        createValidatedIpcHandler(
            'project:saveEnv',
            async (event, rootPath: string, vars: Record<string, string>) => {
                validateSender(event);
                try {
                    await projectService.saveEnvVars(rootPath, vars);
                    await logDestructiveAction('project.save-env', rootPath, true, {
                        variableCount: Object.keys(vars).length,
                    });
                    return { success: true };
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    await logDestructiveAction('project.save-env', rootPath, false, {
                        variableCount: Object.keys(vars).length,
                    }, message);
                    throw error;
                }
            },
            {
                argsSchema: z.tuple([ProjectRootPathSchema, ProjectEnvVarsSchema]),
                responseSchema: z.object({ success: z.boolean() }),
                wrapResponse: true
            }
        )
    );
};

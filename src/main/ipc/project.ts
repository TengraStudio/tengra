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

const PathSchema = z.string().min(1);
const ProjectIdSchema = z.string().optional();
const EnvVarsSchema = z.record(z.string(), z.string());

const GenerateLogoOptionsSchema = z.object({
    prompt: z.string(),
    style: z.string(),
    model: z.string(),
    count: z.number().int().positive()
});

/**
 * Registers all project-related IPC handlers including analysis, file watching,
 * logo generation, directory analysis, and environment variable management.
 * @param getWindow - Factory function to retrieve the main BrowserWindow
 * @param deps - The project IPC dependency container
 */
export const registerProjectIpc = (
    getWindow: () => Electron.BrowserWindow | null,
    deps: ProjectIpcDeps
) => {
    const {
        projectService,
        logoService,
        inlineSuggestionService,
        codeIntelligenceService,
        jobSchedulerService,
        databaseService,
        auditLogService,
    } = deps;

    const logDestructiveAction = async (
        action: string,
        rootPath: string,
        success: boolean,
        details?: Record<string, string | number | boolean>,
        error?: string
    ) => {
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

    ipcMain.handle(
        'project:analyze',
        createValidatedIpcHandler(
            'project:analyze',
            async (_event, rootPath: string, projectId: string | undefined) => {
                appLogger.info(
                    'ProjectIPC',
                    `[ProjectIPC] Analyze requested for ${rootPath} (ID: ${projectId})`
                );
                const results = await projectService.analyzeProject(rootPath);
                appLogger.info(
                    'ProjectIPC',
                    `[ProjectIPC] Analysis returned ${results.files.length} files`
                );
                // Trigger background indexing
                if (projectId) {
                    codeIntelligenceService.indexProject(rootPath, projectId).catch(err => {
                        appLogger.error('ProjectIPC', `Failed to auto-index project: ${err}`);
                    });
                }
                return results;
            },
            {
                argsSchema: z.tuple([PathSchema, ProjectIdSchema]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:watch',
        createValidatedIpcHandler(
            'project:watch',
            async (_event, rootPath: string) => {
                const win = getWindow();
                await projectService.watchProject(rootPath, (event, filePath) => {
                    void (async () => {
                        if (win && !win.isDestroyed()) {
                            win.webContents.send('project:file-change', {
                                event,
                                path: filePath,
                                rootPath,
                            });
                        }

                        // Proactive RAG Indexing
                        if (event === 'change' || event === 'rename') {
                            jobSchedulerService.schedule(
                                `index:${filePath}`,
                                async () => {
                                    try {
                                        const projects = await databaseService.getProjects();
                                        // Ideally matches rootPath.
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
                                            `[ProjectIPC] Auto-index failed: ${e}`
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
                argsSchema: z.tuple([PathSchema]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:unwatch',
        createValidatedIpcHandler(
            'project:unwatch',
            async (_event, rootPath: string) => {
                await projectService.stopWatch(rootPath);
                return { success: true };
            },
            {
                argsSchema: z.tuple([PathSchema]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:generateLogo',
        createValidatedIpcHandler(
            'project:generateLogo',
            async (
                _event,
                projectPath: string,
                options: { prompt: string; style: string; model: string; count: number }
            ) => {
                return await logoService.generateLogo(
                    projectPath,
                    options.prompt,
                    options.style,
                    options.model,
                    options.count
                );
            },
            {
                argsSchema: z.tuple([PathSchema, GenerateLogoOptionsSchema]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:analyzeIdentity',
        createValidatedIpcHandler(
            'project:analyzeIdentity',
            async (_event, projectPath: string) => {
                return await logoService.analyzeProjectIdentity(projectPath);
            },
            {
                argsSchema: z.tuple([PathSchema]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:analyzeDirectory',
        createValidatedIpcHandler(
            'project:analyzeDirectory',
            async (_event, dirPath: string) => {
                return await projectService.analyzeDirectory(dirPath);
            },
            {
                argsSchema: z.tuple([PathSchema]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:applyLogo',
        createValidatedIpcHandler(
            'project:applyLogo',
            async (_event, projectPath: string, tempLogoPath: string) => {
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
                argsSchema: z.tuple([PathSchema, PathSchema]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:getCompletion',
        createValidatedIpcHandler(
            'project:getCompletion',
            async (_event, text: string) => {
                return await inlineSuggestionService.getCompletion(text);
            },
            {
                argsSchema: z.tuple([z.string()]),
                responseSchema: z.string(),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:getInlineSuggestion',
        createValidatedIpcHandler(
            'project:getInlineSuggestion',
            async (_event, request: z.infer<typeof inlineSuggestionRequestSchema>) => {
                return await inlineSuggestionService.getInlineSuggestion(request);
            },
            {
                argsSchema: z.tuple([inlineSuggestionRequestSchema]),
                responseSchema: inlineSuggestionResponseSchema,
                wrapResponse: true,
            }
        )
    );

    ipcMain.handle(
        'project:trackInlineSuggestionTelemetry',
        createValidatedIpcHandler(
            'project:trackInlineSuggestionTelemetry',
            async (_event, eventData: z.infer<typeof inlineSuggestionTelemetrySchema>) => {
                return await inlineSuggestionService.trackTelemetry(eventData);
            },
            {
                argsSchema: z.tuple([inlineSuggestionTelemetrySchema]),
                responseSchema: z.object({ success: z.boolean() }),
                wrapResponse: true,
            }
        )
    );

    ipcMain.handle(
        'project:improveLogoPrompt',
        createValidatedIpcHandler(
            'project:improveLogoPrompt',
            async (_event, prompt: string) => {
                return await logoService.improveLogoPrompt(prompt);
            },
            {
                argsSchema: z.tuple([z.string()]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:uploadLogo',
        createValidatedIpcHandler(
            'project:uploadLogo',
            async (_event, projectPath: string) => {
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
                argsSchema: z.tuple([PathSchema]),
                wrapResponse: true
            }
        )
    );

    // Environment Manager
    ipcMain.handle(
        'project:getEnv',
        createValidatedIpcHandler(
            'project:getEnv',
            async (_event, rootPath: string) => {
                return await projectService.getEnvVars(rootPath);
            },
            {
                argsSchema: z.tuple([PathSchema]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:saveEnv',
        createValidatedIpcHandler(
            'project:saveEnv',
            async (_event, rootPath: string, vars: Record<string, string>) => {
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
                argsSchema: z.tuple([PathSchema, EnvVarsSchema]),
                wrapResponse: true
            }
        )
    );
};

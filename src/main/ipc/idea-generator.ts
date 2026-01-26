import { DeepResearchService } from '@main/services/external/deep-research.service';
import { IdeaGeneratorService } from '@main/services/llm/idea-generator.service';
import { IdeaScoringService } from '@main/services/llm/idea-scoring.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { createIpcHandler, createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import {
    IdeaCategory,
    IdeaProgress,
    IdeaSessionConfig,
    ResearchProgress
} from '@shared/types/ideas';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';

/**
 * Register IPC handlers for the Idea Generator feature
 */
export function registerIdeaGeneratorIpc(
    ideaGeneratorService: IdeaGeneratorService,
    eventBus: EventBusService,
    deepResearchService?: DeepResearchService,
    ideaScoringService?: IdeaScoringService
): void {
    // Set up event forwarding to renderer
    setupEventForwarding(eventBus);

    // Session management handlers
    registerSessionHandlers(ideaGeneratorService);

    // Research and generation handlers
    registerGenerationHandlers(ideaGeneratorService);

    // Idea management handlers
    registerIdeaHandlers(ideaGeneratorService);

    // Interactive research handlers
    registerResearchQueryHandlers(ideaGeneratorService);

    // Approval workflow handlers
    registerApprovalHandlers(ideaGeneratorService);

    // Logo generation handlers
    registerLogoHandlers(ideaGeneratorService);

    // Advanced research and scoring handlers
    if (deepResearchService) {
        registerDeepResearchHandlers(deepResearchService);
    }
    if (ideaScoringService) {
        registerScoringHandlers(ideaScoringService, ideaGeneratorService);
    }

    // Data management handlers (delete, archive)
    registerDataManagementHandlers(ideaGeneratorService);
}

/**
 * Set up event forwarding from EventBus to renderer process
 */
function setupEventForwarding(eventBus: EventBusService): void {
    // Forward research progress events to renderer
    eventBus.on('ideas:research-progress', (progress: ResearchProgress) => {
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
            win.webContents.send('ideas:research-progress', progress);
        }
    });

    // Forward idea generation progress events to renderer
    eventBus.on('ideas:idea-progress', (progress: IdeaProgress) => {
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
            win.webContents.send('ideas:idea-progress', progress);
        }
    });
}

/**
 * Register session management handlers
 */
function registerSessionHandlers(ideaGeneratorService: IdeaGeneratorService): void {
    // Create a new session
    ipcMain.handle('ideas:createSession',
        createIpcHandler('ideas:createSession',
            async (_event: IpcMainInvokeEvent, config: IdeaSessionConfig) => {
                return await ideaGeneratorService.createSession(config);
            }
        )
    );

    // Get a session by ID
    ipcMain.handle('ideas:getSession',
        createSafeIpcHandler('ideas:getSession',
            async (_event: IpcMainInvokeEvent, id: string) => {
                return await ideaGeneratorService.getSession(id);
            }, null
        )
    );

    // Get all sessions
    ipcMain.handle('ideas:getSessions',
        createSafeIpcHandler('ideas:getSessions',
            async () => {
                return await ideaGeneratorService.getSessions();
            }, []
        )
    );

    // Cancel a session
    ipcMain.handle('ideas:cancelSession',
        createIpcHandler('ideas:cancelSession',
            async (_event: IpcMainInvokeEvent, id: string) => {
                await ideaGeneratorService.cancelSession(id);
                return { success: true };
            }
        )
    );
}

/**
 * Register research and generation handlers
 */
function registerGenerationHandlers(ideaGeneratorService: IdeaGeneratorService): void {
    // Generate market preview
    ipcMain.handle('ideas:generateMarketPreview',
        createIpcHandler('ideas:generateMarketPreview',
            async (_event: IpcMainInvokeEvent, categories: string[]) => {
                const preview = await ideaGeneratorService.generateMarketPreview(categories as IdeaCategory[]);
                return { success: true, data: preview };
            }
        )
    );

    // Start research pipeline
    ipcMain.handle('ideas:startResearch',
        createIpcHandler('ideas:startResearch',
            async (_event: IpcMainInvokeEvent, sessionId: string) => {
                const researchData = await ideaGeneratorService.runResearchPipeline(sessionId);
                return { success: true, data: researchData };
            }
        )
    );

    // Start idea generation
    ipcMain.handle('ideas:startGeneration',
        createIpcHandler('ideas:startGeneration',
            async (_event: IpcMainInvokeEvent, sessionId: string) => {
                await ideaGeneratorService.generateIdeas(sessionId);
                return { success: true };
            }
        )
    );

    // Enrich a specific idea
    ipcMain.handle('ideas:enrichIdea',
        createIpcHandler('ideas:enrichIdea',
            async (_event: IpcMainInvokeEvent, ideaId: string) => {
                const enrichedIdea = await ideaGeneratorService.enrichIdea(ideaId);
                return { success: true, data: enrichedIdea };
            }
        )
    );
}

/**
 * Register idea management handlers
 */
function registerIdeaHandlers(ideaGeneratorService: IdeaGeneratorService): void {
    // Get an idea by ID
    ipcMain.handle('ideas:getIdea',
        createSafeIpcHandler('ideas:getIdea',
            async (_event: IpcMainInvokeEvent, id: string) => {
                return await ideaGeneratorService.getIdea(id);
            }, null
        )
    );

    // Get ideas (optionally filtered by session)
    ipcMain.handle('ideas:getIdeas',
        createSafeIpcHandler('ideas:getIdeas',
            async (_event: IpcMainInvokeEvent, sessionId?: string) => {
                return await ideaGeneratorService.getIdeas(sessionId);
            }, []
        )
    );

    // Regenerate a single idea
    ipcMain.handle('ideas:regenerateIdea',
        createIpcHandler('ideas:regenerateIdea',
            async (_event: IpcMainInvokeEvent, ideaId: string) => {
                const newIdea = await ideaGeneratorService.regenerateIdea(ideaId);
                return { success: true, idea: newIdea };
            }
        )
    );
}

/**
 * Register approval workflow handlers
 */
function registerApprovalHandlers(ideaGeneratorService: IdeaGeneratorService): void {
    // Approve an idea and create a project
    ipcMain.handle('ideas:approveIdea',
        createIpcHandler('ideas:approveIdea',
            async (_event: IpcMainInvokeEvent, ideaId: string, projectPath: string, selectedName?: string) => {
                const project = await ideaGeneratorService.approveIdea(ideaId, projectPath, selectedName);
                return { success: true, project };
            }
        )
    );

    // Reject an idea
    ipcMain.handle('ideas:rejectIdea',
        createIpcHandler('ideas:rejectIdea',
            async (_event: IpcMainInvokeEvent, ideaId: string) => {
                await ideaGeneratorService.rejectIdea(ideaId);
                return { success: true };
            }
        )
    );
}

/**
 * Register logo generation handlers
 */
function registerLogoHandlers(ideaGeneratorService: IdeaGeneratorService): void {
    // Check if logo generation is available
    ipcMain.handle('ideas:canGenerateLogo',
        createSafeIpcHandler('ideas:canGenerateLogo',
            async () => {
                return await ideaGeneratorService.canGenerateLogo();
            }, false
        )
    );

    // Generate a logo for an idea
    ipcMain.handle('ideas:generateLogo',
        createIpcHandler('ideas:generateLogo',
            async (_event: IpcMainInvokeEvent, ideaId: string, prompt: string) => {
                const logoPath = await ideaGeneratorService.generateLogo(ideaId, prompt);
                return { success: true, logoPath };
            }
        )
    );
}

/**
 * Register deep research handlers
 */
function registerDeepResearchHandlers(deepResearchService: DeepResearchService): void {
    // Perform deep research on a topic
    ipcMain.handle('ideas:deepResearch',
        createIpcHandler('ideas:deepResearch',
            async (_event: IpcMainInvokeEvent, topic: string, category: string) => {
                const report = await deepResearchService.performDeepResearch(
                    topic,
                    category as import('@shared/types/ideas').IdeaCategory,
                    (stage, progress) => {
                        // Forward progress to renderer
                        const windows = BrowserWindow.getAllWindows();
                        for (const win of windows) {
                            win.webContents.send('ideas:deep-research-progress', { stage, progress });
                        }
                    }
                );
                return { success: true, report };
            }
        )
    );

    // Validate an idea with deep research
    ipcMain.handle('ideas:validateIdea',
        createIpcHandler('ideas:validateIdea',
            async (_event: IpcMainInvokeEvent, title: string, description: string, category: string) => {
                const validation = await deepResearchService.validateIdea(
                    title,
                    description,
                    category as import('@shared/types/ideas').IdeaCategory
                );
                return { success: true, validation };
            }
        )
    );

    // Clear research cache
    ipcMain.handle('ideas:clearResearchCache',
        createSafeIpcHandler('ideas:clearResearchCache',
            async () => {
                deepResearchService.clearCache();
                return { success: true };
            },
            { success: false }
        )
    );
}

/**
 * Register idea scoring handlers
 */
function registerScoringHandlers(
    ideaScoringService: IdeaScoringService,
    ideaGeneratorService: IdeaGeneratorService
): void {
    // Score a single idea
    ipcMain.handle('ideas:scoreIdea',
        createIpcHandler('ideas:scoreIdea',
            async (_event: IpcMainInvokeEvent, ideaId: string) => {
                const idea = await ideaGeneratorService.getIdea(ideaId);
                if (!idea) {
                    throw new Error(`Idea not found: ${ideaId}`);
                }
                const score = await ideaScoringService.scoreIdea(idea);
                return { success: true, score };
            }
        )
    );

    // Rank multiple ideas
    ipcMain.handle('ideas:rankIdeas',
        createIpcHandler('ideas:rankIdeas',
            async (_event: IpcMainInvokeEvent, ideaIds: string[]) => {
                const ideas = await Promise.all(
                    ideaIds.map(id => ideaGeneratorService.getIdea(id))
                );
                const validIdeas = ideas.filter((idea): idea is NonNullable<typeof idea> => idea !== null);
                const ranked = await ideaScoringService.rankIdeas(validIdeas);
                return { success: true, ranked };
            }
        )
    );

    // Compare two ideas
    ipcMain.handle('ideas:compareIdeas',
        createIpcHandler('ideas:compareIdeas',
            async (_event: IpcMainInvokeEvent, ideaId1: string, ideaId2: string) => {
                const [idea1, idea2] = await Promise.all([
                    ideaGeneratorService.getIdea(ideaId1),
                    ideaGeneratorService.getIdea(ideaId2)
                ]);
                if (!idea1 || !idea2) {
                    throw new Error('One or both ideas not found');
                }
                const comparison = await ideaScoringService.compareIdeas(idea1, idea2);
                return { success: true, comparison };
            }
        )
    );

    // Quick score without full analysis
    ipcMain.handle('ideas:quickScore',
        createSafeIpcHandler('ideas:quickScore',
            async (_event: IpcMainInvokeEvent, title: string, description: string, category: string) => {
                const score = await ideaScoringService.quickScore(
                    title,
                    description,
                    category as import('@shared/types/ideas').IdeaCategory
                );
                return { success: true, score };
            },
            { success: false, score: 50 }
        )
    );
}

/**
 * Register data management handlers (delete, archive)
 */
function registerDataManagementHandlers(ideaGeneratorService: IdeaGeneratorService): void {
    // Delete a single idea
    ipcMain.handle('ideas:deleteIdea',
        createIpcHandler('ideas:deleteIdea',
            async (_event: IpcMainInvokeEvent, ideaId: string) => {
                await ideaGeneratorService.deleteIdea(ideaId);
                return { success: true };
            }
        )
    );

    // Delete an entire session and its ideas
    ipcMain.handle('ideas:deleteSession',
        createIpcHandler('ideas:deleteSession',
            async (_event: IpcMainInvokeEvent, sessionId: string) => {
                await ideaGeneratorService.deleteSession(sessionId);
                return { success: true };
            }
        )
    );

    // Archive an idea (soft delete)
    ipcMain.handle('ideas:archiveIdea',
        createIpcHandler('ideas:archiveIdea',
            async (_event: IpcMainInvokeEvent, ideaId: string) => {
                await ideaGeneratorService.archiveIdea(ideaId);
                return { success: true };
            }
        )
    );

    // Restore an archived idea
    ipcMain.handle('ideas:restoreIdea',
        createIpcHandler('ideas:restoreIdea',
            async (_event: IpcMainInvokeEvent, ideaId: string) => {
                await ideaGeneratorService.restoreIdea(ideaId);
                return { success: true };
            }
        )
    );

    // Get archived ideas
    ipcMain.handle('ideas:getArchivedIdeas',
        createSafeIpcHandler('ideas:getArchivedIdeas',
            async (_event: IpcMainInvokeEvent, sessionId?: string) => {
                return await ideaGeneratorService.getArchivedIdeas(sessionId);
            },
            []
        )
    );
}

/**
 * Register interactive research query handlers
 */
function registerResearchQueryHandlers(ideaGeneratorService: IdeaGeneratorService): void {
    ipcMain.handle('ideas:queryResearch',
        createIpcHandler('ideas:queryResearch',
            async (_event: IpcMainInvokeEvent, ideaId: string, question: string) => {
                const answer = await ideaGeneratorService.queryIdeaResearch(ideaId, question);
                return { success: true, answer };
            }
        )
    );
}

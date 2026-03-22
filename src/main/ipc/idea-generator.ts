import { appLogger } from '@main/logging/logger';
import { DeepResearchService } from '@main/services/external/deep-research.service';
import { IdeaGeneratorService } from '@main/services/llm/idea-generator.service';
import { IdeaScoringService } from '@main/services/llm/idea-scoring.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { createIpcHandler, createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { withRateLimit } from '@main/utils/rate-limiter.util';
import {
    IdeaCategory,
    IdeaProgress,
    IdeaSessionConfig,
    ResearchProgress,
} from '@shared/types/ideas';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';

/** Maximum ID length */
const MAX_ID_LENGTH = 128;
/** Maximum topic length */
const MAX_TOPIC_LENGTH = 1024;
/** Maximum description length */
const MAX_DESCRIPTION_LENGTH = 5000;
/** Maximum question length */
const MAX_QUESTION_LENGTH = 2048;
/** Maximum path length */
const MAX_PATH_LENGTH = 4096;
/** Maximum name length */
const MAX_NAME_LENGTH = 256;

/**
 * Validates an ID string
 */
function validateId(value: RuntimeValue): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_ID_LENGTH) {
        return null;
    }
    return trimmed;
}

/**
 * Validates a topic string
 */
function validateTopic(value: RuntimeValue): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_TOPIC_LENGTH) {
        return null;
    }
    return trimmed;
}

/**
 * Validates a description string
 */
function validateDescription(value: RuntimeValue): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_DESCRIPTION_LENGTH) {
        return null;
    }
    return trimmed;
}

/**
 * Validates a question string
 */
function validateQuestion(value: RuntimeValue): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_QUESTION_LENGTH) {
        return null;
    }
    return trimmed;
}

/**
 * Validates a path string
 */
function validatePath(value: RuntimeValue): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_PATH_LENGTH) {
        return null;
    }
    return trimmed;
}

/**
 * Validates an optional name string
 */
function validateName(value: RuntimeValue): string | undefined {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_NAME_LENGTH) {
        return undefined;
    }
    return trimmed;
}

/**
 * Validates a category string
 */
function validateCategory(value: RuntimeValue): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    return trimmed;
}

/**
 * Validates an array of IDs
 */
function validateIdArray(value: RuntimeValue): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .filter((item): item is string => typeof item === 'string')
        .map(id => id.trim())
        .filter(id => id.length > 0 && id.length <= MAX_ID_LENGTH);
}

/**
 * Register IPC handlers for the Idea Generator feature
 */
export function registerIdeaGeneratorIpc(
    ideaGeneratorService: IdeaGeneratorService,
    eventBus: EventBusService,
    deepResearchService?: DeepResearchService,
    ideaScoringService?: IdeaScoringService
): void {
    appLogger.debug('IdeaGeneratorIPC', 'Registering Idea Generator IPC handlers');
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
            if (!win.isDestroyed()) {
                win.webContents.send('ideas:research-progress', progress);
            }
        }
    });

    // Forward idea generation progress events to renderer
    eventBus.on('ideas:idea-progress', (progress: IdeaProgress) => {
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
            if (!win.isDestroyed()) {
                win.webContents.send('ideas:idea-progress', progress);
            }
        }
    });
}

/**
 * Register session management handlers
 */
function registerSessionHandlers(ideaGeneratorService: IdeaGeneratorService): void {
    // Create a new session
    ipcMain.handle(
        'ideas:createSession',
        createIpcHandler(
            'ideas:createSession',
            async (_event: IpcMainInvokeEvent, config: IdeaSessionConfig) => {
                return await ideaGeneratorService.createSession(config);
            }
        )
    );

    // Get a session by ID
    ipcMain.handle(
        'ideas:getSession',
        createSafeIpcHandler(
            'ideas:getSession',
            async (_event: IpcMainInvokeEvent, idRaw: RuntimeValue) => {
                const id = validateId(idRaw);
                if (!id) {
                    throw new Error('Invalid session ID');
                }
                return await ideaGeneratorService.getSession(id);
            },
            null
        )
    );

    // Get all sessions
    ipcMain.handle(
        'ideas:getSessions',
        createSafeIpcHandler(
            'ideas:getSessions',
            async () => {
                return await ideaGeneratorService.getSessions();
            },
            []
        )
    );

    // Cancel a session
    ipcMain.handle(
        'ideas:cancelSession',
        createIpcHandler('ideas:cancelSession', async (_event: IpcMainInvokeEvent, idRaw: RuntimeValue) => {
            const id = validateId(idRaw);
            if (!id) {
                throw new Error('Invalid session ID');
            }
            await ideaGeneratorService.cancelSession(id);
            return { success: true };
        })
    );
}

/**
 * Register research and generation handlers
 */
function registerGenerationHandlers(ideaGeneratorService: IdeaGeneratorService): void {
    // Generate market preview
    ipcMain.handle(
        'ideas:generateMarketPreview',
        createIpcHandler(
            'ideas:generateMarketPreview',
            async (_event: IpcMainInvokeEvent, categories: string[]) => {
                const preview = await ideaGeneratorService.generateMarketPreview(
                    categories as IdeaCategory[]
                );
                return { success: true, data: preview };
            }
        )
    );

    // Start research pipeline
    ipcMain.handle(
        'ideas:startResearch',
        createIpcHandler(
            'ideas:startResearch',
            async (_event: IpcMainInvokeEvent, sessionIdRaw: RuntimeValue) => {
                const sessionId = validateId(sessionIdRaw);
                if (!sessionId) {
                    throw new Error('Invalid session ID');
                }
                const researchData = await withRateLimit('ideas', async () =>
                    ideaGeneratorService.runResearchPipeline(sessionId)
                );
                return { success: true, data: researchData };
            }
        )
    );

    // Start idea generation
    ipcMain.handle(
        'ideas:startGeneration',
        createIpcHandler(
            'ideas:startGeneration',
            async (_event: IpcMainInvokeEvent, sessionIdRaw: RuntimeValue) => {
                const sessionId = validateId(sessionIdRaw);
                if (!sessionId) {
                    throw new Error('Invalid session ID');
                }
                await withRateLimit('ideas', async () =>
                    ideaGeneratorService.generateIdeas(sessionId)
                );
                return { success: true };
            }
        )
    );

    // Enrich a specific idea
    ipcMain.handle(
        'ideas:enrichIdea',
        createIpcHandler('ideas:enrichIdea', async (_event: IpcMainInvokeEvent, ideaIdRaw: RuntimeValue) => {
            const ideaId = validateId(ideaIdRaw);
            if (!ideaId) {
                throw new Error('Invalid idea ID');
            }
            const enrichedIdea = await withRateLimit('ideas', async () =>
                ideaGeneratorService.enrichIdea(ideaId)
            );
            return { success: true, data: enrichedIdea };
        })
    );
}

/**
 * Register idea management handlers
 */
function registerIdeaHandlers(ideaGeneratorService: IdeaGeneratorService): void {
    // Get an idea by ID
    ipcMain.handle(
        'ideas:getIdea',
        createSafeIpcHandler(
            'ideas:getIdea',
            async (_event: IpcMainInvokeEvent, idRaw: RuntimeValue) => {
                const id = validateId(idRaw);
                if (!id) {
                    throw new Error('Invalid idea ID');
                }
                return await ideaGeneratorService.getIdea(id);
            },
            null
        )
    );

    // Get ideas (optionally filtered by session)
    ipcMain.handle(
        'ideas:getIdeas',
        createSafeIpcHandler(
            'ideas:getIdeas',
            async (_event: IpcMainInvokeEvent, sessionIdRaw?: RuntimeValue) => {
                const sessionId = sessionIdRaw !== undefined ? validateId(sessionIdRaw) : undefined;
                return await ideaGeneratorService.getIdeas(sessionId ?? undefined);
            },
            []
        )
    );

    // Regenerate a single idea
    ipcMain.handle(
        'ideas:regenerateIdea',
        createIpcHandler(
            'ideas:regenerateIdea',
            async (_event: IpcMainInvokeEvent, ideaIdRaw: RuntimeValue) => {
                const ideaId = validateId(ideaIdRaw);
                if (!ideaId) {
                    throw new Error('Invalid idea ID');
                }
                const newIdea = await withRateLimit('ideas', async () =>
                    ideaGeneratorService.regenerateIdea(ideaId)
                );
                return { success: true, idea: newIdea };
            }
        )
    );
}

/**
 * Register approval workflow handlers
 */
function registerApprovalHandlers(ideaGeneratorService: IdeaGeneratorService): void {
    // Approve an idea and create a workspace
    ipcMain.handle(
        'ideas:approveIdea',
        createIpcHandler(
            'ideas:approveIdea',
            async (
                _event: IpcMainInvokeEvent,
                ideaIdRaw: RuntimeValue,
                workspacePathRaw: RuntimeValue,
                selectedNameRaw?: RuntimeValue
            ) => {
                const ideaId = validateId(ideaIdRaw);
                const workspacePath = validatePath(workspacePathRaw);
                if (!ideaId || !workspacePath) {
                    throw new Error('Invalid idea ID or workspace path');
                }
                const selectedName = validateName(selectedNameRaw);
                const workspace = await ideaGeneratorService.approveIdea(
                    ideaId,
                    workspacePath,
                    selectedName
                );
                return { success: true, workspace };
            }
        )
    );

    // Reject an idea
    ipcMain.handle(
        'ideas:rejectIdea',
        createIpcHandler('ideas:rejectIdea', async (_event: IpcMainInvokeEvent, ideaIdRaw: RuntimeValue) => {
            const ideaId = validateId(ideaIdRaw);
            if (!ideaId) {
                throw new Error('Invalid idea ID');
            }
            await ideaGeneratorService.rejectIdea(ideaId);
            return { success: true };
        })
    );
}

/**
 * Register logo generation handlers
 */
function registerLogoHandlers(ideaGeneratorService: IdeaGeneratorService): void {
    // Check if logo generation is available
    ipcMain.handle(
        'ideas:canGenerateLogo',
        createSafeIpcHandler(
            'ideas:canGenerateLogo',
            async () => {
                return await ideaGeneratorService.canGenerateLogo();
            },
            false
        )
    );

    // Generate a logo for an idea
    ipcMain.handle(
        'ideas:generateLogo',
        createIpcHandler(
            'ideas:generateLogo',
            async (
                _event: IpcMainInvokeEvent,
                ideaIdRaw: RuntimeValue,
                options: { prompt: string; style: string; model: string; count: number }
            ) => {
                const ideaId = validateId(ideaIdRaw);
                if (!ideaId) {
                    throw new Error('Invalid idea ID');
                }
                const logoPaths = await withRateLimit('ideas', async () =>
                    ideaGeneratorService.generateLogo(ideaId, options)
                );
                return { success: true, logoPaths };
            }
        )
    );
}

/**
 * Register deep research handlers
 */
function registerDeepResearchHandlers(deepResearchService: DeepResearchService): void {
    // Perform deep research on a topic
    ipcMain.handle(
        'ideas:deepResearch',
        createIpcHandler(
            'ideas:deepResearch',
            async (_event: IpcMainInvokeEvent, topicRaw: RuntimeValue, categoryRaw: RuntimeValue) => {
                const topic = validateTopic(topicRaw);
                const category = validateCategory(categoryRaw);
                if (!topic || !category) {
                    throw new Error('Invalid topic or category');
                }
                const report = await withRateLimit('ideas', async () =>
                    deepResearchService.performDeepResearch(
                        topic,
                        category as import('@shared/types/ideas').IdeaCategory,
                        (stage, progress) => {
                            // Forward progress to renderer
                            const windows = BrowserWindow.getAllWindows();
                            for (const win of windows) {
                                if (!win.isDestroyed()) {
                                    win.webContents.send('ideas:deep-research-progress', {
                                        stage,
                                        progress,
                                    });
                                }
                            }
                        }
                    )
                );
                return { success: true, report };
            }
        )
    );

    // Validate an idea with deep research
    ipcMain.handle(
        'ideas:validateIdea',
        createIpcHandler(
            'ideas:validateIdea',
            async (
                _event: IpcMainInvokeEvent,
                titleRaw: RuntimeValue,
                descriptionRaw: RuntimeValue,
                categoryRaw: RuntimeValue
            ) => {
                const title = validateTopic(titleRaw);
                const description = validateDescription(descriptionRaw);
                const category = validateCategory(categoryRaw);
                if (!title || !description || !category) {
                    throw new Error('Invalid title, description, or category');
                }
                const validation = await withRateLimit('ideas', async () =>
                    deepResearchService.validateIdea(
                        title,
                        description,
                        category as import('@shared/types/ideas').IdeaCategory
                    )
                );
                return { success: true, validation };
            }
        )
    );

    // Clear research cache
    ipcMain.handle(
        'ideas:clearResearchCache',
        createSafeIpcHandler(
            'ideas:clearResearchCache',
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
    ipcMain.handle(
        'ideas:scoreIdea',
        createIpcHandler('ideas:scoreIdea', async (_event: IpcMainInvokeEvent, ideaIdRaw: RuntimeValue) => {
            const ideaId = validateId(ideaIdRaw);
            if (!ideaId) {
                throw new Error('Invalid idea ID');
            }
            const idea = await ideaGeneratorService.getIdea(ideaId);
            if (!idea) {
                throw new Error(`Idea not found: ${ideaId}`);
            }
            const score = await withRateLimit('ideas', async () =>
                ideaScoringService.scoreIdea(idea)
            );
            return { success: true, score };
        })
    );

    // Rank multiple ideas
    ipcMain.handle(
        'ideas:rankIdeas',
        createIpcHandler(
            'ideas:rankIdeas',
            async (_event: IpcMainInvokeEvent, ideaIdsRaw: RuntimeValue) => {
                const ideaIds = validateIdArray(ideaIdsRaw);
                if (ideaIds.length === 0) {
                    throw new Error('No valid idea IDs provided');
                }
                const ideas = await Promise.all(
                    ideaIds.map(id => ideaGeneratorService.getIdea(id))
                );
                const validIdeas = ideas.filter(
                    (idea): idea is NonNullable<typeof idea> => idea !== null
                );
                const ranked = await withRateLimit('ideas', async () =>
                    ideaScoringService.rankIdeas(validIdeas)
                );
                return { success: true, ranked };
            }
        )
    );

    // Compare two ideas
    ipcMain.handle(
        'ideas:compareIdeas',
        createIpcHandler(
            'ideas:compareIdeas',
            async (_event: IpcMainInvokeEvent, ideaId1Raw: RuntimeValue, ideaId2Raw: RuntimeValue) => {
                const ideaId1 = validateId(ideaId1Raw);
                const ideaId2 = validateId(ideaId2Raw);
                if (!ideaId1 || !ideaId2) {
                    throw new Error('Invalid idea IDs');
                }
                const [idea1, idea2] = await Promise.all([
                    ideaGeneratorService.getIdea(ideaId1),
                    ideaGeneratorService.getIdea(ideaId2),
                ]);
                if (!idea1 || !idea2) {
                    throw new Error('One or both ideas not found');
                }
                const comparison = await withRateLimit('ideas', async () =>
                    ideaScoringService.compareIdeas(idea1, idea2)
                );
                return { success: true, comparison };
            }
        )
    );

    // Quick score without full analysis
    ipcMain.handle(
        'ideas:quickScore',
        createSafeIpcHandler(
            'ideas:quickScore',
            async (
                _event: IpcMainInvokeEvent,
                titleRaw: RuntimeValue,
                descriptionRaw: RuntimeValue,
                categoryRaw: RuntimeValue
            ) => {
                const title = validateTopic(titleRaw);
                const description = validateDescription(descriptionRaw);
                const category = validateCategory(categoryRaw);
                if (!title || !description || !category) {
                    throw new Error('Invalid title, description, or category');
                }
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
    ipcMain.handle(
        'ideas:deleteIdea',
        createIpcHandler('ideas:deleteIdea', async (_event: IpcMainInvokeEvent, ideaIdRaw: RuntimeValue) => {
            const ideaId = validateId(ideaIdRaw);
            if (!ideaId) {
                throw new Error('Invalid idea ID');
            }
            await ideaGeneratorService.deleteIdea(ideaId);
            return { success: true };
        })
    );

    // Delete an entire session and its ideas
    ipcMain.handle(
        'ideas:deleteSession',
        createIpcHandler(
            'ideas:deleteSession',
            async (_event: IpcMainInvokeEvent, sessionIdRaw: RuntimeValue) => {
                const sessionId = validateId(sessionIdRaw);
                if (!sessionId) {
                    throw new Error('Invalid session ID');
                }
                await ideaGeneratorService.deleteSession(sessionId);
                return { success: true };
            }
        )
    );

    // Archive an idea (soft delete)
    ipcMain.handle(
        'ideas:archiveIdea',
        createIpcHandler(
            'ideas:archiveIdea',
            async (_event: IpcMainInvokeEvent, ideaIdRaw: RuntimeValue) => {
                const ideaId = validateId(ideaIdRaw);
                if (!ideaId) {
                    throw new Error('Invalid idea ID');
                }
                await ideaGeneratorService.archiveIdea(ideaId);
                return { success: true };
            }
        )
    );

    // Restore an archived idea
    ipcMain.handle(
        'ideas:restoreIdea',
        createIpcHandler(
            'ideas:restoreIdea',
            async (_event: IpcMainInvokeEvent, ideaIdRaw: RuntimeValue) => {
                const ideaId = validateId(ideaIdRaw);
                if (!ideaId) {
                    throw new Error('Invalid idea ID');
                }
                await ideaGeneratorService.restoreIdea(ideaId);
                return { success: true };
            }
        )
    );

    // Get archived ideas
    ipcMain.handle(
        'ideas:getArchivedIdeas',
        createSafeIpcHandler(
            'ideas:getArchivedIdeas',
            async (_event: IpcMainInvokeEvent, sessionIdRaw?: RuntimeValue) => {
                const sessionId = sessionIdRaw !== undefined ? validateId(sessionIdRaw) : undefined;
                return await ideaGeneratorService.getArchivedIdeas(sessionId ?? undefined);
            },
            []
        )
    );
}

/**
 * Register interactive research query handlers
 */
function registerResearchQueryHandlers(ideaGeneratorService: IdeaGeneratorService): void {
    ipcMain.handle(
        'ideas:queryResearch',
        createIpcHandler(
            'ideas:queryResearch',
            async (_event: IpcMainInvokeEvent, ideaIdRaw: RuntimeValue, questionRaw: RuntimeValue) => {
                const ideaId = validateId(ideaIdRaw);
                const question = validateQuestion(questionRaw);
                if (!ideaId || !question) {
                    throw new Error('Invalid idea ID or question');
                }
                const answer = await withRateLimit('ideas', async () =>
                    ideaGeneratorService.queryIdeaResearch(ideaId, question)
                );
                return { success: true, answer };
            }
        )
    );
}

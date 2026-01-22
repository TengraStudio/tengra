import { IdeaGeneratorService } from '@main/services/llm/idea-generator.service'
import { EventBusService } from '@main/services/system/event-bus.service'
import { createIpcHandler, createSafeIpcHandler } from '@main/utils/ipc-wrapper.util'
import {
    IdeaProgress,
    IdeaSessionConfig,
    ResearchProgress
} from '@shared/types/ideas'
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron'

/**
 * Register IPC handlers for the Idea Generator feature
 */
export function registerIdeaGeneratorIpc(
    ideaGeneratorService: IdeaGeneratorService,
    eventBus: EventBusService
): void {
    // Set up event forwarding to renderer
    setupEventForwarding(eventBus)

    // Session management handlers
    registerSessionHandlers(ideaGeneratorService)

    // Research and generation handlers
    registerGenerationHandlers(ideaGeneratorService)

    // Idea management handlers
    registerIdeaHandlers(ideaGeneratorService)

    // Interactive research handlers
    registerResearchQueryHandlers(ideaGeneratorService)

    // Approval workflow handlers
    registerApprovalHandlers(ideaGeneratorService)

    // Logo generation handlers
    registerLogoHandlers(ideaGeneratorService)
}

/**
 * Set up event forwarding from EventBus to renderer process
 */
function setupEventForwarding(eventBus: EventBusService): void {
    // Forward research progress events to renderer
    eventBus.on('ideas:research-progress', (progress: ResearchProgress) => {
        const windows = BrowserWindow.getAllWindows()
        for (const win of windows) {
            win.webContents.send('ideas:research-progress', progress)
        }
    })

    // Forward idea generation progress events to renderer
    eventBus.on('ideas:idea-progress', (progress: IdeaProgress) => {
        const windows = BrowserWindow.getAllWindows()
        for (const win of windows) {
            win.webContents.send('ideas:idea-progress', progress)
        }
    })
}

/**
 * Register session management handlers
 */
function registerSessionHandlers(ideaGeneratorService: IdeaGeneratorService): void {
    // Create a new session
    ipcMain.handle('ideas:createSession',
        createIpcHandler('ideas:createSession',
            async (_event: IpcMainInvokeEvent, config: IdeaSessionConfig) => {
                return await ideaGeneratorService.createSession(config)
            }
        )
    )

    // Get a session by ID
    ipcMain.handle('ideas:getSession',
        createSafeIpcHandler('ideas:getSession',
            async (_event: IpcMainInvokeEvent, id: string) => {
                return await ideaGeneratorService.getSession(id)
            }, null
        )
    )

    // Get all sessions
    ipcMain.handle('ideas:getSessions',
        createSafeIpcHandler('ideas:getSessions',
            async () => {
                return await ideaGeneratorService.getSessions()
            }, []
        )
    )

    // Cancel a session
    ipcMain.handle('ideas:cancelSession',
        createIpcHandler('ideas:cancelSession',
            async (_event: IpcMainInvokeEvent, id: string) => {
                await ideaGeneratorService.cancelSession(id)
                return { success: true }
            }
        )
    )
}

/**
 * Register research and generation handlers
 */
function registerGenerationHandlers(ideaGeneratorService: IdeaGeneratorService): void {
    // Start research pipeline
    ipcMain.handle('ideas:startResearch',
        createIpcHandler('ideas:startResearch',
            async (_event: IpcMainInvokeEvent, sessionId: string) => {
                const researchData = await ideaGeneratorService.runResearchPipeline(sessionId)
                return { success: true, data: researchData }
            }
        )
    )

    // Start idea generation
    ipcMain.handle('ideas:startGeneration',
        createIpcHandler('ideas:startGeneration',
            async (_event: IpcMainInvokeEvent, sessionId: string) => {
                await ideaGeneratorService.generateIdeas(sessionId)
                return { success: true }
            }
        )
    )

    // Enrich a specific idea
    ipcMain.handle('ideas:enrichIdea',
        createIpcHandler('ideas:enrichIdea',
            async (_event: IpcMainInvokeEvent, ideaId: string) => {
                const enrichedIdea = await ideaGeneratorService.enrichIdea(ideaId)
                return { success: true, data: enrichedIdea }
            }
        )
    )
}

/**
 * Register idea management handlers
 */
function registerIdeaHandlers(ideaGeneratorService: IdeaGeneratorService): void {
    // Get an idea by ID
    ipcMain.handle('ideas:getIdea',
        createSafeIpcHandler('ideas:getIdea',
            async (_event: IpcMainInvokeEvent, id: string) => {
                return await ideaGeneratorService.getIdea(id)
            }, null
        )
    )

    // Get ideas (optionally filtered by session)
    ipcMain.handle('ideas:getIdeas',
        createSafeIpcHandler('ideas:getIdeas',
            async (_event: IpcMainInvokeEvent, sessionId?: string) => {
                return await ideaGeneratorService.getIdeas(sessionId)
            }, []
        )
    )
}

/**
 * Register approval workflow handlers
 */
function registerApprovalHandlers(ideaGeneratorService: IdeaGeneratorService): void {
    // Approve an idea and create a project
    ipcMain.handle('ideas:approveIdea',
        createIpcHandler('ideas:approveIdea',
            async (_event: IpcMainInvokeEvent, ideaId: string, projectPath: string, selectedName?: string) => {
                const project = await ideaGeneratorService.approveIdea(ideaId, projectPath, selectedName)
                return { success: true, project }
            }
        )
    )

    // Reject an idea
    ipcMain.handle('ideas:rejectIdea',
        createIpcHandler('ideas:rejectIdea',
            async (_event: IpcMainInvokeEvent, ideaId: string) => {
                await ideaGeneratorService.rejectIdea(ideaId)
                return { success: true }
            }
        )
    )
}

/**
 * Register logo generation handlers
 */
function registerLogoHandlers(ideaGeneratorService: IdeaGeneratorService): void {
    // Check if logo generation is available
    ipcMain.handle('ideas:canGenerateLogo',
        createSafeIpcHandler('ideas:canGenerateLogo',
            async () => {
                return await ideaGeneratorService.canGenerateLogo()
            }, false
        )
    )

    // Generate a logo for an idea
    ipcMain.handle('ideas:generateLogo',
        createIpcHandler('ideas:generateLogo',
            async (_event: IpcMainInvokeEvent, ideaId: string, prompt: string) => {
                const logoPath = await ideaGeneratorService.generateLogo(ideaId, prompt)
                return { success: true, logoPath }
            }
        )
    )
}

/**
 * Register interactive research query handlers
 */
function registerResearchQueryHandlers(ideaGeneratorService: IdeaGeneratorService): void {
    ipcMain.handle('ideas:queryResearch',
        createIpcHandler('ideas:queryResearch',
            async (_event: IpcMainInvokeEvent, ideaId: string, question: string) => {
                const answer = await ideaGeneratorService.queryIdeaResearch(ideaId, question)
                return { success: true, answer }
            }
        )
    )
}

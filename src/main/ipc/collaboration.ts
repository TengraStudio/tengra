/**
 * IPC Handlers for Model Collaboration
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { ModelCollaborationService } from '@main/services/model-collaboration.service'
import { multiLLMOrchestrator } from '@main/services/multi-llm-orchestrator.service'
import { Message } from '@shared/types/chat'
import { createSafeIpcHandler, createIpcHandler } from '@main/utils/ipc-wrapper.util'

export function registerCollaborationIpc(collaborationService: ModelCollaborationService) {
    /**
     * Run multiple models in collaboration
     */
    ipcMain.handle('collaboration:run', createIpcHandler('collaboration:run', async (
        _event: IpcMainInvokeEvent,
        request: {
            messages: Message[]
            models: Array<{ provider: string; model: string }>
            strategy: 'consensus' | 'vote' | 'best-of-n' | 'chain-of-thought'
            options?: {
                temperature?: number
                maxTokens?: number
            }
        }
    ) => {
        if (!Array.isArray(request.messages)) {
            throw new Error('Messages must be an array')
        }
        if (!Array.isArray(request.models) || request.models.length === 0) {
            throw new Error('Models must be a non-empty array')
        }
        if (!request.strategy) {
            throw new Error('Strategy is required')
        }

        return await collaborationService.collaborate(request)
    }))

    /**
     * Get provider statistics
     */
    ipcMain.handle('collaboration:getProviderStats', createSafeIpcHandler('collaboration:getProviderStats', async (
        _event: IpcMainInvokeEvent,
        provider?: string
    ) => {
        if (provider) {
            return multiLLMOrchestrator.getProviderStats(provider) || null
        }
        return Object.fromEntries(multiLLMOrchestrator.getAllStats())
    }, {}))

    /**
     * Get active task count for a provider
     */
    ipcMain.handle('collaboration:getActiveTaskCount', createSafeIpcHandler('collaboration:getActiveTaskCount', async (
        _event: IpcMainInvokeEvent,
        provider: string
    ) => {
        if (typeof provider !== 'string') {
            throw new Error('Provider must be a string')
        }
        return multiLLMOrchestrator.getActiveTaskCount(provider)
    }, 0))

    /**
     * Configure provider settings
     */
    ipcMain.handle('collaboration:setProviderConfig', createIpcHandler('collaboration:setProviderConfig', async (
        _event: IpcMainInvokeEvent,
        provider: string,
        config: {
            maxConcurrent: number
            priority: number
            rateLimitPerMinute: number
        }
    ) => {
        if (typeof provider !== 'string') {
            throw new Error('Provider must be a string')
        }
        if (typeof config.maxConcurrent !== 'number' || config.maxConcurrent < 1) {
            throw new Error('maxConcurrent must be a positive number')
        }
        if (typeof config.priority !== 'number') {
            throw new Error('priority must be a number')
        }
        if (typeof config.rateLimitPerMinute !== 'number' || config.rateLimitPerMinute < 1) {
            throw new Error('rateLimitPerMinute must be a positive number')
        }

        multiLLMOrchestrator.setProviderConfig(provider, config)
        return { success: true }
    }))
}

import { getContextWindowService } from '@main/services/context-window.service'
import { getTokenEstimationService } from '@main/services/token-estimation.service'
import { createIpcHandler,createSafeIpcHandler } from '@main/utils/ipc-wrapper.util'
import { Message } from '@shared/types/chat'
import { ipcMain, IpcMainInvokeEvent } from 'electron'

/**
 * Registers IPC handlers for token estimation and context window management
 */
export function registerTokenEstimationIpc() {
    const tokenEstimator = getTokenEstimationService()
    const contextWindowService = getContextWindowService()

    /**
     * Estimate tokens for a single message
     */
    ipcMain.handle('token-estimation:estimateMessage', createSafeIpcHandler('token-estimation:estimateMessage', async (_event: IpcMainInvokeEvent, message: Message) => {
        return tokenEstimator.estimateMessageTokens(message)
    }, 0))

    /**
     * Estimate tokens for multiple messages
     */
    ipcMain.handle('token-estimation:estimateMessages', createSafeIpcHandler('token-estimation:estimateMessages', async (_event: IpcMainInvokeEvent, messages: Message[]) => {
        if (!Array.isArray(messages)) {
            throw new Error('Messages must be an array')
        }
        return tokenEstimator.estimateMessagesTokens(messages)
    }, { estimatedInputTokens: 0, estimatedOutputTokens: 0, estimatedTotalTokens: 0 }))

    /**
     * Estimate tokens for a string
     */
    ipcMain.handle('token-estimation:estimateString', createSafeIpcHandler('token-estimation:estimateString', async (_event: IpcMainInvokeEvent, text: string) => {
        if (typeof text !== 'string') {
            throw new Error('Text must be a string')
        }
        return tokenEstimator.estimateStringTokens(text)
    }, 0))

    /**
     * Get context window size for a model
     */
    ipcMain.handle('token-estimation:getContextWindowSize', createSafeIpcHandler('token-estimation:getContextWindowSize', async (_event: IpcMainInvokeEvent, model: string) => {
        if (typeof model !== 'string') {
            throw new Error('Model must be a string')
        }
        return tokenEstimator.getContextWindowSize(model)
    }, 8192))

    /**
     * Check if messages fit in context window
     */
    ipcMain.handle('token-estimation:fitsInContextWindow', createSafeIpcHandler('token-estimation:fitsInContextWindow', async (_event: IpcMainInvokeEvent, messages: Message[], model: string, reservedTokens?: number) => {
        if (!Array.isArray(messages)) {
            throw new Error('Messages must be an array')
        }
        if (typeof model !== 'string') {
            throw new Error('Model must be a string')
        }
        return tokenEstimator.fitsInContextWindow(messages, model, reservedTokens || 0)
    }, { fits: false, estimatedTokens: 0, contextWindow: 8192, remainingTokens: 0 }))

    /**
     * Get context window information
     */
    ipcMain.handle('context-window:getInfo', createSafeIpcHandler('context-window:getInfo', async (_event: IpcMainInvokeEvent, messages: Message[], model: string, reservedTokens?: number) => {
        if (!Array.isArray(messages)) {
            throw new Error('Messages must be an array')
        }
        if (typeof model !== 'string') {
            throw new Error('Model must be a string')
        }
        return contextWindowService.getContextWindowInfo(messages, model, reservedTokens || 0)
    }, {
        model: '',
        contextWindowSize: 8192,
        estimatedTokens: 0,
        remainingTokens: 0,
        utilizationPercent: 0,
        fits: false
    }))

    /**
     * Truncate messages to fit context window
     */
    ipcMain.handle('context-window:truncate', createIpcHandler('context-window:truncate', async (_event: IpcMainInvokeEvent, messages: Message[], model: string, options?: {
        reservedTokens?: number
        keepSystemMessages?: boolean
        keepRecentMessages?: number
        strategy?: 'recent-first' | 'importance-based'
    }) => {
        if (!Array.isArray(messages)) {
            throw new Error('Messages must be an array')
        }
        if (typeof model !== 'string') {
            throw new Error('Model must be a string')
        }
        return contextWindowService.truncateMessages(messages, model, options)
    }))

    /**
     * Check if truncation is needed
     */
    ipcMain.handle('context-window:needsTruncation', createSafeIpcHandler('context-window:needsTruncation', async (_event: IpcMainInvokeEvent, messages: Message[], model: string, reservedTokens?: number) => {
        if (!Array.isArray(messages)) {
            throw new Error('Messages must be an array')
        }
        if (typeof model !== 'string') {
            throw new Error('Model must be a string')
        }
        return contextWindowService.needsTruncation(messages, model, reservedTokens || 0)
    }, false))

    /**
     * Get recommended truncation settings
     */
    ipcMain.handle('context-window:getRecommendedSettings', createSafeIpcHandler('context-window:getRecommendedSettings', async (_event: IpcMainInvokeEvent, messages: Message[], model: string, reservedTokens?: number) => {
        if (!Array.isArray(messages)) {
            throw new Error('Messages must be an array')
        }
        if (typeof model !== 'string') {
            throw new Error('Model must be a string')
        }
        return contextWindowService.getRecommendedTruncationSettings(messages, model, reservedTokens || 0)
    }, {
        reservedTokens: 0,
        keepSystemMessages: true,
        keepRecentMessages: 10,
        strategy: 'recent-first'
    }))
}

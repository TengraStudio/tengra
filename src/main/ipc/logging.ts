import { ipcMain, BrowserWindow } from 'electron'
import { appLogger, LogLevel } from '../logging/logger'

// Log buffer for streaming to renderer
const logBuffer: Array<{
    id: string
    timestamp: Date
    level: 'debug' | 'info' | 'warn' | 'error'
    source: string
    message: string
}> = []
const MAX_BUFFER_SIZE = 1000
let streamingEnabled = false

/**
 * Add a log entry to the buffer and send to all renderer windows
 */
export function pushLogEntry(level: 'debug' | 'info' | 'warn' | 'error', source: string, message: string) {
    const entry = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        level,
        source,
        message
    }

    // Add to buffer
    logBuffer.push(entry)
    if (logBuffer.length > MAX_BUFFER_SIZE) {
        logBuffer.shift()
    }

    // Stream to all windows if enabled
    if (streamingEnabled) {
        for (const win of BrowserWindow.getAllWindows()) {
            try {
                win.webContents.send('log:entry', entry)
            } catch {
                // Window might be destroyed
            }
        }
    }
}

export function registerLoggingIpc() {
    // Existing log:write handler
    ipcMain.on('log:write', (_event, arg1: any, arg2?: any) => {
        let level: LogLevel = LogLevel.INFO
        let message = ''
        let context = 'renderer'
        let data: any = undefined

        if (typeof arg1 === 'string') {
            // log:write, level, message
            const upper = arg1.toUpperCase()
            if (upper === 'DEBUG') level = LogLevel.DEBUG
            else if (upper === 'INFO') level = LogLevel.INFO
            else if (upper === 'WARN') level = LogLevel.WARN
            else if (upper === 'ERROR') level = LogLevel.ERROR
            message = arg2 || ''
        } else if (arg1 && typeof arg1 === 'object') {
            // log:write, { level, message, context, data }
            level = arg1.level ?? LogLevel.INFO
            message = arg1.message ?? ''
            context = arg1.context ? `renderer:${arg1.context}` : 'renderer'
            data = arg1.data
        }

        switch (level) {
            case LogLevel.DEBUG: appLogger.debug(context, message, data); break
            case LogLevel.INFO: appLogger.info(context, message, data); break
            case LogLevel.WARN: appLogger.warn(context, message, data); break
            case LogLevel.ERROR: appLogger.error(context, message, data); break
        }

        // Also push to streaming buffer
        const levelStr = ['debug', 'info', 'warn', 'error'][level] as 'debug' | 'info' | 'warn' | 'error'
        pushLogEntry(levelStr, context, message)
    })

    // Enable/disable log streaming
    ipcMain.handle('log:stream:start', () => {
        streamingEnabled = true
        return { success: true }
    })

    ipcMain.handle('log:stream:stop', () => {
        streamingEnabled = false
        return { success: true }
    })

    // Get buffered logs
    ipcMain.handle('log:buffer:get', () => {
        return logBuffer.slice(-500) // Return last 500 entries
    })

    // Clear log buffer
    ipcMain.handle('log:buffer:clear', () => {
        logBuffer.length = 0
        return { success: true }
    })
}

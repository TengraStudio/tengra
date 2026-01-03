import { ipcMain } from 'electron'
import { appLogger, LogLevel } from '../logging/logger'

type LogPayload = {
    level: LogLevel
    message: string
    source?: string
    data?: unknown
}

export function registerLoggingIpc() {
    ipcMain.on('log:write', (_event, payload: LogPayload) => {
        if (!payload || !payload.level || !payload.message) {
            return
        }
        const source = payload.source ? `renderer:${payload.source}` : 'renderer'
        appLogger.write({
            level: payload.level,
            message: payload.message,
            source,
            data: payload.data
        })
    })
}

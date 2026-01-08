import { ipcMain } from 'electron'
import { appLogger, LogLevel } from '../logging/logger'

export function registerLoggingIpc() {
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
    })
}

import { JsonValue } from '@shared/types/common'

let installed = false

type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type LogValue = JsonValue | Error | object

export function installRendererLogger() {
    if (installed) return
    installed = true

    const logger = window.electron?.log
    if (!logger) return

    const original = {
        debug: console.debug.bind(console),
        info: console.info.bind(console),
        log: console.log.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console)
    }

    const send = (level: LogLevel, args: LogValue[]) => {
        // Temporarily sending all logs to main for debugging
        // if (level === 'error' || level === 'warn') {
        const message = formatArgs(args)
        logger.write(level, message)
        // }
    }

    console.debug = (...args: LogValue[]) => {
        original.debug(...args)
        send('debug', args)
    }
    console.log = (...args: LogValue[]) => {
        original.log(...args)
        send('info', args)
    }
    console.info = (...args: LogValue[]) => {
        original.info(...args)
        send('info', args)
    }
    console.warn = (...args: LogValue[]) => {
        original.warn(...args)
        send('warn', args)
    }
    console.error = (...args: LogValue[]) => {
        original.error(...args)
        send('error', args)
    }

    window.addEventListener('error', (event) => {
        logger.error('window error', {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
        })
    })

    window.addEventListener('unhandledrejection', (event) => {
        logger.error('unhandledrejection', { reason: formatValue(event.reason) })
    })
}

function formatArgs(args: LogValue[]): string {
    return args.map(formatValue).join(' ')
}

function formatValue(value: LogValue): string {
    if (value instanceof Error) {
        return value.stack ? `${value.message} | ${value.stack}` : value.message
    }
    if (typeof value === 'string') {
        return value
    }
    // DO NOT JSON.stringify in the renderer's hot path for regular logs.
    // This is extremely expensive and blocks the main thread.
    // If it's an object and we really need it in the main log, 
    // we should only do it for errors/warnings or specific whitelisted cases.
    return '[Object]'
}

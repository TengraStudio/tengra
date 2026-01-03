let installed = false

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

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

    const send = (level: LogLevel, args: unknown[]) => {
        const message = formatArgs(args)
        logger.write(level, message)
    }

    console.debug = (...args: unknown[]) => {
        send('debug', args)
        original.debug(...args)
    }
    console.log = (...args: unknown[]) => {
        send('info', args)
        original.log(...args)
    }
    console.info = (...args: unknown[]) => {
        send('info', args)
        original.info(...args)
    }
    console.warn = (...args: unknown[]) => {
        send('warn', args)
        original.warn(...args)
    }
    console.error = (...args: unknown[]) => {
        send('error', args)
        original.error(...args)
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

function formatArgs(args: unknown[]): string {
    return args.map(formatValue).join(' ')
}

function formatValue(value: unknown): string {
    if (value instanceof Error) {
        return value.stack ? `${value.message} | ${value.stack}` : value.message
    }
    if (typeof value === 'string') {
        return value
    }
    try {
        return JSON.stringify(value)
    } catch {
        return String(value)
    }
}

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

type LogPayload = {
    level: LogLevel
    message: string
    context: string
    data?: unknown
}

const MAX_BYTES = 10 * 1024 * 1024
const MAX_FILES = 5

class AppLogger {
    private logDir = ''
    private logPath = ''
    private size = 0
    private initialized = false
    private queue: Promise<void> = Promise.resolve()
    private originalConsole: any = null
    private currentLevel: LogLevel = LogLevel.INFO

    init(logDir?: string) {
        if (this.initialized && !logDir) return

        if (logDir) {
            this.logDir = logDir
        } else {
            try {
                const base = app.getPath('userData')
                this.logDir = path.join(base, 'logs')
            } catch {
                this.logDir = path.join(process.cwd(), 'logs')
            }
        }

        this.logPath = path.join(this.logDir, 'app.log')
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true })
        }
        this.size = this.safeStatSize(this.logPath)
        this.initialized = true
        this.info('Logger', `Logger initialized at ${this.logPath}`)
    }

    setLevel(level: LogLevel) {
        this.currentLevel = level
    }

    installConsoleRedirect() {
        if (this.originalConsole) return
        this.originalConsole = {
            debug: console.debug.bind(console),
            info: console.info.bind(console),
            log: console.log.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console)
        }

        console.debug = (...args: unknown[]) => {
            this.debug('console', formatArgs(args))
            this.originalConsole?.debug(...args)
        }
        console.log = (...args: unknown[]) => {
            this.info('console', formatArgs(args))
            this.originalConsole?.log(...args)
        }
        console.info = (...args: unknown[]) => {
            this.info('console', formatArgs(args))
            this.originalConsole?.info(...args)
        }
        console.warn = (...args: unknown[]) => {
            this.warn('console', formatArgs(args))
            this.originalConsole?.warn(...args)
        }
        console.error = (...args: unknown[]) => {
            this.error('console', formatArgs(args))
            this.originalConsole?.error(...args)
        }
    }

    debug(context: string, message: string, data?: unknown) {
        if (this.currentLevel <= LogLevel.DEBUG) {
            this.write({ level: LogLevel.DEBUG, message, context, data })
        }
    }

    info(context: string, message: string, data?: unknown) {
        if (this.currentLevel <= LogLevel.INFO) {
            this.write({ level: LogLevel.INFO, message, context, data })
        }
    }

    warn(context: string, message: string, data?: unknown) {
        if (this.currentLevel <= LogLevel.WARN) {
            this.write({ level: LogLevel.WARN, message, context, data })
        }
    }

    error(context: string, message: string, data?: unknown) {
        if (this.currentLevel <= LogLevel.ERROR) {
            this.write({ level: LogLevel.ERROR, message, context, data })
        }
    }

    private write(payload: LogPayload) {
        if (!this.initialized) {
            this.init()
        }

        const line = formatLine(payload)

        // Console Output (with colors if possible)
        const color = getLevelColor(payload.level)
        const reset = '\x1b[0m'
        const levelStr = LogLevel[payload.level].padEnd(5)
        if (this.originalConsole) {
            const consoleMsg = `${color}[${levelStr}] [${payload.context}] ${payload.message}${reset}`
            if (payload.level === LogLevel.ERROR) this.originalConsole.error(consoleMsg)
            else if (payload.level === LogLevel.WARN) this.originalConsole.warn(consoleMsg)
            else this.originalConsole.log(consoleMsg)
        }

        this.queue = this.queue.then(async () => {
            this.rotateIfNeeded(line.length)
            await fs.promises.appendFile(this.logPath, line, 'utf8')
            this.size += Buffer.byteLength(line, 'utf8')
        }).catch((err) => {
            if (this.originalConsole) this.originalConsole.error('Logger write failed', err)
        })
    }

    private rotateIfNeeded(nextBytes: number) {
        if (this.size + nextBytes <= MAX_BYTES) {
            return
        }
        for (let i = MAX_FILES - 1; i >= 1; i--) {
            const src = `${this.logPath}.${i}`
            const dest = `${this.logPath}.${i + 1}`
            if (fs.existsSync(src)) {
                fs.renameSync(src, dest)
            }
        }
        if (fs.existsSync(this.logPath)) {
            fs.renameSync(this.logPath, `${this.logPath}.1`)
        }
        this.size = 0
    }

    private safeStatSize(filePath: string): number {
        try {
            return fs.statSync(filePath).size
        } catch {
            return 0
        }
    }
}

function getLevelColor(level: LogLevel): string {
    switch (level) {
        case LogLevel.DEBUG: return '\x1b[36m' // Cyan
        case LogLevel.INFO: return '\x1b[32m'  // Green
        case LogLevel.WARN: return '\x1b[33m'  // Yellow
        case LogLevel.ERROR: return '\x1b[31m' // Red
        default: return ''
    }
}

export const appLogger = new AppLogger()

// Legacy export for those who used static Logger
export class Logger {
    static init(logDir?: string) { appLogger.init(logDir) }
    static setLevel(level: LogLevel) { appLogger.setLevel(level) }
    static debug(context: string, message: string, data?: unknown) { appLogger.debug(context, message, data) }
    static info(context: string, message: string, data?: unknown) { appLogger.info(context, message, data) }
    static warn(context: string, message: string, data?: unknown) { appLogger.warn(context, message, data) }
    static error(context: string, message: string, data?: unknown) { appLogger.error(context, message, data) }
}

export function initAppLogger() {
    appLogger.init()
    appLogger.installConsoleRedirect()
}

function formatLine(payload: LogPayload): string {
    const timestamp = new Date().toISOString()
    const level = LogLevel[payload.level].padEnd(5)
    const context = payload.context
    const base = sanitize(payload.message)
    const meta = payload.data !== undefined ? ` | ${sanitize(formatValue(payload.data))}` : ''
    return `[${timestamp}] [${level}] [${context}] ${base}${meta}\n`
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

function sanitize(message: string): string {
    return String(message).replace(/\r?\n/g, '\\n')
}


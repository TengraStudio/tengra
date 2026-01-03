import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type LogPayload = {
    level: LogLevel
    message: string
    source?: string
    data?: unknown
}

type ConsoleLike = {
    debug: (...args: unknown[]) => void
    info: (...args: unknown[]) => void
    log: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
}

const MAX_BYTES = 10 * 1024 * 1024
const MAX_FILES = 5

class AppLogger {
    private logDir = ''
    private logPath = ''
    private size = 0
    private initialized = false
    private queue: Promise<void> = Promise.resolve()
    private originalConsole: ConsoleLike | null = null

    init() {
        if (this.initialized) return
        this.logDir = this.resolveLogDir()
        this.logPath = path.join(this.logDir, 'app.log')
        fs.mkdirSync(this.logDir, { recursive: true })
        this.size = this.safeStatSize(this.logPath)
        this.initialized = true
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
            this.debug(formatArgs(args), { source: 'main' })
            this.originalConsole?.debug(...args)
        }
        console.log = (...args: unknown[]) => {
            this.info(formatArgs(args), { source: 'main' })
            this.originalConsole?.log(...args)
        }
        console.info = (...args: unknown[]) => {
            this.info(formatArgs(args), { source: 'main' })
            this.originalConsole?.info(...args)
        }
        console.warn = (...args: unknown[]) => {
            this.warn(formatArgs(args), { source: 'main' })
            this.originalConsole?.warn(...args)
        }
        console.error = (...args: unknown[]) => {
            this.error(formatArgs(args), { source: 'main' })
            this.originalConsole?.error(...args)
        }
    }

    debug(message: string, options?: { source?: string; data?: unknown }) {
        this.write({ level: 'debug', message, source: options?.source, data: options?.data })
    }

    info(message: string, options?: { source?: string; data?: unknown }) {
        this.write({ level: 'info', message, source: options?.source, data: options?.data })
    }

    warn(message: string, options?: { source?: string; data?: unknown }) {
        this.write({ level: 'warn', message, source: options?.source, data: options?.data })
    }

    error(message: string, options?: { source?: string; data?: unknown }) {
        this.write({ level: 'error', message, source: options?.source, data: options?.data })
    }

    write(payload: LogPayload) {
        if (!this.initialized) {
            this.init()
        }
        const line = formatLine(payload)
        this.queue = this.queue.then(async () => {
            this.rotateIfNeeded(line.length)
            await fs.promises.appendFile(this.logPath, line, 'utf8')
            this.size += Buffer.byteLength(line, 'utf8')
        }).catch((err) => {
            this.originalConsole?.error('Logger write failed', err)
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

    private resolveLogDir(): string {
        try {
            const base = app.getPath('userData')
            return path.join(base, 'logs')
        } catch {
            return path.join(process.cwd(), 'logs')
        }
    }

    private safeStatSize(filePath: string): number {
        try {
            return fs.statSync(filePath).size
        } catch {
            return 0
        }
    }
}

export const appLogger = new AppLogger()

export function initAppLogger() {
    appLogger.init()
    appLogger.installConsoleRedirect()
}

function formatLine(payload: LogPayload): string {
    const timestamp = formatTimestamp(new Date())
    const level = payload.level.toUpperCase().padEnd(5, ' ')
    const source = payload.source ? payload.source : 'main'
    const base = sanitize(payload.message)
    const meta = payload.data !== undefined ? ` | ${sanitize(formatValue(payload.data))}` : ''
    return `${timestamp} [${level}] [${source}] ${base}${meta}\n`
}

function formatTimestamp(date: Date): string {
    const pad = (value: number, len: number) => String(value).padStart(len, '0')
    const year = date.getFullYear()
    const month = pad(date.getMonth() + 1, 2)
    const day = pad(date.getDate(), 2)
    const hours = pad(date.getHours(), 2)
    const minutes = pad(date.getMinutes(), 2)
    const seconds = pad(date.getSeconds(), 2)
    const ms = pad(date.getMilliseconds(), 3)
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`
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
    return message.replace(/\r?\n/g, '\\n')
}

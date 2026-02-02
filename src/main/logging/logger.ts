/* eslint-disable no-console */
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

import { AppError, JsonValue } from '@shared/types/common';
import { app } from 'electron';

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

export interface LoggerConfig {
    maxBytes: number
    maxFiles: number
    compressRotated: boolean
    jsonFormat: boolean
    retentionDays: number
}

type LogPayload = {
    level: LogLevel
    message: string
    context: string
    data?: JsonValue | Error | AppError
    timestamp?: string
}

const DEFAULT_CONFIG: LoggerConfig = {
    maxBytes: 10 * 1024 * 1024,  // 10 MB
    maxFiles: 5,
    compressRotated: true,
    jsonFormat: false,
    retentionDays: 30
};

class AppLogger {
    private logDir = '';
    private logPath = '';
    private size = 0;
    private initialized = false;
    private queue: Promise<void> = Promise.resolve();
    private originalConsole: {
        debug: Console['debug']
        info: Console['info']
        log: Console['log']
        warn: Console['warn']
        error: Console['error']
    } | null = null;
    private currentLevel: LogLevel = LogLevel.INFO;
    private config: LoggerConfig = { ...DEFAULT_CONFIG };
    private cleanupTimer: ReturnType<typeof setInterval> | null = null;

    init(logDir?: string, config?: Partial<LoggerConfig>) {
        if (this.initialized && !logDir && !config) { return; }

        if (config) {
            this.config = { ...this.config, ...config };
        }

        this.logDir = logDir ?? this.determineLogDir();
        this.logPath = path.join(this.logDir, 'app.log');
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true, mode: 0o700 });
        }
        this.size = this.safeStatSize(this.logPath);
        this.initialized = true;

        // Start cleanup scheduler (runs every 24 hours)
        this.startCleanupScheduler();

        this.info('Logger', `Logger initialized at ${this.logPath}`);
    }

    private determineLogDir(): string {
        try {
            return path.join(app.getPath('userData'), 'logs');
        } catch {
            // ignore
        }
        return path.join(process.cwd(), 'logs');
    }

    configure(config: Partial<LoggerConfig>) {
        this.config = { ...this.config, ...config };
    }

    getConfig(): LoggerConfig {
        return { ...this.config };
    }

    setLevel(level: LogLevel) {
        this.currentLevel = level;
    }

    getLevel(): LogLevel {
        return this.currentLevel;
    }

    getLogDir(): string {
        return this.logDir;
    }

    installConsoleRedirect() {
        if (this.originalConsole) { return; }
        this.originalConsole = {
            debug: console.debug.bind(console),
            info: console.info.bind(console),
            log: console.log.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console)
        };

        console.debug = (...args: Array<JsonValue | Error | object>) => {
            this.debug('console', formatArgs(args));
            this.originalConsole?.debug(...args);
        };
        console.log = (...args: Array<JsonValue | Error | object>) => {
            this.info('console', formatArgs(args));
            this.originalConsole?.log(...args);
        };
        console.info = (...args: Array<JsonValue | Error | object>) => {
            this.info('console', formatArgs(args));
            this.originalConsole?.info(...args);
        };
        console.warn = (...args: Array<JsonValue | Error | object>) => {
            this.warn('console', formatArgs(args));
            this.originalConsole?.warn(...args);
        };
        console.error = (...args: Array<JsonValue | Error | object>) => {
            this.error('console', formatArgs(args));
            this.originalConsole?.error(...args);
        };
    }

    debug(context: string, message: string, data?: JsonValue | Error | AppError) {
        if (this.currentLevel <= LogLevel.DEBUG) {
            this.write({ level: LogLevel.DEBUG, message, context, data });
        }
    }

    info(context: string, message: string, data?: JsonValue | Error | AppError) {
        if (this.currentLevel <= LogLevel.INFO) {
            this.write({ level: LogLevel.INFO, message, context, data });
        }
    }

    warn(context: string, message: string, data?: JsonValue | Error | AppError) {
        if (this.currentLevel <= LogLevel.WARN) {
            this.write({ level: LogLevel.WARN, message, context, data });
        }
    }

    error(context: string, message: string, data?: JsonValue | Error | AppError) {
        if (this.currentLevel <= LogLevel.ERROR) {
            this.write({ level: LogLevel.ERROR, message, context, data });
        }
    }

    private write(payload: LogPayload) {
        if (!this.initialized) {
            this.init();
        }

        const line = this.config.jsonFormat
            ? formatLineJson(payload)
            : formatLine(payload);

        // Console Output (with colors if possible)
        const color = getLevelColor(payload.level);
        const reset = '\x1b[0m';
        const levelStr = LogLevel[payload.level].padEnd(5);
        if (this.originalConsole) {
            const consoleMsg = `${color}[${levelStr}] [${payload.context}] ${payload.message}${reset}`;
            if (payload.level === LogLevel.ERROR) { this.originalConsole.error(consoleMsg); }
            else if (payload.level === LogLevel.WARN) { this.originalConsole.warn(consoleMsg); }
            else { this.originalConsole.log(consoleMsg); }
        }

        this.queue = this.queue.then(async () => {
            await this.rotateIfNeeded(line.length);
            await fs.promises.appendFile(this.logPath, line, 'utf8');
            this.size += Buffer.byteLength(line, 'utf8');
        }).catch((err) => {
            if (this.originalConsole) { this.originalConsole.error('Logger write failed', err); }
        });
    }

    private async rotateIfNeeded(nextBytes: number) {
        if (this.size + nextBytes <= this.config.maxBytes) {
            return;
        }

        // Handle compressed files (.gz)
        if (this.config.compressRotated) {
            for (let i = this.config.maxFiles - 1; i >= 1; i--) {
                const src = `${this.logPath}.${i}.gz`;
                const dest = `${this.logPath}.${i + 1}.gz`;
                if (fs.existsSync(src)) {
                    fs.renameSync(src, dest);
                }
            }
            // Compress the current .1 file if it exists
            const firstRotated = `${this.logPath}.1`;
            if (fs.existsSync(firstRotated)) {
                await this.compressFile(firstRotated, `${firstRotated}.gz`);
                fs.unlinkSync(firstRotated);
            }
        } else {
            for (let i = this.config.maxFiles - 1; i >= 1; i--) {
                const src = `${this.logPath}.${i}`;
                const dest = `${this.logPath}.${i + 1}`;
                if (fs.existsSync(src)) {
                    fs.renameSync(src, dest);
                }
            }
        }

        if (fs.existsSync(this.logPath)) {
            fs.renameSync(this.logPath, `${this.logPath}.1`);
        }
        this.size = 0;
    }

    private async compressFile(src: string, dest: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const input = fs.createReadStream(src);
            const output = fs.createWriteStream(dest);
            const gzip = zlib.createGzip();

            input.pipe(gzip).pipe(output);

            output.on('finish', resolve);
            output.on('error', reject);
            input.on('error', reject);
        });
    }

    private startCleanupScheduler() {
        if (this.cleanupTimer) { return; }

        // Run cleanup every 24 hours
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        this.cleanupTimer = setInterval(() => {
            this.cleanupOldLogs();
        }, ONE_DAY_MS);

        // Also run cleanup on startup
        this.cleanupOldLogs();
    }

    /**
     * Clean up log files older than retentionDays
     */
    cleanupOldLogs(): number {
        if (!this.logDir || !fs.existsSync(this.logDir)) {
            return 0;
        }

        const retentionMs = this.config.retentionDays * 24 * 60 * 60 * 1000;
        const now = Date.now();
        let deleted = 0;

        try {
            const files = fs.readdirSync(this.logDir);
            for (const file of files) {
                if (!file.endsWith('.log') && !file.endsWith('.gz')) {
                    continue;
                }
                const filePath = path.join(this.logDir, file);
                const stat = fs.statSync(filePath);
                if (now - stat.mtime.getTime() > retentionMs) {
                    fs.unlinkSync(filePath);
                    deleted++;
                }
            }
        } catch (err) {
            if (this.originalConsole) {
                this.originalConsole.error('Failed to cleanup old logs', err);
            }
        }

        return deleted;
    }

    /**
     * Get log statistics
     */
    getStats(): { totalFiles: number; totalSize: number; oldestLog: Date | null; newestLog: Date | null } {
        if (!this.logDir || !fs.existsSync(this.logDir)) {
            return { totalFiles: 0, totalSize: 0, oldestLog: null, newestLog: null };
        }

        let totalFiles = 0;
        let totalSize = 0;
        let oldestLog: Date | null = null;
        let newestLog: Date | null = null;

        try {
            const files = fs.readdirSync(this.logDir);
            for (const file of files) {
                if (!this.isLogFile(file)) { continue; }

                const stat = fs.statSync(path.join(this.logDir, file));
                totalFiles++;
                totalSize += stat.size;
                if (!oldestLog || stat.mtime.getTime() < oldestLog.getTime()) {
                    oldestLog = stat.mtime;
                }
                if (!newestLog || stat.mtime.getTime() > newestLog.getTime()) {
                    newestLog = stat.mtime;
                }
            }
        } catch {
            // ignore
        }

        return { totalFiles, totalSize, oldestLog, newestLog };
    }

    private isLogFile(file: string): boolean {
        return file.endsWith('.log') || file.endsWith('.gz');
    }

    /**
     * Dispose resources
     */
    dispose() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    private safeStatSize(filePath: string): number {
        try {
            return fs.statSync(filePath).size;
        } catch {
            return 0;
        }
    }
}

function getLevelColor(level: LogLevel): string {
    switch (level) {
        case LogLevel.DEBUG: return '\x1b[36m'; // Cyan
        case LogLevel.INFO: return '\x1b[32m';  // Green
        case LogLevel.WARN: return '\x1b[33m';  // Yellow
        case LogLevel.ERROR: return '\x1b[31m'; // Red
        default: return '';
    }
}

export const appLogger = new AppLogger();

// Legacy export for those who used static Logger
export class Logger {
    static init(logDir?: string) { appLogger.init(logDir); }
    static setLevel(level: LogLevel) { appLogger.setLevel(level); }
    static debug(context: string, message: string, data?: JsonValue | Error | AppError) { appLogger.debug(context, message, data); }
    static info(context: string, message: string, data?: JsonValue | Error | AppError) { appLogger.info(context, message, data); }
    static warn(context: string, message: string, data?: JsonValue | Error | AppError) { appLogger.warn(context, message, data); }
    static error(context: string, message: string, data?: JsonValue | Error | AppError) { appLogger.error(context, message, data); }
}

export function initAppLogger() {
    appLogger.init();
    appLogger.installConsoleRedirect();
}

function formatLine(payload: LogPayload): string {
    const timestamp = new Date().toISOString();
    const level = LogLevel[payload.level].padEnd(5);
    const context = payload.context;
    const base = sanitize(payload.message);
    const meta = payload.data !== undefined ? ` | ${sanitize(formatValue(payload.data))}` : '';
    return `[${timestamp}] [${level}] [${context}] ${base}${meta}\n`;
}

function formatLineJson(payload: LogPayload): string {
    const timestamp = new Date().toISOString();
    const entry = {
        timestamp,
        level: LogLevel[payload.level],
        context: payload.context,
        message: payload.message,
        data: payload.data !== undefined ? formatValueForJson(payload.data) : undefined
    };
    return JSON.stringify(entry) + '\n';
}

function formatValueForJson(value: JsonValue | Error | AppError | object): JsonValue {
    if (value instanceof Error) {
        return {
            error: value.message,
            stack: value.stack
        };
    }
    if (value && typeof value === 'object' && 'message' in value && ('code' in value || 'stack' in value)) {
        const ae = value as AppError;
        return {
            message: ae.message,
            code: ae.code,
            stack: ae.stack
        };
    }
    return value as JsonValue;
}

function formatArgs(args: Array<JsonValue | Error | object>): string {
    return args.map(formatValue).join(' ');
}

function formatValue(value: JsonValue | Error | AppError | object): string {
    if (value instanceof Error) {
        return value.stack ? `${value.message} | ${value.stack}` : value.message;
    }

    if (isAppError(value)) {
        let res = value.message;
        if (value.code) { res = `[${value.code}] ${res}`; }
        if (value.stack) { res = `${res} | ${value.stack}`; }
        return res;
    }

    if (typeof value === 'string') {
        return value;
    }

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function isAppError(value: unknown): value is AppError {
    return value !== null && typeof value === 'object' && 'message' in value && ('code' in value || 'stack' in value);
}


function sanitize(message: string): string {
    return String(message).replace(/\r?\n/g, '\\n');
}

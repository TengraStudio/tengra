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
    ERROR = 3,
}

export interface LoggerConfig {
    maxBytes: number;
    maxFiles: number;
    compressRotated: boolean;
    jsonFormat: boolean;
    retentionDays: number;
}

/**
 * Payload for a search log entry.
 */
type LogPayload = {
    /** Log level */
    level: LogLevel;
    /** Log message */
    message: string;
    /** Context or service name */
    context: string;
    /** Optional metadata or error */
    data?: JsonValue | Error | AppError;
    /** Optional timestamp */
    timestamp?: string;
};

const MAX_FILES_UPPER_BOUND = 100;

const DEFAULT_CONFIG: LoggerConfig = {
    maxBytes: 10 * 1024 * 1024, // 10 MB
    maxFiles: 5,
    compressRotated: true,
    jsonFormat: false,
    retentionDays: 30,
};

class AppLogger {
    private logDir = '';
    private logPath = '';
    private size = 0;
    private initialized = false;
    private queue: Promise<void> = Promise.resolve();
    private originalConsole: {
        debug: Console['debug'];
        info: Console['info'];
        log: Console['log'];
        warn: Console['warn'];
        error: Console['error'];
    } | null = null;
    private currentLevel: LogLevel = LogLevel.INFO;
    private config: LoggerConfig = { ...DEFAULT_CONFIG };
    private cleanupTimer: ReturnType<typeof setInterval> | null = null;

    private isBrokenPipeError(error: unknown): boolean {
        if (!error || typeof error !== 'object') {
            return false;
        }
        const maybeCode = 'code' in error ? (error as { code?: string }).code : undefined;
        const maybeMessage = 'message' in error ? String((error as { message?: unknown }).message ?? '') : '';
        return maybeCode === 'EPIPE' || maybeMessage.toLowerCase().includes('broken pipe');
    }

    private safeConsoleCall(method: 'debug' | 'info' | 'log' | 'warn' | 'error', ...args: unknown[]) {
        const original = this.originalConsole?.[method];
        if (!original) {
            return;
        }
        try {
            (original as (...items: unknown[]) => void)(...args);
        } catch (error) {
            if (!this.isBrokenPipeError(error)) {
                // Do not rethrow; logger should never crash the app process.
            }
        }
    }

    /**
     * Initializes the logger with a directory and optional configuration.
     * @param logDir - The directory to store log files.
     * @param config - Optional configuration overrides.
     */
    init(logDir?: string, config?: Partial<LoggerConfig>) {
        if (this.initialized && !logDir && !config) {
            return;
        }

        if (config) {
            this.config = { ...this.config, ...config };
        }

        this.logDir = logDir ?? this.determineLogDir();
        this.logPath = path.join(this.logDir, 'app.log');
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true, mode: 0o700 });
        }
        this.size = 0;
        void this.refreshCurrentLogSize();
        this.initialized = true;

        // Start cleanup scheduler (runs every 24 hours)
        this.startCleanupScheduler();

        this.info('Logger', `Logger initialized at ${this.logPath}`);
    }

    /**
     * Determines the log directory based on environment.
     * @returns The path to the log directory.
     */
    private determineLogDir(): string {
        try {
            return path.join(app.getPath('userData'), 'logs');
        } catch {
            // ignore
        }
        return path.join(process.cwd(), 'logs');
    }

    /**
     * Reconfigures the logger with new settings.
     * @param config - The configuration overrides.
     */
    configure(config: Partial<LoggerConfig>) {
        this.config = { ...this.config, ...config };
    }

    /**
     * Returns the current logger configuration.
     * @returns The active configuration.
     */
    getConfig(): LoggerConfig {
        return { ...this.config };
    }

    /**
     * Sets the minimum log level for output.
     * @param level - The log level to set.
     */
    setLevel(level: LogLevel) {
        this.currentLevel = level;
    }

    /**
     * Returns the current minimum log level.
     * @returns The active log level.
     */
    getLevel(): LogLevel {
        return this.currentLevel;
    }

    /**
     * Returns the directory where log files are stored.
     * @returns The log directory path.
     */
    getLogDir(): string {
        return this.logDir;
    }

    /**
     * Redirects global console methods to the AppLogger.
     */
    installConsoleRedirect() {
        if (this.originalConsole) {
            return;
        }
        this.originalConsole = {
            debug: console.debug.bind(console),
            info: console.info.bind(console),
            log: console.log.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
        };

        console.debug = (...args: Array<JsonValue | Error | object>) => {
            this.debug('console', formatArgs(args));
            this.safeConsoleCall('debug', ...args);
        };
        console.log = (...args: Array<JsonValue | Error | object>) => {
            this.info('console', formatArgs(args));
            this.safeConsoleCall('log', ...args);
        };
        console.info = (...args: Array<JsonValue | Error | object>) => {
            this.info('console', formatArgs(args));
            this.safeConsoleCall('info', ...args);
        };
        console.warn = (...args: Array<JsonValue | Error | object>) => {
            this.warn('console', formatArgs(args));
            this.safeConsoleCall('warn', ...args);
        };
        console.error = (...args: Array<JsonValue | Error | object>) => {
            const message = formatArgs(args);
            if (message.includes('DeprecationWarning')) {
                this.warn('console', message);
                this.safeConsoleCall('warn', ...args);
                return;
            }
            this.error('console', message);
            this.safeConsoleCall('error', ...args);
        };
    }

    /**
     * Logs a debug message.
     * @param context - The context or service name.
     * @param message - The log message.
     * @param data - Optional metadata or error.
     */
    debug(context: string, message: string, data?: JsonValue | Error | AppError) {
        if (this.currentLevel <= LogLevel.DEBUG) {
            this.write({ level: LogLevel.DEBUG, message, context, data });
        }
    }

    /**
     * Logs an info message.
     * @param context - The context or service name.
     * @param message - The log message.
     * @param data - Optional metadata or error.
     */
    info(context: string, message: string, data?: JsonValue | Error | AppError) {
        if (this.currentLevel <= LogLevel.INFO) {
            this.write({ level: LogLevel.INFO, message, context, data });
        }
    }

    /**
     * Logs a warning message.
     * @param context - The context or service name.
     * @param message - The log message.
     * @param data - Optional metadata or error.
     */
    warn(context: string, message: string, data?: JsonValue | Error | AppError) {
        if (this.currentLevel <= LogLevel.WARN) {
            this.write({ level: LogLevel.WARN, message, context, data });
        }
    }

    /**
     * Logs an error message.
     * @param context - The context or service name.
     * @param message - The log message.
     * @param data - Optional metadata or error.
     */
    error(context: string, message: string, data?: JsonValue | Error | AppError) {
        if (this.currentLevel <= LogLevel.ERROR) {
            this.write({ level: LogLevel.ERROR, message, context, data });
        }
    }

    private write(payload: LogPayload) {
        if (!this.initialized) {
            this.init();
        }

        const line = this.config.jsonFormat ? formatLineJson(payload) : formatLine(payload);

        // Console Output (with colors if possible)
        const color = getLevelColor(payload.level);
        const reset = '\x1b[0m';
        const levelStr = LogLevel[payload.level].padEnd(5);
        if (this.originalConsole) {
            const consoleMsg = `${color}[${levelStr}] [${payload.context}] ${payload.message}${reset}`;
            if (payload.level === LogLevel.ERROR) {
                this.safeConsoleCall('error', consoleMsg);
            } else if (payload.level === LogLevel.WARN) {
                this.safeConsoleCall('warn', consoleMsg);
            } else {
                this.safeConsoleCall('log', consoleMsg);
            }
        }

        this.queue = this.queue
            .then(async () => {
                await this.rotateIfNeeded(line.length);
                await fs.promises.appendFile(this.logPath, line, 'utf8');
                this.size += Buffer.byteLength(line, 'utf8');
            })
            .catch(err => {
                if (this.originalConsole) {
                    this.safeConsoleCall('error', 'Logger write failed', err);
                }
            });
    }

    private async rotateIfNeeded(nextBytes: number) {
        if (this.size + nextBytes <= this.config.maxBytes) {
            return;
        }

        // Handle compressed files (.gz)
        const maxFiles = Math.min(this.config.maxFiles, MAX_FILES_UPPER_BOUND);

        if (this.config.compressRotated) {
            for (let i = maxFiles - 1; i >= 1; i--) {
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
            for (let i = maxFiles - 1; i >= 1; i--) {
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
        if (this.cleanupTimer) {
            return;
        }

        const runCleanup = () => {
            void this.cleanupOldLogsAsync();
        };

        // Run cleanup every 24 hours
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        this.cleanupTimer = setInterval(() => {
            runCleanup();
        }, ONE_DAY_MS);

        // Also run cleanup on startup
        runCleanup();
    }

    private async cleanupOldLogsAsync(): Promise<number> {
        if (!this.logDir) {
            return 0;
        }

        try {
            await fs.promises.access(this.logDir, fs.constants.F_OK);
        } catch {
            return 0;
        }

        const retentionMs = this.config.retentionDays * 24 * 60 * 60 * 1000;
        const now = Date.now();
        let deleted = 0;

        try {
            const files = await fs.promises.readdir(this.logDir);
            const maxFilesToCleanup = 1000;
            const processFiles = files.slice(0, maxFilesToCleanup).filter(file => this.isLogFile(file));
            for (const file of processFiles) {
                const filePath = path.join(this.logDir, file);
                const stat = await fs.promises.stat(filePath);
                if (now - stat.mtime.getTime() > retentionMs) {
                    await fs.promises.unlink(filePath);
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
            const maxFilesToCleanup = 1000;
            const processCount = Math.min(files.length, maxFilesToCleanup);

            for (let i = 0; i < processCount; i++) {
                const file = files[i];
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
     * @returns Statistics about log files.
     */
    getStats(): {
        totalFiles: number;
        totalSize: number;
        oldestLog: Date | null;
        newestLog: Date | null;
    } {
        if (!this.logDir || !fs.existsSync(this.logDir)) {
            return { totalFiles: 0, totalSize: 0, oldestLog: null, newestLog: null };
        }

        let totalFiles = 0;
        let totalSize = 0;
        let oldestLog: Date | null = null;
        let newestLog: Date | null = null;

        try {
            const files = fs.readdirSync(this.logDir);
            const maxFilesToProcess = 1000;
            const processCount = Math.min(files.length, maxFilesToProcess);

            for (let i = 0; i < processCount; i++) {
                const file = files[i];
                if (!this.isLogFile(file)) {
                    continue;
                }

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
     * Cleans up resources used by the logger.
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

    private async refreshCurrentLogSize(): Promise<void> {
        try {
            const stat = await fs.promises.stat(this.logPath);
            this.size = stat.size;
        } catch {
            this.size = 0;
        }
    }
}

function getLevelColor(level: LogLevel): string {
    switch (level) {
        case LogLevel.DEBUG:
            return '\x1b[36m'; // Cyan
        case LogLevel.INFO:
            return '\x1b[32m'; // Green
        case LogLevel.WARN:
            return '\x1b[33m'; // Yellow
        case LogLevel.ERROR:
            return '\x1b[31m'; // Red
        default:
            return '';
    }
}

export const appLogger = new AppLogger();

/**
 * Legacy Logger class for static access to appLogger.
 * @deprecated Use appLogger directly where possible.
 */
export class Logger {
    /**
     * Initializes the static logger.
     * @param logDir - The log directory.
     */
    static init(logDir?: string) {
        appLogger.init(logDir);
    }
    /**
     * Sets the static logger level.
     * @param level - The log level.
     */
    static setLevel(level: LogLevel) {
        appLogger.setLevel(level);
    }
    /**
     * Logs a debug message statically.
     * @param context - Context name.
     * @param message - Log message.
     * @param data - Optional data.
     */
    static debug(context: string, message: string, data?: JsonValue | Error | AppError) {
        appLogger.debug(context, message, data);
    }
    /**
     * Logs an info message statically.
     * @param context - Context name.
     * @param message - Log message.
     * @param data - Optional data.
     */
    static info(context: string, message: string, data?: JsonValue | Error | AppError) {
        appLogger.info(context, message, data);
    }
    /**
     * Logs a warning message statically.
     * @param context - Context name.
     * @param message - Log message.
     * @param data - Optional data.
     */
    static warn(context: string, message: string, data?: JsonValue | Error | AppError) {
        appLogger.warn(context, message, data);
    }
    /**
     * Logs an error message statically.
     * @param context - Context name.
     * @param message - Log message.
     * @param data - Optional data.
     */
    static error(context: string, message: string, data?: JsonValue | Error | AppError) {
        appLogger.error(context, message, data);
    }
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
        data: payload.data !== undefined ? formatValueForJson(payload.data) : undefined,
    };
    return JSON.stringify(entry) + '\n';
}

function formatValueForJson(value: JsonValue | Error | AppError | object): JsonValue {
    if (value instanceof Error) {
        return {
            error: value.message,
            stack: value.stack,
        };
    }
    if (
        value &&
        typeof value === 'object' &&
        'message' in value &&
        ('code' in value || 'stack' in value)
    ) {
        const ae = value as AppError;
        return {
            message: ae.message,
            code: ae.code,
            stack: ae.stack,
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
        if (value.code) {
            res = `[${value.code}] ${res}`;
        }
        if (value.stack) {
            res = `${res} | ${value.stack}`;
        }
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
    return (
        value !== null &&
        typeof value === 'object' &&
        'message' in value &&
        ('code' in value || 'stack' in value)
    );
}

function sanitize(message: string): string {
    return String(message).replace(/\r?\n/g, '\\n');
}

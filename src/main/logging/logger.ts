/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/* eslint-disable no-console */
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import * as zlib from 'zlib';

import { AppError, JsonValue } from '@shared/types/common';
import { app } from 'electron';

export enum LogLevel {
    TRACE = -1,
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    FATAL = 4,
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
    data?: RuntimeValue;
    /** Optional timestamp */
    timestamp?: string;
};

const MAX_FILES_UPPER_BOUND = 100;

const DEFAULT_CONFIG: LoggerConfig = {
    maxBytes: 10 * 1024 * 1024, // 10 MB
    maxFiles: 5,
    compressRotated: true,
    jsonFormat: true,
    retentionDays: 30,
};

class AppLogger {
    private logDir = '';
    private logPath = '';
    private size = 0;
    private initialized = false;
    private showDebugLogs = false;
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

    private isBrokenPipeError<T>(error: T): boolean {
        if (!error || typeof error !== 'object') {
            return false;
        }
        const maybeCode = 'code' in error ? (error as { code?: string }).code : undefined;
        const maybeMessage = 'message' in error ? String((error as { message?: RuntimeValue }).message ?? '') : '';
        return maybeCode === 'EPIPE' || maybeMessage.toLowerCase().includes('broken pipe');
    }

    private safeConsoleCall(method: 'debug' | 'info' | 'log' | 'warn' | 'error', ...args: RuntimeValue[]) {
        const original = this.originalConsole?.[method];
        if (!original) {
            return;
        }
        try {
            (original as (...items: RuntimeValue[]) => void)(...args);
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

        // Organize logs by day and separate by session to avoid log mixture
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const timeStr = now.toLocaleTimeString('en-GB', { hour12: false }).replace(/:/g, '-'); // HH-mm-ss

        const dayDir = path.join(this.logDir, dateStr);
        // Sync I/O required: logger bootstrap must complete before any log calls
        if (!fs.existsSync(dayDir)) {
            fs.mkdirSync(dayDir, { recursive: true, mode: 0o700 });
        }

        // Unique log file for this individual application run
        this.logPath = path.join(dayDir, `session-${timeStr}-${process.pid}.log`);

        this.size = 0;
        this.initialized = true;

        // Start cleanup scheduler (runs every 24 hours)
        this.startCleanupScheduler();

        this.info('Logger', `Logger initialized for session at ${this.logPath} (Level: ${LogLevel[this.currentLevel]})`);
    }

    /**
     * Logs a trace message (very verbose).
     * @param context - The context or service name.
     * @param message - The log message.
     * @param data - Optional metadata or error.
     */
    trace<T>(context: string, message: string, data?: T) {
        if (this.currentLevel <= LogLevel.TRACE) {
            this.write({ level: LogLevel.TRACE, message, context, data: data as RuntimeValue });
        }
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
     * Returns whether debug logs are shown.
     * @returns Whether debug logs are shown.
     */
    getShowDebugLogs(): boolean {
        return this.showDebugLogs;
    }

    /**
     * Sets whether debug logs are shown.
     * @param showDebugLogs - Whether to show debug logs.
     */
    setShowDebugLogs(showDebugLogs: boolean) {
        this.showDebugLogs = showDebugLogs;
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

        if (this.showDebugLogs) {
            console.debug = (...args: Array<JsonValue | Error | object>) => {
                this.debug('console', formatArgs(args));
                this.safeConsoleCall('debug', ...args);
            };
        }
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
    debug<T>(context: string, message: string, data?: T) {
        if (this.currentLevel <= LogLevel.DEBUG && this.showDebugLogs) {
            this.write({ level: LogLevel.DEBUG, message, context, data: data as RuntimeValue });
        }
    }

    /**
     * Logs an info message.
     * @param context - The context or service name.
     * @param message - The log message.
     * @param data - Optional metadata or error.
     */
    info<T>(context: string, message: string, data?: T) {
        if (this.currentLevel <= LogLevel.INFO) {
            this.write({ level: LogLevel.INFO, message, context, data: data as RuntimeValue });
        }
    }

    /**
     * Logs a warning message.
     * @param context - The context or service name.
     * @param message - The log message.
     * @param data - Optional metadata or error.
     */
    warn<T>(context: string, message: string, data?: T) {
        if (this.currentLevel <= LogLevel.WARN) {
            this.write({ level: LogLevel.WARN, message, context, data: data as RuntimeValue });
        }
    }

    /**
     * Logs an error message.
     * @param context - The context or service name.
     * @param message - The log message.
     * @param data - Optional metadata or error.
     */
    error<T>(context: string, message: string, data?: T) {
        if (this.currentLevel <= LogLevel.ERROR) {
            this.write({ level: LogLevel.ERROR, message, context, data: data as RuntimeValue });
        }
    }

    /**
     * Logs a fatal message.
     * @param context - The context or service name.
     * @param message - The log message.
     * @param data - Optional metadata or error.
     */
    fatal<T>(context: string, message: string, data?: T) {
        if (this.currentLevel <= LogLevel.FATAL) {
            this.write({ level: LogLevel.FATAL, message, context, data: data as RuntimeValue });
        }
    }

    /**
     * Ingests a pre-formatted log payload from an external process.
     * @param payload - The log payload to ingest.
     */
    ingest(payload: Partial<LogPayload> & { message: string; context: string }) {
        const level = payload.level ?? LogLevel.INFO;
        if (this.currentLevel <= level) {
            this.write({
                level,
                message: payload.message,
                context: payload.context,
                data: payload.data,
                timestamp: payload.timestamp
            });
        }
    }

    private sampleCounters = new Map<string, number>();
    private readonly NOISY_CONTEXTS = new Set([
        'TerminalService', 'FileWatcherService', 
        'code-intelligence.service', 'AdvancedMemoryService', 'WorkspaceService'
    ]);

    private write(payload: LogPayload) {
        if (!this.initialized) {
            this.init();
        }

        // Sampling for very noisy contexts in production environments to reduce CPU+I/O load
        const isProd = process.env.NODE_ENV !== 'development';
        if (isProd && payload.level <= LogLevel.INFO && this.NOISY_CONTEXTS.has(payload.context)) {
            const currentCount = (this.sampleCounters.get(payload.context) ?? 0) + 1;
            this.sampleCounters.set(payload.context, currentCount);
            
            // Only log 1 out of every 20 info/debug messages for these noisy contexts in production
            if (currentCount % 20 !== 0) {
                return;
            }
        }

        const line = this.config.jsonFormat ? formatLineJson(payload) : formatLine(payload);

        // Console Output (with enhanced visibility and local timestamps)
        if (this.originalConsole) {
            const color = getLevelColor(payload.level);
            const icon = getLevelIcon(payload.level);
            const reset = '\x1b[0m';
            const dim = '\x1b[2m';
            const cyan = '\x1b[36m';
            const bold = '\x1b[1m';
            
            const levelStr = LogLevel[payload.level].padEnd(5);
            const contextStr = payload.context.padEnd(20);

            // Time: HH:mm:ss.SSS (Local)
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-GB', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            }) + '.' + now.getMilliseconds().toString().padStart(3, '0');

            // Header line
            let consoleMsg = `${dim}${timeStr}${reset} ${color}${bold}${icon} ${levelStr}${reset} ${cyan}[${contextStr}]${reset} ${payload.message}`;

            if (payload.data !== undefined) {
                const isErr = payload.data instanceof Error || isAppError(payload.data);

                if (isErr) {
                    const formattedError = util.inspect(payload.data, {
                        colors: true,
                        depth: 5,
                        breakLength: 80,
                    });
                    // Indent stack traces
                    consoleMsg += `\n${formattedError.split('\n').map(l => '      ' + l).join('\n')}`;
                } else if (typeof payload.data === 'object' && payload.data !== null) {
                    const formattedData = util.inspect(payload.data, {
                        colors: true,
                        depth: 4,
                        compact: false,
                        breakLength: 80,
                        showHidden: false,
                    });
                    // Indent JSON-like data
                    consoleMsg += `\n${formattedData.split('\n').map(l => '      ' + l).join('\n')}`;
                } else {
                    consoleMsg += ` ${dim}|${reset} ${dim}data:${reset} ${String(payload.data)}`;
                }
            }

            if (payload.level >= LogLevel.ERROR) {
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
                try {
                    await fs.promises.access(src, fs.constants.F_OK);
                    await fs.promises.rename(src, dest);
                } catch { /* file doesn't exist, skip */ }
            }
            // Compress the current .1 file if it exists
            const firstRotated = `${this.logPath}.1`;
            try {
                await fs.promises.access(firstRotated, fs.constants.F_OK);
                await this.compressFile(firstRotated, `${firstRotated}.gz`);
                await fs.promises.unlink(firstRotated);
            } catch { /* file doesn't exist, skip */ }
        } else {
            for (let i = maxFiles - 1; i >= 1; i--) {
                const src = `${this.logPath}.${i}`;
                const dest = `${this.logPath}.${i + 1}`;
                try {
                    await fs.promises.access(src, fs.constants.F_OK);
                    await fs.promises.rename(src, dest);
                } catch { /* file doesn't exist, skip */ }
            }
        }

        try {
            await fs.promises.access(this.logPath, fs.constants.F_OK);
            await fs.promises.rename(this.logPath, `${this.logPath}.1`);
        } catch { /* file doesn't exist, skip */ }
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
            // Recursive scan to handle partitioned YYYY-MM-DD directories
            const scan = async (dir: string) => {
                const entries = await fs.promises.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        await scan(fullPath);
                        // Clean up empty day directories
                        const subEntries = await fs.promises.readdir(fullPath);
                        if (subEntries.length === 0) {
                            await fs.promises.rmdir(fullPath);
                        }
                    } else if (this.isLogFile(entry.name)) {
                        const stat = await fs.promises.stat(fullPath);
                        if (now - stat.mtime.getTime() > retentionMs) {
                            await fs.promises.unlink(fullPath);
                            deleted++;
                        }
                    }
                }
            };
            await scan(this.logDir);
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
    /** @deprecated Sync fallback kept for backward compatibility; prefer cleanupOldLogsAsync */
    cleanupOldLogs(): number {
        // Sync I/O acceptable: legacy public API, called rarely (manual invocation only)
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
        // Sync I/O acceptable: on-demand diagnostics method, not called in hot paths
        if (!this.logDir || !fs.existsSync(this.logDir)) {
            return { totalFiles: 0, totalSize: 0, oldestLog: null, newestLog: null };
        }

        const stats = { totalFiles: 0, totalSize: 0, oldestLog: null as Date | null, newestLog: null as Date | null };

        try {
            const scan = (dir: string) => {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        scan(fullPath);
                    } else if (this.isLogFile(entry.name)) {
                        const stat = fs.statSync(fullPath);
                        stats.totalFiles++;
                        stats.totalSize += stat.size;
                        if (!stats.oldestLog || stat.mtime < stats.oldestLog) {
                            stats.oldestLog = stat.mtime;
                        }
                        if (!stats.newestLog || stat.mtime > stats.newestLog) {
                            stats.newestLog = stat.mtime;
                        }
                    }
                }
            };
            scan(this.logDir);
        } catch {
            // ignore
        }

        return stats;
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

}

function getLevelColor(level: LogLevel): string {
    switch (level) {
        case LogLevel.TRACE:
            return '\x1b[90m'; // Grey
        case LogLevel.DEBUG:
            return '\x1b[35m'; // Magenta
        case LogLevel.INFO:
            return '\x1b[32m'; // Green
        case LogLevel.WARN:
            return '\x1b[33m'; // Yellow
        case LogLevel.ERROR:
            return '\x1b[31m'; // Red
        case LogLevel.FATAL:
            return '\x1b[41m\x1b[37m'; // Red Background, White Text
        default:
            return '';
    }
}

function getLevelIcon(level: LogLevel): string {
    switch (level) {
        case LogLevel.TRACE:
            return '[T]';
        case LogLevel.DEBUG:
            return '[D]';
        case LogLevel.INFO:
            return '[I]';
        case LogLevel.WARN:
            return '[W]';
        case LogLevel.ERROR:
            return '[E]';
        case LogLevel.FATAL:
            return '[F]';
        default:
            return '[ ]';
    }
}

/**
 * Maps a string level to LogLevel enum.
 */
export function stringToLogLevel(level: string): LogLevel {
    const uc = level.toUpperCase();
    switch (uc) {
        case 'TRACE': return LogLevel.TRACE;
        case 'DEBUG': return LogLevel.DEBUG;
        case 'INFO': return LogLevel.INFO;
        case 'WARN':
        case 'WARNING': return LogLevel.WARN;
        case 'ERROR': return LogLevel.ERROR;
        case 'FATAL': return LogLevel.FATAL;
        default: return LogLevel.INFO;
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
    static debug<T>(context: string, message: string, data?: T) {
        appLogger.debug(context, message, data);
    }
    /**
     * Logs an info message statically.
     * @param context - Context name.
     * @param message - Log message.
     * @param data - Optional data.
     */
    static info<T>(context: string, message: string, data?: T) {
        appLogger.info(context, message, data);
    }
    /**
     * Logs a warning message statically.
     * @param context - Context name.
     * @param message - Log message.
     * @param data - Optional data.
     */
    static warn<T>(context: string, message: string, data?: T) {
        appLogger.warn(context, message, data);
    }
    /**
     * Logs an error message statically.
     * @param context - Context name.
     * @param message - Log message.
     * @param data - Optional data.
     */
    static error<T>(context: string, message: string, data?: T) {
        appLogger.error(context, message, data);
    }
    /**
     * Logs a fatal message statically.
     * @param context - Context name.
     * @param message - Log message.
     * @param data - Optional data.
     */
    static fatal<T>(context: string, message: string, data?: T) {
        appLogger.fatal(context, message, data);
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

function formatValueForJson(value: RuntimeValue): JsonValue {
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
    if (value === undefined || typeof value === 'symbol' || typeof value === 'bigint') {
        return String(value);
    }
    return value as JsonValue;
}

function formatArgs(args: RuntimeValue[]): string {
    return args.map(formatValue).join(' ');
}

function formatValue(value: RuntimeValue): string {
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
    if (typeof value === 'symbol' || typeof value === 'bigint') {
        return String(value);
    }

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function isAppError(value: RuntimeValue): value is AppError {
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


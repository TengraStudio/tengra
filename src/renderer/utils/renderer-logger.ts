/**
 * Renderer-safe logger that doesn't use Node.js APIs.
 * Logs to console and can optionally send logs to main process via IPC.
 */

export enum LogLevel {
    TRACE = -1,
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    FATAL = 4,
}

type LogData = string | number | boolean | object | null | undefined | Error;

class RendererLogger {
    private currentLevel: LogLevel = LogLevel.INFO;
    private readonly electronLevelMethod: Record<LogLevel, 'debug' | 'info' | 'warn' | 'error'> = {
        [LogLevel.TRACE]: 'debug',
        [LogLevel.DEBUG]: 'debug',
        [LogLevel.INFO]: 'info',
        [LogLevel.WARN]: 'warn',
        [LogLevel.ERROR]: 'error',
        [LogLevel.FATAL]: 'error'
    };

    setLevel(level: LogLevel): void {
        this.currentLevel = level;
    }

    getLevel(): LogLevel {
        return this.currentLevel;
    }

    trace(context: string, message: string, data?: LogData): void {
        if (this.currentLevel <= LogLevel.TRACE) {
            this.log(LogLevel.TRACE, context, message, data);
        }
    }

    debug(context: string, message: string, data?: LogData): void {
        if (this.currentLevel <= LogLevel.DEBUG) {
            this.log(LogLevel.DEBUG, context, message, data);
        }
    }

    info(context: string, message: string, data?: LogData): void {
        if (this.currentLevel <= LogLevel.INFO) {
            this.log(LogLevel.INFO, context, message, data);
        }
    }

    warn(context: string, message: string, data?: LogData): void {
        if (this.currentLevel <= LogLevel.WARN) {
            this.log(LogLevel.WARN, context, message, data);
        }
    }

    error(context: string, message: string, data?: LogData): void {
        if (this.currentLevel <= LogLevel.ERROR) {
            this.log(LogLevel.ERROR, context, message, data);
        }
    }

    fatal(context: string, message: string, data?: LogData): void {
        if (this.currentLevel <= LogLevel.FATAL) {
            this.log(LogLevel.FATAL, context, message, data);
        }
    }

    private log(level: LogLevel, context: string, message: string, data?: LogData): void {
        const timestamp = new Date().toISOString();
        const levelStr = LogLevel[level];
        const formattedMessage = `[${timestamp}] [${levelStr}] [${context}] ${message}`;

        if (this.tryElectronLog(level, context, message, data)) { return; }

        const consoleMethod = this.getConsoleMethod(level);
        if (data !== undefined) {
            consoleMethod(formattedMessage, data);
        } else {
            consoleMethod(formattedMessage);
        }
    }

    private tryElectronLog(level: LogLevel, context: string, message: string, data?: LogData): boolean {
        const electronLog = window.electron?.log;
        if (!electronLog) { return false; }

        const method = this.electronLevelMethod[level] ?? 'info';
        const logMethod = electronLog[method];
        if (typeof logMethod !== 'function') {
            return false;
        }
        if (data !== undefined) {
            logMethod(message, data, context);
        } else {
            logMethod(message, undefined, context);
        }
        return true;
    }

    private getConsoleMethod(level: LogLevel): (...args: RendererDataValue[]) => void {
        switch (level) {
            case LogLevel.TRACE:
                return console.warn.bind(console);
            case LogLevel.DEBUG:
                return console.warn.bind(console);
            case LogLevel.INFO:
                return console.warn.bind(console);
            case LogLevel.WARN:
                return console.warn.bind(console);
            case LogLevel.ERROR:
                return console.error.bind(console);
            case LogLevel.FATAL:
                return console.error.bind(console);
            default:
                return console.warn.bind(console);
        }
    }
}

export const appLogger = new RendererLogger();

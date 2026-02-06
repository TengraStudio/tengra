/**
 * Renderer-safe logger that doesn't use Node.js APIs.
 * Logs to console and can optionally send logs to main process via IPC.
 */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

type LogData = string | number | boolean | object | null | undefined | Error;

class RendererLogger {
    private currentLevel: LogLevel = LogLevel.INFO;

    setLevel(level: LogLevel): void {
        this.currentLevel = level;
    }

    getLevel(): LogLevel {
        return this.currentLevel;
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

    private log(level: LogLevel, context: string, message: string, data?: LogData): void {
        const timestamp = new Date().toISOString();
        const levelStr = LogLevel[level];
        const formattedMessage = `[${timestamp}] [${levelStr}] [${context}] ${message}`;

        const consoleMethod = this.getConsoleMethod(level);
        if (data !== undefined) {
            consoleMethod(formattedMessage, data);
        } else {
            consoleMethod(formattedMessage);
        }
    }

    private getConsoleMethod(level: LogLevel): (...args: unknown[]) => void {
        switch (level) {
            case LogLevel.DEBUG:
                return console.debug.bind(console);
            case LogLevel.INFO:
                return console.info.bind(console);
            case LogLevel.WARN:
                return console.warn.bind(console);
            case LogLevel.ERROR:
                return console.error.bind(console);
            default:
                return console.log.bind(console);
        }
    }
}

export const appLogger = new RendererLogger();

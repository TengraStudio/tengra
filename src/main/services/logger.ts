
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

export class Logger {
    private static level: LogLevel = LogLevel.INFO

    static setLevel(level: LogLevel) {
        this.level = level
    }

    static debug(context: string, message: string, ...args: any[]) {
        if (this.level <= LogLevel.DEBUG) {
            console.debug(`[DEBUG] [${context}] ${message}`, ...args)
        }
    }

    static info(context: string, message: string, ...args: any[]) {
        if (this.level <= LogLevel.INFO) {
            console.info(`[INFO] [${context}] ${message}`, ...args)
        }
    }

    static warn(context: string, message: string, ...args: any[]) {
        if (this.level <= LogLevel.WARN) {
            console.warn(`[WARN] [${context}] ${message}`, ...args)
        }
    }

    static error(context: string, message: string, ...args: any[]) {
        if (this.level <= LogLevel.ERROR) {
            console.error(`[ERROR] [${context}] ${message}`, ...args)
        }
    }
}

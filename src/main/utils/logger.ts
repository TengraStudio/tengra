import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export class Logger {
    private static logFile: string;

    static init(logDir?: string) {
        if (logDir) {
            this.logFile = path.join(logDir, 'orbit.log');
        } else if (app) {
            const userData = app.getPath('userData');
            this.logFile = path.join(userData, 'orbit.log');
        }
    }

    private static format(level: LogLevel, message: string, meta?: any): string {
        const timestamp = new Date().toISOString();
        const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] [${level}] ${message}${metaStr}\n`;
    }

    static info(message: string, meta?: any) {
        this.log('INFO', message, meta);
    }

    static warn(message: string, meta?: any) {
        this.log('WARN', message, meta);
    }

    static error(message: string, meta?: any) {
        this.log('ERROR', message, meta);
    }

    static debug(message: string, meta?: any) {
        if (process.env.DEBUG) {
            this.log('DEBUG', message, meta);
        }
    }

    private static log(level: LogLevel, message: string, meta?: any) {
        const line = this.format(level, message, meta);
        console.log(line.trim());
        if (this.logFile) {
            fs.appendFile(this.logFile, line, (err) => {
                if (err) console.error('Failed to write to log file', err);
            });
        }
    }
}

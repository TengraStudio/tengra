import * as fs from 'fs';
import * as path from 'path';

import { JsonValue } from '@shared/types/common';
import { app } from 'electron';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export class Logger {
    private static logFile: string;

    static init(logDir?: string) {
        const userData = app.getPath('userData');
        const targetDir = logDir ?? userData;
        this.logFile = path.join(targetDir, 'Tandem.log');
    }

    private static format(level: LogLevel, message: string, meta?: JsonValue): string {
        const timestamp = new Date().toISOString();
        const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] [${level}] ${message}${metaStr}\n`;
    }

    static info(message: string, meta?: JsonValue) {
        this.log('INFO', message, meta);
    }

    static warn(message: string, meta?: JsonValue) {
        this.log('WARN', message, meta);
    }

    static error(message: string, meta?: JsonValue) {
        this.log('ERROR', message, meta);
    }

    static debug(message: string, meta?: JsonValue) {
        if (process.env.DEBUG) {
            this.log('DEBUG', message, meta);
        }
    }

    private static log(level: LogLevel, message: string, meta?: JsonValue) {
        const line = this.format(level, message, meta);
        console.warn(line.trim());
        if (this.logFile) {
            fs.appendFile(this.logFile, line, (err) => {
                if (err) {console.error('Failed to write to log file', err);}
            });
        }
    }
}


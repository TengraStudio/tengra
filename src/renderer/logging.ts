import { JsonValue } from '@shared/types/common';

let installed = false;

type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type LogValue = JsonValue | Error | object

export function installRendererLogger() {
    if (installed) {return;}
    installed = true;

    const logger = window.electron.log;
    if (!('log' in window.electron)) {return;}

    const original = {
        // eslint-disable-next-line no-console
        debug: console.debug.bind(console),
        // eslint-disable-next-line no-console
        info: console.info.bind(console),
        // eslint-disable-next-line no-console
        log: console.log.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console)
    };

    const send = (level: LogLevel, args: LogValue[]) => {
        // Temporarily sending all logs to main for debugging
        // if (level === 'error' || level === 'warn') {
        const message = formatArgs(args);
        logger.write(level, message);
        // }
    };

    // eslint-disable-next-line no-console
    console.debug = (...args: LogValue[]) => {
        original.debug(...args);
        send('debug', args);
    };
    // eslint-disable-next-line no-console
    console.log = (...args: LogValue[]) => {
        original.log(...args);
        send('info', args);
    };
    // eslint-disable-next-line no-console
    console.info = (...args: LogValue[]) => {
        original.info(...args);
        send('info', args);
    };
    console.warn = (...args: LogValue[]) => {
        original.warn(...args);
        send('warn', args);
    };
    console.error = (...args: LogValue[]) => {
        original.error(...args);
        send('error', args);
        if (typeof args[0] === 'string' && args[0].includes('React error #185')) {
            const raw = args
                .map(arg => {
                    if (typeof arg === 'string') {
                        return arg;
                    }
                    if (arg instanceof Error) {
                        return arg.stack ?? arg.message;
                    }
                    try {
                        return JSON.stringify(arg);
                    } catch {
                        return String(arg);
                    }
                })
                .join(' | ');
            logger.write('error', `react185 details=${raw}`);
        }
    };

    window.addEventListener('error', (event) => {
        const error = event.error instanceof Error ? event.error : null;
        const parts = [
            `message=${event.message}`,
            `file=${event.filename}`,
            `line=${event.lineno}`,
            `col=${event.colno}`,
            `stack=${error?.stack ?? 'n/a'}`
        ];
        logger.write('error', `window error ${parts.join(' | ')}`);
    });

    window.addEventListener('unhandledrejection', (event) => {
        logger.write('error', `unhandledrejection reason=${formatValue(event.reason)}`);
    });
}

function formatArgs(args: LogValue[]): string {
    return args.map(formatValue).join(' ');
}

function formatValue(value: LogValue): string {
    if (value instanceof Error) {
        return value.stack ? `${value.message} | ${value.stack}` : value.message;
    }
    if (typeof value === 'string') {
        return value;
    }
    // DO NOT JSON.stringify in the renderer's hot path for regular logs.
    // This is extremely expensive and blocks the main thread.
    // If it's an object and we really need it in the main log, 
    // we should only do it for errors/warnings or specific whitelisted cases.
    return '[Object]';
}

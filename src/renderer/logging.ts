import { JsonValue } from '@shared/types/common';

interface RendererLoggingWindow extends Window {
    __tengraRendererLoggerInstalled__?: boolean;
    __tengraRendererWindowErrorHandler__?: (event: ErrorEvent) => void;
    __tengraRendererUnhandledRejectionHandler__?: (event: PromiseRejectionEvent) => void;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type LogValue = JsonValue | Error | object

export function installRendererLogger() {
    const loggingWindow = window as RendererLoggingWindow;
    if (loggingWindow.__tengraRendererLoggerInstalled__ === true) {return;}
    loggingWindow.__tengraRendererLoggerInstalled__ = true;

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

    const isProd = import.meta?.env?.PROD === true;

    const send = (level: LogLevel, args: LogValue[]) => {
        // In production, only forward errors and warnings to main via IPC
        // to avoid excessive IPC round-trips for verbose log levels.
        if (isProd && level !== 'error' && level !== 'warn') {
            return;
        }
        const message = formatArgs(args);
        logger.write(level, message);
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

    const onWindowError = (event: ErrorEvent): void => {
        const error = event.error instanceof Error ? event.error : null;
        const parts = [
            `message=${event.message}`,
            `file=${event.filename}`,
            `line=${event.lineno}`,
            `col=${event.colno}`,
            `stack=${error?.stack ?? 'n/a'}`
        ];
        logger.write('error', `window error ${parts.join(' | ')}`);
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent): void => {
        logger.write('error', `unhandledrejection reason=${formatValue(event.reason)}`);
    };

    if (loggingWindow.__tengraRendererWindowErrorHandler__) {
        window.removeEventListener('error', loggingWindow.__tengraRendererWindowErrorHandler__);
    }
    if (loggingWindow.__tengraRendererUnhandledRejectionHandler__) {
        window.removeEventListener('unhandledrejection', loggingWindow.__tengraRendererUnhandledRejectionHandler__);
    }

    loggingWindow.__tengraRendererWindowErrorHandler__ = onWindowError;
    loggingWindow.__tengraRendererUnhandledRejectionHandler__ = onUnhandledRejection;

    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
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

/**
 * SEC-H-001: Navigation security utilities for Electron BrowserWindows.
 * Restricts navigation and new-window requests to trusted origins only.
 * @module navigation-security.util
 */
import { appLogger } from '@main/logging/logger';
import { app, BrowserWindow, HandlerDetails, shell } from 'electron';

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['https:', 'http:', 'mailto:']);

const SENSITIVE_QUERY_KEYS = new Set([
    'token', 'access_token', 'refresh_token', 'code', 'state', 'sessionkey', 'session_key',
    'apikey', 'api_key', 'authorization', 'password', 'passphrase'
]);

/**
 * Redacts sensitive query parameters from a URL for safe logging.
 * @param rawUrl - The URL to redact
 * @returns Redacted URL string safe for logging
 */
export function redactUrlForLogs(rawUrl: string): string {
    try {
        const parsed = new URL(rawUrl);
        for (const key of parsed.searchParams.keys()) {
            if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
                parsed.searchParams.set(key, '[REDACTED]');
            }
        }
        return parsed.toString();
    } catch {
        return rawUrl;
    }
}

/**
 * Checks whether a URL is a trusted local origin (app's own renderer).
 * @param url - The URL to check
 * @returns True if the URL is a trusted local origin
 */
export function isTrustedLocalOrigin(url: string): boolean {
    const isDev = !app.isPackaged;
    const rendererUrl = process.env['ELECTRON_RENDERER_URL'];

    if (isDev && rendererUrl) {
        return url.startsWith(rendererUrl);
    }
    return url.startsWith('file://');
}

/**
 * Checks whether a URL matches a trusted OAuth callback origin (localhost).
 * @param url - The URL to check
 * @returns True if the URL is a trusted OAuth callback
 */
export function isTrustedOAuthCallback(url: string): boolean {
    try {
        const parsed = new URL(url);
        const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
        return isLocalhost && parsed.pathname === '/callback';
    } catch {
        return false;
    }
}

/**
 * Checks whether a URL should be allowed for in-window navigation.
 * Trusted origins: app's own renderer, safe-file: protocol, OAuth callbacks.
 * @param url - The URL to validate
 * @returns True if navigation should be allowed
 */
export function isAllowedNavigation(url: string): boolean {
    if (isTrustedLocalOrigin(url)) {
        return true;
    }
    try {
        const parsed = new URL(url);
        if (parsed.protocol === 'safe-file:') {
            return true;
        }
    } catch {
        return false;
    }
    return isTrustedOAuthCallback(url);
}

/**
 * Attaches will-navigate and setWindowOpenHandler restrictions to a BrowserWindow.
 * Blocks navigation to untrusted origins and prevents arbitrary popup windows.
 * @param win - The BrowserWindow to harden
 * @param label - A short label for log messages identifying the window
 */
export function enforceNavigationRestrictions(win: BrowserWindow, label: string): void {
    // Restrict in-window navigation
    win.webContents.on('will-navigate', (event, url) => {
        if (!isAllowedNavigation(url)) {
            appLogger.warn('Security', `[${label}] Blocked navigation to: ${redactUrlForLogs(url)}`);
            event.preventDefault();
        }
    });

    // Prevent new-window / popup requests; delegate safe external URLs to shell
    win.webContents.setWindowOpenHandler((details: HandlerDetails) => {
        try {
            const parsed = new URL(details.url);
            if (ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
                void shell.openExternal(parsed.toString());
            } else {
                appLogger.warn(
                    'Security',
                    `[${label}] Blocked external protocol: ${parsed.protocol} (${redactUrlForLogs(details.url)})`
                );
            }
        } catch (error) {
            appLogger.warn(
                'Security',
                `[${label}] Blocked invalid URL in open handler: ${redactUrlForLogs(details.url)} (${String(error)})`
            );
        }
        return { action: 'deny' as const };
    });
}

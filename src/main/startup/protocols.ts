/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import path from 'path';

import { appLogger } from '@main/logging/logger';
import { protocol } from 'electron';

/**
 * Pre-register protocols before app is ready
 */
export const preRegisterProtocols = (): void => {
    protocol.registerSchemesAsPrivileged([
        {
            scheme: 'safe-file',
            privileges: {
                standard: true,
                secure: true,
                supportFetchAPI: true,
                bypassCSP: true,
                stream: true,
            },
        },
    ]);
};

/**
 * Register custom protocols for the application
 */
export const registerProtocols = (allowedFileRoots: Set<string>): void => {
    const decodeSafeFileUrlComponent = (value: string): string => {
        try {
            return decodeURIComponent(value);
        } catch {
            return value;
        }
    };

    const resolveSafeFilePath = (requestUrl: string): string => {
        const withoutFragment = requestUrl.split('#')[0] ?? requestUrl;
        const withoutQuery = withoutFragment.split('?')[0] ?? withoutFragment;
        
        try {
            const parsed = new URL(withoutQuery);
            const decodedHost = decodeSafeFileUrlComponent(parsed.hostname);
            const decodedPathname = decodeSafeFileUrlComponent(parsed.pathname);

            if (process.platform === 'win32') {
                // Case 1: safe-file:///C:/Users/... (Hostname is empty, pathname starts with /C:/)
                const winPathMatch = decodedPathname.match(/^\/([A-Za-z]):[\\/](.*)/);
                if (winPathMatch) {
                    const driveLetter = winPathMatch[1].toUpperCase();
                    const relativePath = winPathMatch[2].replace(/\//g, '\\');
                    return path.normalize(`${driveLetter}:\\${relativePath}`);
                }

                // Case 2: safe-file://C/Users/... (Browser might normalize C: to host)
                if (/^[A-Za-z]$/.test(decodedHost)) {
                    const driveRoot = `${decodedHost.toUpperCase()}:\\`;
                    const relativePath = decodedPathname.replace(/^\/+/, '').replace(/\//g, '\\');
                    return path.normalize(path.join(driveRoot, relativePath));
                }

                // Case 3: Path already looks like an absolute Windows path after stripping protocol
                const trimmedPath = decodedPathname.replace(/^\/+/, '');
                if (/^[A-Za-z]:[\\/]/.test(trimmedPath)) {
                    return path.normalize(trimmedPath);
                }
            }

            // Fallback for Unix or other cases
            const combinedPath = decodedHost.length > 0
                ? `/${decodedHost}${decodedPathname}`
                : decodedPathname;
            return path.normalize(combinedPath);
        } catch {
            // Legacy/Fallback parsing for malformed URLs
            let legacyPath = withoutQuery.replace(/^safe-file:\/+/i, '');
            legacyPath = decodeSafeFileUrlComponent(legacyPath);

            if (process.platform === 'win32') {
                if (/^[A-Za-z]\//.test(legacyPath)) {
                    legacyPath = `${legacyPath[0]}:${legacyPath.slice(1)}`;
                }
                // Convert slashes to backslashes
                legacyPath = legacyPath.replace(/\//g, '\\');
            }

            return path.normalize(legacyPath);
        }
    };

    /**
     * Check if a path is within the allowed root directories
     */
    const isPathWithinRoot = (child: string, parent: string): boolean => {
        const relative = path.relative(parent, child);
        return !relative.startsWith('..') && !path.isAbsolute(relative);
    };

    /**
     * Check if a path is allowed based on the allowed roots
     */
    const isPathAllowed = (absolutePath: string): boolean => {
        const normalizedPath = path.resolve(absolutePath);
        return Array.from(allowedFileRoots).some(root => isPathWithinRoot(normalizedPath, root));
    };

    /**
     * safe-file:// protocol handler
     * Allows accessing files within specific allowed directories (like workspace folders)
     */
    const handleSafeFile = (request: Electron.ProtocolRequest, callback: (response: Electron.ProtocolResponse) => void) => {
        const absolutePath = resolveSafeFilePath(request.url);
        const allowed = isPathAllowed(absolutePath);

        if (!allowed) {
            appLogger.warn('Security', `Blocked file access via safe-file: ${absolutePath}. Allowed roots: ${Array.from(allowedFileRoots).join(', ')}`);
            callback({ error: -10 /* ACCESS_DENIED */ });
            return;
        }

        appLogger.debug('Security', `Allowing file access via safe-file: ${absolutePath}`);
        callback({ path: absolutePath });
    };

    // Register safe-file protocol
    protocol.registerFileProtocol('safe-file', handleSafeFile);

    appLogger.info('Protocols', 'Custom protocols registered');
};

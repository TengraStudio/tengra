import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { protocol } from 'electron';

/**
 * Pre-register protocols before app is ready.
 * MUST be called before app.whenReady()
 */
export function preRegisterProtocols() {
    // Guard for when running in Node.js context during build (vite-plugin-electron)
    if (typeof protocol.registerSchemesAsPrivileged === 'function') {
        protocol.registerSchemesAsPrivileged([
            { scheme: 'safe-file', privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true } }
        ]);
    }
}

/**
 * Register the actual protocol handlers after app is ready.
 */
export function registerProtocols(allowedFileRoots: Set<string>) {
    const isWindows = process.platform === 'win32';
    const normalizeForComparison = (candidatePath: string): string => {
        const resolvedPath = path.resolve(candidatePath);
        return isWindows ? resolvedPath.toLowerCase() : resolvedPath;
    };
    const isPathWithinRoot = (targetPath: string, rootPath: string): boolean => {
        const normalizedTargetPath = normalizeForComparison(targetPath);
        const normalizedRootPath = normalizeForComparison(rootPath);
        const relativePath = path.relative(normalizedRootPath, normalizedTargetPath);
        return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
    };

    const isPathAllowed = (absolutePath: string): boolean => {
        const normalizedPath = path.resolve(absolutePath);
        return Array.from(allowedFileRoots).some(root => isPathWithinRoot(normalizedPath, root));
    };

    protocol.registerFileProtocol('safe-file', (request, callback) => {
        let url = request.url.replace('safe-file://', '');

        // Handle Windows drive letters (e.g., /C:/Users -> C:/Users)
        if (process.platform === 'win32') {
            if (/^\/[a-zA-Z]:/.test(url)) {
                url = url.slice(1);
            } else if (/^[a-zA-Z]\//.test(url)) {
                url = url.substring(0, 1) + ':' + url.substring(1);
            }
        }

        const decoded = decodeURIComponent(url);
        const absolutePath = path.resolve(decoded);

        // Security check: Must be in allowed roots
        const allowed = isPathAllowed(absolutePath);

        if (!allowed) {
            appLogger.error('Security', `Denied attempt to access file outside allowed roots via protocol: ${absolutePath} `);
            return callback({ error: -6 }); // NET_ERROR(FILE_NOT_FOUND)
        }

        try {
            return callback(absolutePath);
        } catch (error) {
            appLogger.error('Main', `SAFE-FILE protocol error: ${error}`);
        }
    });
}

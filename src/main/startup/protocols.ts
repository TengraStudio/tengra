import { protocol } from 'electron';
import path from 'path';
import { appLogger } from '@main/logging/logger';

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
        let url = request.url.replace('safe-file://', '');

        // Remove query params and fragments
        url = url.split(/[?#]/)[0] ?? url;

        // Remove leading slashes
        while (url.startsWith('/')) {
            url = url.slice(1);
        }

        let decoded: string;
        try {
            decoded = decodeURIComponent(url);
        } catch (e) {
            decoded = url;
        }

        // On Windows, if we have /C:/..., remove the leading slash again after decoding
        if (process.platform === 'win32') {
            if (decoded.startsWith('/')) {
                decoded = decoded.slice(1);
            }
        }

        const absolutePath = path.normalize(decoded);
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

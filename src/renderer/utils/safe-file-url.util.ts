/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function normalizeSafeFilePath(inputPath: string): string {
    const trimmedPath = inputPath.trim();
    if (!trimmedPath) {
        return '';
    }

    // Pass through already valid or prefixed URLs
    if (/^(https?:|data:|blob:)/i.test(trimmedPath)) {
        return trimmedPath;
    }

    // If it's already a safe-file URL, check if it's a valid Windows path inside it
    if (/^safe-file:\/\//i.test(trimmedPath)) {
        // Fix common Windows path issues inside safe-file://
        // e.g. safe-file://c/Users -> safe-file:///c:/Users
        const inner = trimmedPath.replace(/^safe-file:\/+/i, '');
        if (/^[A-Za-z]\//.test(inner)) {
             return `safe-file:///${inner[0]}:/${inner.slice(2)}`;
        }
        return trimmedPath;
    }

    const normalizedSlashes = trimmedPath.replace(/\\/g, '/');
    
    // Windows absolute path: C:/...
    if (/^[A-Za-z]:\//.test(normalizedSlashes)) {
        // Use 3 slashes for absolute Windows paths: safe-file:///C:/...
        return `safe-file:///${encodeURI(normalizedSlashes)}`;
    }

    // Unix absolute path: /usr/...
    if (normalizedSlashes.startsWith('/')) {
        return `safe-file://${encodeURI(normalizedSlashes)}`;
    }

    // Fallback for other paths - assume they should be absolute-ish
    return `safe-file:///${encodeURI(normalizedSlashes)}`;
}

export function toSafeFileUrl(inputPath: string | null | undefined): string | null {
    if (typeof inputPath !== 'string') {
        return null;
    }

    const normalizedUrl = normalizeSafeFilePath(inputPath);
    return normalizedUrl.length > 0 ? normalizedUrl : null;
}


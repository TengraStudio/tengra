/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export interface DirectorySelectionResult {
    success: boolean;
    path?: string;
}

export function normalizeDirectorySelectionResult(
    value: DirectorySelectionResult | string | null | undefined
): DirectorySelectionResult {
    if (typeof value === 'string') {
        return value.trim().length > 0 ? { success: true, path: value } : { success: false };
    }

    if (!value) {
        return { success: false };
    }

    if (typeof value.path === 'string' && value.path.trim().length > 0) {
        return { success: true, path: value.path };
    }

    return { success: Boolean(value.success) };
}

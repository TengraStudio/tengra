/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export function sanitizeShellId(raw: RendererDataValue): string | null {
    if (typeof raw !== 'string') {
        return null;
    }
    const normalized = raw.trim();
    return normalized.length > 0 ? normalized : null;
}

export function sanitizeBackendId(raw: RendererDataValue): string | undefined {
    if (typeof raw !== 'string') {
        return undefined;
    }
    const normalized = raw.trim();
    return normalized.length > 0 ? normalized : undefined;
}


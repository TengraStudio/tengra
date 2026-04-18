/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const SUPPORTED_CODE_EDITOR_LANGUAGES = new Set([
    'json',
    'markdown',
    'html',
    'css',
    'python',
    'typescript',
    'javascript',
]);

export type CodeEditorErrorCode =
    | 'CODE_EDITOR_INVALID_LANGUAGE'
    | 'CODE_EDITOR_INIT_FAILED';

export function sanitizeCodeEditorLanguage(raw: RendererDataValue): string {
    if (typeof raw !== 'string') {
        return 'javascript';
    }
    const normalized = raw.trim().toLowerCase();
    if (!normalized) {
        return 'javascript';
    }
    return SUPPORTED_CODE_EDITOR_LANGUAGES.has(normalized) ? normalized : 'javascript';
}

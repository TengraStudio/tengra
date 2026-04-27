/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import fs from 'fs';
import path from 'path';

import { appLogger } from '@main/logging/logger';
import { LocalePack } from '@shared/types/locale';

let translations: LocalePack | null = null;

/**
 * Load translations from the locale file.
 * In production, this might need a different path or logic.
 */
function loadTranslations(): void {
    try {
        // This path might need adjustment based on build environment
        const localePath = path.join(__dirname, '../../renderer/i18n/locales/en.locale.json');
        if (fs.existsSync(localePath)) {
            const data = fs.readFileSync(localePath, 'utf8');
            translations = JSON.parse(data) as LocalePack;
        } else {
            appLogger.warn('BackendI18n', `Locale file not found at ${localePath}`);
        }
    } catch (error) {
        appLogger.error('BackendI18n', 'Failed to load translations', error as Error);
    }
}

/**
 * Simple t function for backend usage.
 * Resolves keys against the full en.locale.json structure.
 */
export function t(path: string, options?: Record<string, unknown>): string {

    if (!translations) {
        loadTranslations();
    }

    if (!translations) {
        return path;
    }

    const resolve = (p: string): string | null => {
        const parts = p.split('.');
        let current: unknown = translations;
        for (const part of parts) {
            if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
                current = (current as Record<string, unknown>)[part];
            } else {
                return null;
            }
        }
        return typeof current === 'string' ? current : null;
    };


    let translation: string | null = null;

    // Try auto-resolving with backend prefix first if it doesn't have one
    if (!path.startsWith('backend.') && !path.startsWith('frontend.') && !path.startsWith('common.')) {
        translation = resolve(`backend.${path}`);
        if (translation === null) {
            // Try common prefix as fallback
            translation = resolve(`common.${path}`);
        }
    }


    if (translation === null) {
        translation = resolve(path);
    }


    if (translation === null) {
        return path;
    }

    let result = translation;
    if (options) {
        Object.keys(options).forEach(key => {
            result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(options[key]));
        });
    }

    return result;
}


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
import { JsonValue } from '@shared/types/common';
import { LocalePack } from '@shared/types/locale';
import { app } from 'electron';

type TranslationTree = Record<string, JsonValue | undefined>;

let translations: TranslationTree | null = null;

function asTranslationTree(value: JsonValue | TranslationTree | null | undefined): TranslationTree | null {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as TranslationTree;
    }
    return null;
}

/**
 * Load translations from the locale file.
 * In production, this might need a different path or logic.
 */
function loadTranslations(): void {
    try {
        const appPath = app.getAppPath();
        
        const possiblePaths = [
            // User Data: Marketplace/Override location
            path.join(app.getPath('userData'), 'runtime/locales/en.locale.json'),
            // Production: Extra resources (from package.json extraResources)
            path.join(path.dirname(appPath), 'locales/en.locale.json'),
            // Production: Inside app.asar (legacy/fallback)
            path.join(appPath, 'dist/renderer/i18n/locales/en.locale.json'),
            path.join(appPath, 'renderer/i18n/locales/en.locale.json'),
            // Development: Relative to __dirname
            path.join(__dirname, '../../src/renderer/i18n/locales/en.locale.json'),
            path.join(__dirname, '../../../src/renderer/i18n/locales/en.locale.json'),
            // Portable/extracted fallbacks
            path.join(process.cwd(), 'resources/app.asar/dist/renderer/i18n/locales/en.locale.json'),
            path.join(process.cwd(), 'resources/locales/en.locale.json'),
            path.join(process.cwd(), 'dist/renderer/i18n/locales/en.locale.json'),
        ];

        let localePath = '';
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                localePath = p;
                break;
            }
        }

        if (localePath) {
            const data = fs.readFileSync(localePath, 'utf8');
            const localePack = JSON.parse(data) as LocalePack;
            const parsedTranslations = asTranslationTree(localePack.translations);
            translations = parsedTranslations ?? asTranslationTree(localePack as any);
            appLogger.debug('BackendI18n', `Translations loaded from ${localePath}`);
        } else {
            appLogger.warn('BackendI18n', `Locale file not found. Checked ${possiblePaths.length} locations. Last attempted: ${possiblePaths[0]}`);
        }
    } catch (error) {
        appLogger.error('BackendI18n', 'Failed to load translations', error as Error);
    }
}

/**
 * Simple t function for backend usage.
 * Resolves keys against the full en.locale.json structure.
 */
export function t(path: string, options?: Record<string, string | number>): string {

    if (!translations) {
        loadTranslations();
    }

    if (!translations) {
        return path;
    }

    const resolve = (p: string): string | null => {
        const parts = p.split('.');
        let current: JsonValue | TranslationTree | null | undefined = translations;
        for (const part of parts) {
            if (current && typeof current === 'object' && !Array.isArray(current) && part in current) {
                current = current[part];
            } else {
                return null;
            }
        }
        return typeof current === 'string' ? current : null;
    };


    let translation: string | null = null;
    const normalizedPath = path.startsWith('translations.') ? path.slice('translations.'.length) : path;
    const hasScopePrefix = normalizedPath.startsWith('backend.')
        || normalizedPath.startsWith('frontend.')
        || normalizedPath.startsWith('common.');

    // Resolve common keys first, then backend keys for unscoped requests.
    if (!hasScopePrefix) {
        translation = resolve(`common.${normalizedPath}`);
        if (translation === null) {
            translation = resolve(`backend.${normalizedPath}`);
        }
    }


    if (translation === null) {
        translation = resolve(normalizedPath);
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


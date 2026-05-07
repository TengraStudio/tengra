/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconDownload, IconGlobe } from '@tabler/icons-react';
import React, { useEffect, useMemo, useState } from 'react';

import type { Language } from '@/i18n';
import { useTranslation } from '@/i18n';
import { localeRegistry } from '@/i18n/locale-registry.service';
import { enLocalePack } from '@/i18n/locales';
import { cn } from '@/lib/utils';

/* Batch-02: Extracted Long Classes */
const C_TRANSLATIONEXPORT_1 = "inline-flex items-center gap-1.5 rounded-md border border-border/40 px-3 py-1.5 typo-caption hover:bg-muted/30 transition-colors";
const C_TRANSLATIONEXPORT_2 = "inline-flex items-center gap-1.5 rounded-md border border-border/40 px-3 py-1.5 typo-caption hover:bg-muted/30 transition-colors";


type TranslationObject = Record<string, RendererDataValue>;

const ALL_TRANSLATIONS: Record<Language, TranslationObject> = {
    en: enLocalePack.translations as TypeAssertionValue as TranslationObject,
};

const LANGUAGE_LABELS: Record<Language, string> = {
    en: 'English',
};

/** Flatten a nested object into dot-separated keys. */
function flattenKeys(obj: TranslationObject, prefix = ''): string[] {
    const keys: string[] = [];
    for (const key of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            keys.push(...flattenKeys(value as TranslationObject, fullKey));
        } else {
            keys.push(fullKey);
        }
    }
    return keys;
}

interface CoverageInfo {
    lang: Language;
    label: string;
    total: number;
    translated: number;
    percent: number;
}

/** Download a text blob as a file. */
function downloadBlob(content: string, filename: string, mime: string): void {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

/**
 * Settings section that shows translation coverage per language and
 * allows exporting all keys to JSON or CSV.
 */
export const TranslationExport: React.FC = () => {
    const { t } = useTranslation();
    const [availableLocalesVersion, setAvailableLocalesVersion] = useState(0);

    useEffect(() => {
        void localeRegistry.loadLocales();
        return localeRegistry.subscribe(() => {
            setAvailableLocalesVersion(previousValue => previousValue + 1);
        });
    }, []);

    const runtimeTranslations = useMemo(() => {
        void availableLocalesVersion;
        const entries = localeRegistry.getAvailableLocales()
            .filter(locale => locale.locale !== 'en')
            .map(locale => {
                const translations = localeRegistry.getTranslations(locale.locale);
                if (!translations || typeof translations !== 'object' || Array.isArray(translations)) {
                    return null;
                }

                return {
                    locale: locale.locale,
                    label: locale.nativeName || locale.displayName,
                    translations: translations as TypeAssertionValue as TranslationObject,
                };
            })
            .filter((entry): entry is { locale: string; label: string; translations: TranslationObject } => entry !== null);

        return entries;
    }, [availableLocalesVersion]);

    const referenceKeys = useMemo(() => flattenKeys(ALL_TRANSLATIONS.en), []);

    const coverageData: CoverageInfo[] = useMemo(() => {
        const locales = [
            { lang: 'en', label: LANGUAGE_LABELS.en, translations: ALL_TRANSLATIONS.en },
            ...runtimeTranslations.map(locale => ({
                lang: locale.locale,
                label: locale.label,
                translations: locale.translations,
            })),
        ];

        return locales.map((locale) => {
            const langKeys = new Set(flattenKeys(locale.translations));
            const translated = referenceKeys.filter((k) => langKeys.has(k)).length;
            return {
                lang: locale.lang,
                label: locale.label,
                total: referenceKeys.length,
                translated,
                percent: referenceKeys.length > 0 ? Math.round((translated / referenceKeys.length) * 100) : 0,
            };
        });
    }, [referenceKeys, runtimeTranslations]);

    const handleExportJSON = (): void => {
        const payload: Record<string, TranslationObject> = {};
        payload.en = ALL_TRANSLATIONS.en;
        for (const locale of runtimeTranslations) {
            payload[locale.locale] = locale.translations;
        }
        downloadBlob(JSON.stringify(payload, null, 2), 'translations.json', 'application/json');
    };

    const handleExportCSV = (): void => {
        const langs = ['en', ...runtimeTranslations.map(locale => locale.locale)] as Language[];
        const header = ['key', ...langs].join(',');

        const rows = referenceKeys.map((key) => {
            const values = langs.map((lang) => {
                const translations = lang === 'en'
                    ? ALL_TRANSLATIONS.en
                    : runtimeTranslations.find(locale => locale.locale === lang)?.translations;
                const flat = translations ? flattenKeys(translations) : [];
                const found = flat.includes(key);
                return found ? `"✓"` : `""`;
            });
            return [`"${key}"`, ...values].join(',');
        });

        downloadBlob([header, ...rows].join('\n'), 'translations.csv', 'text/csv');
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <IconGlobe className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-semibold">{t('frontend.settings.translationExport.title')}</h3>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {coverageData.map((info) => (
                    <div
                        key={info.lang}
                        className="rounded-lg border border-border/40 bg-muted/10 p-3 text-center"
                    >
                        <div className="typo-caption font-medium text-muted-foreground">{info.label}</div>
                        <div
                            className={cn(
                                'text-lg font-bold',
                                info.percent === 100 ? 'text-success' : info.percent >= 70 ? 'text-warning' : 'text-destructive'
                            )}
                        >
                            {info.percent}%
                        </div>
                        <div className="text-sm text-muted-foreground">
                            {info.translated}/{info.total}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex gap-2">
                <button
                    onClick={handleExportJSON}
                    className={C_TRANSLATIONEXPORT_1}
                >
                    <IconDownload className="w-3.5 h-3.5" />
                    {t('frontend.settings.translationExport.exportJSON')}
                </button>
                <button
                    onClick={handleExportCSV}
                    className={C_TRANSLATIONEXPORT_2}
                >
                    <IconDownload className="w-3.5 h-3.5" />
                    {t('frontend.settings.translationExport.exportCSV')}
                </button>
            </div>
        </div>
    );
};

TranslationExport.displayName = 'TranslationExport';


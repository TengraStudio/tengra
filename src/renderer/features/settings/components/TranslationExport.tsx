import { ar } from '@renderer/i18n/ar';
import { de } from '@renderer/i18n/de';
import { en } from '@renderer/i18n/en';
import { es } from '@renderer/i18n/es';
import { fr } from '@renderer/i18n/fr';
import { ja } from '@renderer/i18n/ja';
import { tr } from '@renderer/i18n/tr';
import { zh } from '@renderer/i18n/zh';
import { Download, Globe } from 'lucide-react';
import React, { useMemo } from 'react';

import type { Language } from '@/i18n';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

type TranslationObject = Record<string, unknown>;

const ALL_TRANSLATIONS: Record<Language, TranslationObject> = {
    en: en as unknown as TranslationObject,
    tr: tr as unknown as TranslationObject,
    de: de as unknown as TranslationObject,
    fr: fr as unknown as TranslationObject,
    es: es as unknown as TranslationObject,
    ja: ja as unknown as TranslationObject,
    zh: zh as unknown as TranslationObject,
    ar: ar as unknown as TranslationObject,
};

const LANGUAGE_LABELS: Record<Language, string> = {
    en: 'English',
    tr: 'Türkçe',
    de: 'Deutsch',
    fr: 'Français',
    es: 'Español',
    ja: '日本語',
    zh: '中文',
    ar: 'العربية',
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

    const referenceKeys = useMemo(() => flattenKeys(ALL_TRANSLATIONS.en), []);

    const coverageData: CoverageInfo[] = useMemo(() => {
        return (Object.keys(ALL_TRANSLATIONS) as Language[]).map((lang) => {
            const langKeys = new Set(flattenKeys(ALL_TRANSLATIONS[lang]));
            const translated = referenceKeys.filter((k) => langKeys.has(k)).length;
            return {
                lang,
                label: LANGUAGE_LABELS[lang],
                total: referenceKeys.length,
                translated,
                percent: referenceKeys.length > 0 ? Math.round((translated / referenceKeys.length) * 100) : 0,
            };
        });
    }, [referenceKeys]);

    const handleExportJSON = (): void => {
        const payload: Record<string, TranslationObject> = {};
        for (const lang of Object.keys(ALL_TRANSLATIONS) as Language[]) {
            payload[lang] = ALL_TRANSLATIONS[lang];
        }
        downloadBlob(JSON.stringify(payload, null, 2), 'translations.json', 'application/json');
    };

    const handleExportCSV = (): void => {
        const langs = Object.keys(ALL_TRANSLATIONS) as Language[];
        const header = ['key', ...langs].join(',');

        const rows = referenceKeys.map((key) => {
            const values = langs.map((lang) => {
                const flat = flattenKeys(ALL_TRANSLATIONS[lang]);
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
                <Globe className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-semibold">{t('settings.translationExport.title')}</h3>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {coverageData.map((info) => (
                    <div
                        key={info.lang}
                        className="rounded-lg border border-border/40 bg-muted/10 p-3 text-center"
                    >
                        <div className="text-xs font-medium text-muted-foreground">{info.label}</div>
                        <div
                            className={cn(
                                'text-lg font-bold',
                                info.percent === 100 ? 'text-success' : info.percent >= 70 ? 'text-warning' : 'text-destructive'
                            )}
                        >
                            {info.percent}%
                        </div>
                        <div className="text-xxs text-muted-foreground">
                            {info.translated}/{info.total}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex gap-2">
                <button
                    onClick={handleExportJSON}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border/40 px-3 py-1.5 text-xs hover:bg-muted/30 transition-colors"
                >
                    <Download className="w-3.5 h-3.5" />
                    {t('settings.translationExport.exportJSON')}
                </button>
                <button
                    onClick={handleExportCSV}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border/40 px-3 py-1.5 text-xs hover:bg-muted/30 transition-colors"
                >
                    <Download className="w-3.5 h-3.5" />
                    {t('settings.translationExport.exportCSV')}
                </button>
            </div>
        </div>
    );
};

TranslationExport.displayName = 'TranslationExport';

import { ar } from '@renderer/i18n/ar';
import { de } from '@renderer/i18n/de';
import { en } from '@renderer/i18n/en';
import { es } from '@renderer/i18n/es';
import { fr } from '@renderer/i18n/fr';
import { ja } from '@renderer/i18n/ja';
import { tr } from '@renderer/i18n/tr';
import { zh } from '@renderer/i18n/zh';
import { JsonValue } from '@shared/types/common';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo } from 'react';

import { useSettings } from '@/context/SettingsContext';

export type Language = 'tr' | 'en' | 'de' | 'fr' | 'es' | 'ja' | 'zh' | 'ar';
export type TranslationKeys = typeof tr;

const translations: Partial<Record<Language, TranslationKeys>> = {
    tr,
    en,
    de: de as unknown as TranslationKeys,
    fr: fr as unknown as TranslationKeys,
    es: es as unknown as TranslationKeys,
    ja: ja as unknown as TranslationKeys,
    zh: zh as unknown as TranslationKeys,
    ar: ar as unknown as TranslationKeys
};

const TRANSLATION_MEMORY_STORAGE_KEY = 'tandem.i18n.translation-memory.v1';
const MAX_TRANSLATION_MEMORY_ENTRIES = 1000;

interface TranslationMemoryEntry {
    key: string;
    language: Language;
    fallbackValue: string;
    timestamp: number;
}

const translationMemory = new Map<string, TranslationMemoryEntry>();
let translationMemoryLoaded = false;

const getTranslationNode = (root: JsonValue, path: string): JsonValue | null => {
    const parts = path.split('.');
    let current: JsonValue = root;

    for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
            current = (current as Record<string, JsonValue>)[part];
            continue;
        }
        return null;
    }

    return current;
};

const loadTranslationMemory = (): void => {
    if (translationMemoryLoaded) {
        return;
    }
    translationMemoryLoaded = true;

    try {
        const serialized = window.localStorage.getItem(TRANSLATION_MEMORY_STORAGE_KEY);
        if (!serialized) {
            return;
        }

        const parsed = JSON.parse(serialized) as TranslationMemoryEntry[];
        if (!Array.isArray(parsed)) {
            return;
        }

        parsed.forEach(entry => {
            if (!entry || typeof entry.key !== 'string' || typeof entry.fallbackValue !== 'string') {
                return;
            }
            translationMemory.set(`${entry.language}:${entry.key}`, entry);
        });
    } catch {
        // Ignore malformed localStorage payloads.
    }
};

const persistTranslationMemory = (): void => {
    try {
        const items = Array.from(translationMemory.values())
            .sort((left, right) => right.timestamp - left.timestamp)
            .slice(0, MAX_TRANSLATION_MEMORY_ENTRIES);
        window.localStorage.setItem(TRANSLATION_MEMORY_STORAGE_KEY, JSON.stringify(items));
    } catch {
        // Ignore persistence failures (storage quota/private mode).
    }
};

const rememberTranslationFallback = (
    language: Language,
    key: string,
    fallbackValue: string
): void => {
    const entry: TranslationMemoryEntry = {
        key,
        language,
        fallbackValue,
        timestamp: Date.now()
    };
    translationMemory.set(`${language}:${key}`, entry);

    // Keep memory bounded in runtime too.
    if (translationMemory.size > MAX_TRANSLATION_MEMORY_ENTRIES) {
        const sorted = Array.from(translationMemory.entries())
            .sort((left, right) => right[1].timestamp - left[1].timestamp)
            .slice(0, MAX_TRANSLATION_MEMORY_ENTRIES);
        translationMemory.clear();
        sorted.forEach(([memoryKey, memoryEntry]) => translationMemory.set(memoryKey, memoryEntry));
    }

    persistTranslationMemory();
};

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => Promise<void>;
    t: (path: string, options?: Record<string, string | number>) => string;
    isRTL: boolean;
    formatDate: (date: Date | number, options?: Intl.DateTimeFormatOptions) => string;
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
    formatCurrency: (value: number, currency?: string, options?: Intl.NumberFormatOptions) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

/**
 * Global Language Provider
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
    const { settings, updateSettings } = useSettings();

    // Detect system language on first run if not set
    const getInitialLanguage = useCallback((): Language => {
        if (settings?.general.language) {
            return settings.general.language as Language;
        }

        const browserLang = navigator.language.split('-')[0] as Language;
        const supportedLanguages: Language[] = ['en', 'tr', 'de', 'fr', 'es', 'ja', 'zh', 'ar'];

        return supportedLanguages.includes(browserLang) ? browserLang : 'en';
    }, [settings]);

    const language = useMemo(() => getInitialLanguage(), [getInitialLanguage]);

    const setLanguage = useCallback(async (lang: Language) => {
        if (!settings) { return; }
        const updated = { ...settings, general: { ...settings.general, language: lang } };
        await updateSettings(updated, true);
    }, [settings, updateSettings]);

    const isRTL = useMemo(() => language === 'ar', [language]);

    // Sync HTML attributes
    useEffect(() => {
        document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
        document.documentElement.lang = language;
    }, [language, isRTL]);

    useEffect(() => {
        loadTranslationMemory();
    }, []);

    const t = useMemo(() => {
        const activeTranslations = (translations[language] ?? translations.en) as JsonValue;
        const fallbackTranslations = translations.en as JsonValue;

        return (path: string, options?: Record<string, string | number>): string => {
            const currentValue = getTranslationNode(activeTranslations, path);
            const fallbackValue = getTranslationNode(fallbackTranslations, path);
            const selectedValue = currentValue ?? fallbackValue;

            if (currentValue === null && typeof fallbackValue === 'string' && language !== 'en') {
                rememberTranslationFallback(language, path, fallbackValue);
            }

            if (typeof selectedValue === 'string') {
                let text = selectedValue;

                // Handle Pluralization (if count is provided)
                if (options && typeof options.count === 'number') {
                    const pluralRules = new Intl.PluralRules(language);
                    const rule = pluralRules.select(options.count);
                    const pluralKey = `${path}_${rule}`;
                    const pluralCurrent = getTranslationNode(activeTranslations, pluralKey);
                    const pluralFallback = getTranslationNode(fallbackTranslations, pluralKey);
                    if (typeof pluralCurrent === 'string') {
                        text = pluralCurrent;
                    } else if (typeof pluralFallback === 'string') {
                        text = pluralFallback;
                    }
                }

                if (options) {
                    return Object.keys(options).reduce((acc, key) => {
                        return acc.replace(new RegExp(`{{${key}}}`, 'g'), String(options[key]));
                    }, text);
                }
                return text;
            }

            return path;
        };
    }, [language]);

    const formatDate = useCallback((date: Date | number, options?: Intl.DateTimeFormatOptions) => {
        return new Intl.DateTimeFormat(language, options).format(date);
    }, [language]);

    const formatNumber = useCallback((value: number, options?: Intl.NumberFormatOptions) => {
        return new Intl.NumberFormat(language, options).format(value);
    }, [language]);

    const formatCurrency = useCallback((value: number, currency = 'USD', options?: Intl.NumberFormatOptions) => {
        return new Intl.NumberFormat(language, {
            style: 'currency',
            currency,
            ...options
        }).format(value);
    }, [language]);

    const value = useMemo(() => ({
        language,
        setLanguage,
        t,
        isRTL,
        formatDate,
        formatNumber,
        formatCurrency
    }), [language, setLanguage, t, isRTL, formatDate, formatNumber, formatCurrency]);

    return React.createElement(LanguageContext.Provider, { value }, children);
}

/**
 * Access i18n context
 */
export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}

/**
 * Backward-compatible useTranslation hook
 */
export function useTranslation(lang?: Language) {
    const context = useContext(LanguageContext);

    // If explicit language is provided, return its translations (standalone)
    if (lang) {
        const activeTranslations = (translations[lang] ?? translations.en) as JsonValue;
        const fallbackTranslations = translations.en as JsonValue;
        const get = (path: string, options?: Record<string, string | number>): string => {
            const current = getTranslationNode(activeTranslations, path);
            const fallback = getTranslationNode(fallbackTranslations, path);
            const selected = current ?? fallback;

            if (typeof selected === 'string') {
                if (options) {
                    return Object.keys(options).reduce((acc, key) => {
                        return acc.replace(new RegExp(`{{${key}}}`, 'g'), String(options[key]));
                    }, selected);
                }
                return selected;
            }

            return path;
        };
        return {
            t: get,
            translations: activeTranslations,
            formatDate: (date: Date | number, options?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(lang, options).format(date),
            formatNumber: (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat(lang, options).format(value)
        };
    }

    // Default to context if available
    if (context) {
        return {
            t: context.t,
            language: context.language,
            setLanguage: context.setLanguage,
            isRTL: context.isRTL,
            formatDate: context.formatDate,
            formatNumber: context.formatNumber,
            formatCurrency: context.formatCurrency
        };
    }

    // Bare-bones fallback if caller is outside LanguageProvider
    const fallbackLang = 'en';
    return {
        t: (path: string) => path,
        language: fallbackLang as Language,
        setLanguage: async () => { },
        isRTL: false,
        formatDate: (date: Date | number) => String(date),
        formatNumber: (value: number) => String(value),
        formatCurrency: (value: number) => String(value)
    };
}


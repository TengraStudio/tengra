/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { enLocalePack } from '@renderer/i18n/locales';
import { JsonValue } from '@shared/types/common';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useSettings } from '@/context/SettingsContext';
import { localeRegistry } from '@/i18n/locale-registry.service';
import { readCachedSettings } from '@/store/settings.store';
import { translateErrorMessage } from '@/utils/error-handler.util';

export type BuiltInLanguage = 'en';
export type Language = string;
export type TranslationKeys = JsonValue;

const translations: Partial<Record<BuiltInLanguage, TranslationKeys>> = {
    en: enLocalePack.translations
};
const DEFAULT_LANGUAGE = 'en';
const DEFAULT_TRANSLATION_FALLBACK_KEY = 'common.notAvailable';

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


const interpolateTranslation = (
    text: string,
    options?: Record<string, unknown>
): string => {
    if (!options) {
        return text;
    }

    return Object.keys(options).reduce((accumulator, key) => {
        return accumulator.replace(new RegExp(`{{${key}}}`, 'g'), String(options[key]));
    }, text);
};

const selectTranslationText = (
    locale: string,
    translationRoot: JsonValue,
    path: string,
    options?: Record<string, unknown>
): string => {
    let translationValue = getTranslationNode(translationRoot, path);

    if (options && typeof options.count === 'number') {
        const pluralKey = `${path}_${new Intl.PluralRules(locale).select(options.count)}`;
        const pluralValue = getTranslationNode(translationRoot, pluralKey);
        if (typeof pluralValue === 'string') {
            translationValue = pluralValue;
        }
    }

    if (typeof translationValue !== 'string') {
        const defaultFallback = getTranslationNode(translationRoot, DEFAULT_TRANSLATION_FALLBACK_KEY);
        if (typeof defaultFallback === 'string') {
            return interpolateTranslation(defaultFallback, options);
        }

        const englishFallback = getTranslationNode(translations.en as JsonValue, DEFAULT_TRANSLATION_FALLBACK_KEY);
        if (typeof englishFallback === 'string') {
            return interpolateTranslation(englishFallback, options);
        }

        return '';
    }

    return interpolateTranslation(translationValue, options);
};

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => Promise<void>;
    t: (path: string, options?: Record<string, unknown>) => string;
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
    const [localeRegistryVersion, setLocaleRegistryVersion] = useState(0);

    const resolveLanguage = useCallback((candidate: string | null | undefined): Language => {
        return localeRegistry.resolveLocale(candidate);
    }, []);

    // Detect system language on first run if not set
    const getInitialLanguage = useCallback((): Language => {
        if (settings?.general.language) {
            return resolveLanguage(settings.general.language);
        }

        const cachedSettings = readCachedSettings();
        if (cachedSettings?.general.language) {
            return resolveLanguage(cachedSettings.general.language);
        }

        return resolveLanguage(navigator.language);
    }, [resolveLanguage, settings]);

    const language = useMemo(() => getInitialLanguage(), [getInitialLanguage]);

    const setLanguage = useCallback(async (lang: Language) => {
        if (!settings) {
            return;
        }
        const resolvedLanguage = resolveLanguage(lang);
        if (settings.general.language === resolvedLanguage) {
            return;
        }
        const updated = { ...settings, general: { ...settings.general, language: resolvedLanguage } };
        await updateSettings(updated, true);
    }, [resolveLanguage, settings, updateSettings]);

    const isRTL = localeRegistry.isLocaleRtl(language);

    // Sync HTML attributes
    useEffect(() => {
        document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
        document.documentElement.lang = language;
    }, [language, isRTL]);

    useEffect(() => {
        if (!settings?.general.language) {
            return;
        }

        const resolvedLanguage = resolveLanguage(settings.general.language);
        if (resolvedLanguage === settings.general.language) {
            return;
        }

        const updatedSettings = {
            ...settings,
            general: {
                ...settings.general,
                language: resolvedLanguage,
            },
        };
        void updateSettings(updatedSettings, true);
    }, [resolveLanguage, settings, updateSettings]);

    useEffect(() => {
        void localeRegistry.loadLocales();

        return localeRegistry.subscribe(() => {
            setLocaleRegistryVersion(previousValue => previousValue + 1);
        });
    }, []);

    const t = useMemo(() => {
        void localeRegistryVersion;
        const activeTranslations = (localeRegistry.getTranslations(language)
            ?? translations[language as BuiltInLanguage]
            ?? translations.en) as JsonValue;

        return (path: string, options?: Record<string, unknown>): string => {
            return selectTranslationText(language, activeTranslations, path, options);
        };
    }, [language, localeRegistryVersion]);

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
        throw new Error(translateErrorMessage('useLanguage must be used within a LanguageProvider'));
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
        const resolvedLanguage = localeRegistry.resolveLocale(lang);
        const activeTranslations = (localeRegistry.getTranslations(resolvedLanguage)
            ?? translations[resolvedLanguage as BuiltInLanguage]
            ?? translations.en) as JsonValue;
        const get = (path: string, options?: Record<string, unknown>): string => {
            return selectTranslationText(resolvedLanguage, activeTranslations, path, options);
        };
        return {
            t: get,
            translations: activeTranslations,
            formatDate: (date: Date | number, options?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(resolvedLanguage, options).format(date),
            formatNumber: (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat(resolvedLanguage, options).format(value)
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
    return {
        t: (path: string) => path,
        language: DEFAULT_LANGUAGE as Language,
        setLanguage: async () => { },
        isRTL: false,
        formatDate: (date: Date | number) => String(date),
        formatNumber: (value: number) => String(value),
        formatCurrency: (value: number) => String(value)
    };
}



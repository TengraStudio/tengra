import { ar } from '@renderer/i18n/ar';
import { de } from '@renderer/i18n/de';
import { en } from '@renderer/i18n/en';
import { es } from '@renderer/i18n/es';
import { fr } from '@renderer/i18n/fr';
import { ja } from '@renderer/i18n/ja';
import { tr } from '@renderer/i18n/tr';
import { zh } from '@renderer/i18n/zh';
import { JsonValue } from '@shared/types/common';
import React, { createContext, ReactNode,useCallback, useContext, useMemo } from 'react';

import { useSettings } from '@/context/SettingsContext';

export type Language = 'tr' | 'en' | 'de' | 'fr' | 'es' | 'ja' | 'zh' | 'ar'
export type TranslationKeys = typeof tr

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

interface LanguageContextType {
    language: Language
    setLanguage: (lang: Language) => Promise<void>
    t: (path: string, options?: Record<string, string | number>) => string
    isRTL: boolean
}

const LanguageContext = createContext<LanguageContextType | null>(null);

/**
 * Global Language Provider
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
    const { settings, updateSettings } = useSettings();

    const language = (settings?.general.language ?? 'en') as Language;

    const setLanguage = useCallback(async (lang: Language) => {
        if (!settings) { return; }
        const updated = { ...settings, general: { ...settings.general, language: lang } };
        await updateSettings(updated, true);
    }, [settings, updateSettings]);

    const isRTL = language === 'ar';

    const t = useMemo(() => {
        const activeTranslations = (translations[language] ?? translations.en) as JsonValue;

        return (path: string, options?: Record<string, string | number>): string => {
            const parts = path.split('.');
            let current: JsonValue = activeTranslations;

            for (const part of parts) {
                if (current && typeof current === 'object' && part in current) {
                    current = (current as Record<string, JsonValue>)[part];
                } else {
                    return path;
                }
            }

            if (typeof current === 'string') {
                if (options) {
                    return Object.keys(options).reduce((acc, key) => {
                        return acc.replace(new RegExp(`{{${key}}}`, 'g'), String(options[key]));
                    }, current);
                }
                return current;
            }

            return path;
        };
    }, [language]);

    const value = useMemo(() => ({
        language,
        setLanguage,
        t,
        isRTL
    }), [language, setLanguage, t, isRTL]);

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
        const get = (path: string, options?: Record<string, string | number>): string => {
            const parts = path.split('.');
            let current: JsonValue = activeTranslations;

            for (const part of parts) {
                if (current && typeof current === 'object' && part in current) {
                    current = (current as Record<string, JsonValue>)[part];
                } else {
                    return path;
                }
            }

            if (typeof current === 'string') {
                if (options) {
                    return Object.keys(options).reduce((acc, key) => {
                        return acc.replace(new RegExp(`{{${key}}}`, 'g'), String(options[key]));
                    }, current);
                }
                return current;
            }

            return path;
        };
        return { t: get, translations: activeTranslations };
    }

    // Default to context if available
    if (context) {
        return {
            t: context.t,
            language: context.language,
            setLanguage: context.setLanguage,
            isRTL: context.isRTL
        };
    }

    // Bare-bones fallback if caller is outside LanguageProvider
    const fallbackLang = 'en';
    return {
        t: (path: string) => path,
        language: fallbackLang as Language,
        setLanguage: async () => { },
        isRTL: false
    };
}

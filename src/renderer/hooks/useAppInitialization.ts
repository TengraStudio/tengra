/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useEffect, useRef } from 'react';

import { Language, useLanguage } from '@/i18n';
import { localeRegistry } from '@/i18n/locale-registry.service';
import { marketplaceStore } from '@/store/marketplace.store';
import { themeRegistry } from '@/themes/theme-registry.service';
import { unwrapSettingsResponse } from '@/utils/app-settings.util';
import { appLogger } from '@/utils/renderer-logger';

export function useAppInitialization() {
    const { language, setLanguage } = useLanguage();
    const setLanguageRef = useRef(setLanguage);
    const handleSpeak = useCallback((text: string) => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
            return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utterance);
    }, []);

    useEffect(() => {
        setLanguageRef.current = setLanguage;
    }, [setLanguage]);

    useEffect(() => {
        window.TengraSpeak = handleSpeak;
        return () => {
            delete (window as Partial<typeof window>).TengraSpeak;
        };
    }, [handleSpeak]);

    useEffect(() => {
        document.documentElement.dir = 'ltr';
        document.documentElement.lang = language;
    }, [language]);

    // Load theme registry on app start
    useEffect(() => {
        void themeRegistry.loadThemes().catch(error => {
            appLogger.error('AppInit', 'Failed to load runtime theme registry', error as Error);
        });

        // Check for marketplace updates on startup (silent)
        void marketplaceStore.checkLiveUpdates(true).catch(error => {
            appLogger.error('AppInit', 'Failed to check for marketplace live updates', error as Error);
        });

        const loadLocales = async () => {
            try {
                await localeRegistry.loadLocales();
            } catch (error) {
                appLogger.error('AppInit', 'Failed to load runtime locale registry', error as Error);
            }
        };

        const idleCallback = (window as Window & { requestIdleCallback?: (cb: IdleRequestCallback) => number }).requestIdleCallback;
        if (idleCallback) {
            idleCallback(() => {
                void loadLocales();
            });
        } else {
            window.setTimeout(() => {
                void loadLocales();
            }, 200);
        }
    }, []);

    useEffect(() => {
        const abortController = new AbortController();

        const detectLanguage = async () => {
            if (abortController.signal.aborted) {
                return;
            }

            const response = await window.electron.getSettings();
            const settings = unwrapSettingsResponse(response);
            if (!abortController.signal.aborted && !settings?.general?.language) {
                const browserLang = window.navigator.language.split('-')[0];
                const supported = localeRegistry.getAvailableLocales().map(locale => locale.locale);
                if (supported.includes(browserLang)) {
                    void setLanguageRef.current(browserLang as Language);
                }
            }
        };
        void detectLanguage();

        return () => {
            abortController.abort();
        };
    }, []);


    return {};
}


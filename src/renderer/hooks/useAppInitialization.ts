import { useTextToSpeech } from '@renderer/features/chat/hooks/useTextToSpeech';
import { Language, useLanguage } from '@renderer/i18n';
import { themeRegistry } from '@renderer/themes/theme-registry.service';
import { useEffect, useRef } from 'react';

import { appLogger } from '@/utils/renderer-logger';

export function useAppInitialization() {
    const { language, setLanguage } = useLanguage();
    const { speak: handleSpeak } = useTextToSpeech();
    const setLanguageRef = useRef(setLanguage);

    useEffect(() => {
        setLanguageRef.current = setLanguage;
    }, [setLanguage]);

    useEffect(() => {
        window.TengraSpeak = handleSpeak;
    }, [handleSpeak]);

    useEffect(() => {
        document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = language;
    }, [language]);

    // Load theme registry on app start
    useEffect(() => {
        const loadThemes = async () => {
            try {
                await themeRegistry.loadThemes();
            } catch (error) {
                appLogger.error('AppInit', 'Failed to load theme registry', error as Error);
            }
        };
        const idleCallback = (window as Window & { requestIdleCallback?: (cb: IdleRequestCallback) => number }).requestIdleCallback;
        if (idleCallback) {
            idleCallback(() => {
                void loadThemes();
            });
        } else {
            window.setTimeout(() => {
                void loadThemes();
            }, 200);
        }
    }, []);

    useEffect(() => {
        const abortController = new AbortController();

        const detectLanguage = async () => {
            if (abortController.signal.aborted) {
                return;
            }

            const settings = await window.electron.getSettings();
            if (!abortController.signal.aborted && !settings?.general?.language) {
                const browserLang = window.navigator.language.split('-')[0];
                const supported = ['tr', 'en', 'de', 'fr', 'es', 'ja', 'zh', 'ar'];
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


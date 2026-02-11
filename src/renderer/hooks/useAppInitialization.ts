import { useTextToSpeech } from '@renderer/features/chat/hooks/useTextToSpeech';
import { Language, useLanguage } from '@renderer/i18n';
import { themeRegistry } from '@renderer/themes/theme-registry.service';
import { useEffect, useState } from 'react';

export function useAppInitialization() {
    const { language, setLanguage } = useLanguage();
    const { speak: handleSpeak } = useTextToSpeech();
    const [showExtensionWarning, setShowExtensionWarning] = useState(false);

    useEffect(() => {
        window.TandemSpeak = handleSpeak;
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
                console.error('[AppInit] Failed to load theme registry:', error);
            }
        };
        void loadThemes();
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
                    void setLanguage(browserLang as Language);
                }
            }
        };
        void detectLanguage();

        return () => {
            abortController.abort();
        };
    }, [setLanguage]);

    useEffect(() => {
        const abortController = new AbortController();

        const checkExtensionWarning = async () => {
            if (abortController.signal.aborted) {
                return;
            }

            try {
                const shouldShow = await window.electron.extension.shouldShowWarning();
                if (!abortController.signal.aborted) {
                    setShowExtensionWarning(shouldShow);
                }
            } catch (error) {
                console.error('[Extension] Failed to check warning status:', error);
            }
        };
        void checkExtensionWarning();

        return () => {
            abortController.abort();
        };
    }, []);

    return {
        showExtensionWarning,
        setShowExtensionWarning,
    };
}

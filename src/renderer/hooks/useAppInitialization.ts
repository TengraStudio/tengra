import { useTextToSpeech } from '@renderer/features/chat/hooks/useTextToSpeech';
import { Language, useLanguage } from '@renderer/i18n';
import { useEffect, useState } from 'react';

export function useAppInitialization() {
    const { language, setLanguage } = useLanguage();
    const { speak: handleSpeak } = useTextToSpeech();
    const [showExtensionWarning, setShowExtensionWarning] = useState(false);

    useEffect(() => { window.TandemSpeak = handleSpeak; }, [handleSpeak]);

    useEffect(() => {
        document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = language;
    }, [language]);

    useEffect(() => {
        const detectLanguage = async () => {
            const settings = await window.electron.getSettings();
            if (!settings?.general?.language) {
                const browserLang = window.navigator.language.split('-')[0];
                const supported = ['tr', 'en', 'de', 'fr', 'es', 'ja', 'zh', 'ar'];
                if (supported.includes(browserLang)) {
                    void setLanguage(browserLang as Language);
                }
            }
        };
        void detectLanguage();
    }, [setLanguage]);

    useEffect(() => {
        const checkExtensionWarning = async () => {
            try {
                const shouldShow = await window.electron.extension.shouldShowWarning();
                setShowExtensionWarning(shouldShow);
            } catch (error) {
                console.error('[Extension] Failed to check warning status:', error);
            }
        };
        void checkExtensionWarning();
    }, []);

    return {
        showExtensionWarning,
        setShowExtensionWarning
    };
}

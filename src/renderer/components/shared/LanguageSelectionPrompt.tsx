import {
    sanitizePromptLanguage,
    SUPPORTED_PROMPT_LANGUAGES,
} from '@renderer/components/shared/language-selection-prompt.validation';
import { Language, useLanguage } from '@renderer/i18n';
import {
    recordLanguageSelectionFailure,
    recordLanguageSelectionFallback,
    recordLanguageSelectionRetry,
    recordLanguageSelectionSuccess,
    setLanguageSelectionUiState,
} from '@renderer/store/language-selection-health.store';
import { useCallback, useMemo, useState } from 'react';

interface LanguageSelectionPromptProps {
    onClose: () => void;
}

export function LanguageSelectionPrompt({ onClose }: LanguageSelectionPromptProps) {
    const { language, setLanguage, t } = useLanguage();
    const [isSaving, setIsSaving] = useState(false);
    const [errorCode, setErrorCode] = useState<string | null>(null);

    const languages = useMemo<{ code: Language; name: string; isRTL: boolean }[]>(() => [
        { code: 'en', name: 'English', isRTL: false },
        { code: 'tr', name: 'Türkçe', isRTL: false },
        { code: 'de', name: 'Deutsch', isRTL: false },
        { code: 'fr', name: 'Français', isRTL: false },
        { code: 'es', name: 'Español', isRTL: false },
        { code: 'ja', name: '日本語', isRTL: false },
        { code: 'zh', name: '简体中文', isRTL: false },
        { code: 'ar', name: 'العربية', isRTL: true }
    ], []);

    const saveLanguageWithRetry = useCallback(async (code: Language): Promise<boolean> => {
        const startedAt = performance.now();
        const maxAttempts = 2;
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            try {
                if (attempt > 0) {
                    recordLanguageSelectionRetry();
                }
                await setLanguage(code);
                recordLanguageSelectionSuccess(performance.now() - startedAt);
                return true;
            } catch {
                if (attempt < maxAttempts - 1) {
                    continue;
                }
                recordLanguageSelectionFailure(
                    'LANGUAGE_PROMPT_SAVE_FAILED',
                    performance.now() - startedAt
                );
                return false;
            }
        }
        recordLanguageSelectionFallback();
        return false;
    }, [setLanguage]);

    const handleSelect = useCallback(async (rawCode: Language) => {
        const code = sanitizePromptLanguage(rawCode);
        if (!code || !SUPPORTED_PROMPT_LANGUAGES.includes(code)) {
            setErrorCode('LANGUAGE_PROMPT_INVALID_LANGUAGE');
            recordLanguageSelectionFailure('LANGUAGE_PROMPT_INVALID_LANGUAGE');
            return;
        }

        setIsSaving(true);
        setErrorCode(null);
        setLanguageSelectionUiState('loading');
        const success = await saveLanguageWithRetry(code);
        setIsSaving(false);

        if (!success) {
            setErrorCode('LANGUAGE_PROMPT_SAVE_FAILED');
            setLanguageSelectionUiState('failure');
            return;
        }

        setLanguageSelectionUiState('ready');
        onClose();
    }, [onClose, saveLanguageWithRetry]);

    const handleContinue = useCallback(() => {
        recordLanguageSelectionFallback();
        onClose();
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-background w-full max-w-md p-8 flex flex-col items-center text-center animate-spring-in">
                <h2 className="text-2xl font-bold mb-2">
                    {t('onboarding.language.title', { code: 'en' })}
                </h2>
                <p className="text-muted-foreground mb-8">
                    {t('onboarding.language.description', { code: 'en' })}
                </p>

                <div className="grid grid-cols-2 gap-3 w-full capitalize">
                    {languages.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => {
                                void handleSelect(lang.code);
                            }}
                            disabled={isSaving}
                            className={`flex items-center justify-start px-4 h-12 rounded-lg border transition-all ${language === lang.code
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background/30 hover:bg-primary/50 text-foreground border-border/40'
                                } ${lang.isRTL ? 'font-arabic text-right' : ''}`}
                        >
                        <span className="flex-1 text-left">{lang.name}</span>
                        </button>
                    ))}
                </div>
                {errorCode && (
                    <p className="mt-3 text-xs text-destructive" role="status">
                        {t(`onboarding.language.${errorCode}`)}
                    </p>
                )}

                <div className="mt-8 pt-6 border-t border-border/50 w-full">
                    <button
                        onClick={handleContinue}
                        disabled={isSaving}
                        className="w-full h-11 px-4 rounded-lg bg-primary/50 hover:bg-primary text-foreground transition-all font-medium border border-border/40"
                    >
                        {isSaving ? t('common.loading') : t('common.continue')}
                    </button>
                </div>
            </div>
        </div>
    );
}

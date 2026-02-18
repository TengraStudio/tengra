import { Language, useLanguage } from '@renderer/i18n';
import { useCallback, useMemo } from 'react';

interface LanguageSelectionPromptProps {
    onClose: () => void;
}

export function LanguageSelectionPrompt({ onClose }: LanguageSelectionPromptProps) {
    const { language, setLanguage, t } = useLanguage();

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

    const handleSelect = useCallback((code: Language) => {
        void setLanguage(code);
        onClose();
    }, [setLanguage, onClose]);

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
                            onClick={() => handleSelect(lang.code)}
                            className={`flex items-center justify-start px-4 h-12 rounded-lg border transition-all ${language === lang.code
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background/30 hover:bg-primary/50 text-foreground border-border/40'
                                } ${lang.isRTL ? 'font-arabic text-right' : ''}`}
                        >
                            <span className="flex-1 text-left">{lang.name}</span>
                        </button>
                    ))}
                </div>

                <div className="mt-8 pt-6 border-t border-border/50 w-full">
                    <button
                        onClick={onClose}
                        className="w-full h-11 px-4 rounded-lg bg-primary/50 hover:bg-primary text-foreground transition-all font-medium border border-border/40"
                    >
                        {t('common.continue') || 'Continue with detected language'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconCircleCheck,IconDownload, IconGlobe, IconX } from '@tabler/icons-react';
import React, { useEffect } from 'react';

import { useTranslation } from '@/i18n';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';
import { languagePromptStore, useLanguagePromptStore } from '@/store/language-prompt.store';

export const LanguagePackPrompt: React.FC = () => {
    const { t } = useTranslation();
    const { matchingPack, isVisible } = useLanguagePromptStore(state => state);
    const [isInstalling, setIsInstalling] = React.useState(false);
    const [isDone, setIsDone] = React.useState(false);

    useEffect(() => {
        // Trigger check on mount
        void languagePromptStore.checkLanguagePack();
    }, []);

    const handleInstall = async () => {
        setIsInstalling(true);
        try {
            await languagePromptStore.install();
            setIsDone(true);
            // Hide after a delay
            setTimeout(() => {
                languagePromptStore.dismiss();
            }, 3000);
        } catch {
            setIsInstalling(false);
        }
    };

    const handleDismiss = () => {
        languagePromptStore.dismiss();
    };

    const handleDontAskAgain = () => {
        languagePromptStore.dismiss(true);
    };

    const isTurkish = navigator.language.startsWith('tr');

    const getTranslation = (key: string, options?: Record<string, string | number>) => {
        if (isTurkish && matchingPack) {
            const trFallbacks: Record<string, string> = {
                'languagePrompt.title': 'Dil Paketi Mevcut',
                'languagePrompt.content': `Marketplace'de ${matchingPack.nativeName || matchingPack.name} (${matchingPack.locale.toUpperCase()}) için bir dil paketi bulunuyor. Kurup uygulama dilini değiştirmek ister misiniz?`,
                'languagePrompt.installAction': 'Kur ve Değiştir',
                'languagePrompt.dismissAction': 'Şimdi Değil',
                'languagePrompt.dontAskAgain': 'Bir daha sorma',
                'languagePrompt.coverage': `Kapsam: %${matchingPack.coverage}`,
            };
            let text = trFallbacks[key] || t(key, options);
            if (options) {
                Object.keys(options).forEach(k => {
                    text = text.replace(`{{${k}}}`, String((options as Record<string, string | number>)[k]));
                });
            }
            return text;
        }
        return t(key, options);
    };

    if (!isVisible || !matchingPack) {
        return null;
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed bottom-6 right-6 w-[380px] bg-background border border-border/50 rounded-xl shadow-2xl overflow-hidden z-[100] flex flex-col font-sans backdrop-blur-md"
            >
                <div className="flex items-start justify-between p-4 border-b border-border/50 bg-primary/5">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            <IconGlobe className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-foreground m-0 leading-tight">
                                {getTranslation('languagePrompt.title')}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-sm text-muted-foreground uppercase font-medium">
                                    {matchingPack.nativeName || matchingPack.name}
                                </p>
                                {(matchingPack.coverage ?? 0) < 100 && (
                                    <span className="text-sm px-1.5 py-0.5 rounded-full bg-warning/10 text-warning font-bold border border-warning/20">
                                        {getTranslation('languagePrompt.coverage', { percent: matchingPack.coverage ?? 0 })}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="p-1 -m-1 text-muted-foreground/60 hover:text-foreground transition-colors hover:bg-muted/50 rounded-md cursor-pointer"
                    >
                        <IconX className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-4 text-sm text-muted-foreground leading-relaxed">
                    {isDone ? (
                        <div className="flex items-center gap-2 text-success font-medium">
                            <IconCircleCheck className="w-5 h-5" />
                            <span>
                                {isTurkish
                                    ? `${matchingPack.name} başarıyla kuruldu.`
                                    : t('frontend.marketplace.installSuccess', { name: matchingPack.name })}
                            </span>
                        </div>
                    ) : (
                        getTranslation('languagePrompt.content', {
                            name: matchingPack.nativeName || matchingPack.name,
                            locale: matchingPack.locale.toUpperCase(),
                        })
                    )}
                </div>

                {!isDone && (
                    <div className="flex flex-col gap-2 p-4 bg-muted/10 border-t border-border/50">
                        <div className="flex gap-2">
                            <button
                                onClick={handleInstall}
                                disabled={isInstalling}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all",
                                    "bg-primary text-primary-foreground hover:brightness-110 active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-primary/20"
                                )}
                            >
                                {isInstalling ? (
                                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin rounded-full" />
                                ) : (
                                    <IconDownload className="w-4 h-4" />
                                )}
                                {getTranslation('languagePrompt.installAction')}
                            </button>
                            <button
                                onClick={handleDismiss}
                                disabled={isInstalling}
                                className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-all border border-border"
                            >
                                {getTranslation('languagePrompt.dismissAction')}
                            </button>
                        </div>
                        <button
                            onClick={handleDontAskAgain}
                            disabled={isInstalling}
                            className="text-sm text-muted-foreground/60 hover:text-destructive transition-colors text-center mt-1 underline underline-offset-2 decoration-dotted"
                        >
                            {getTranslation('languagePrompt.dontAskAgain')}
                        </button>
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
};

LanguagePackPrompt.displayName = 'LanguagePackPrompt';


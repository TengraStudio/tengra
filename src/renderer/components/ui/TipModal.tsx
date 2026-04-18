/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Button } from '@renderer/components/ui/button';
import { Modal } from '@renderer/components/ui/modal';
import { Brain,Lightbulb, Sparkles, Zap } from 'lucide-react';
import { useEffect,useState } from 'react';

import { Language,useTranslation } from '@/i18n';


export function TipModal({ language = 'en' }: { language?: Language }) {
    const { t } = useTranslation(language);
    const [isOpen, setIsOpen] = useState(false);
    const [currentTip, setCurrentTip] = useState("");

    useEffect(() => {
        const lastShown = localStorage.getItem('last_tip_date');
        const today = new Date().toDateString();

        if (lastShown !== today) {
            const tips = [
                t('tips.tip1'),
                t('tips.tip2'),
                t('tips.tip3'),
                t('tips.tip4'),
                t('tips.tip5')
            ].filter(Boolean);
            if (tips.length > 0) {
                const randomTip = tips[Math.floor(Math.random() * tips.length)];
                setTimeout(() => {
                    setCurrentTip(randomTip);
                    setIsOpen(true);
                }, 0);
                localStorage.setItem('last_tip_date', today);
            }
        }
    }, [t]);

    if (!isOpen) {return null;}

    return (
        <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={t('tips.title')}>
            <div className="flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto space-y-6">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                    <div className="relative bg-background border border-border/50 p-4 rounded-2xl shadow-xl">
                        <Lightbulb className="w-10 h-10 text-primary animate-pulse" />
                    </div>
                    <div className="absolute -top-2 -right-2 bg-accent text-accent-foreground p-1.5 rounded-full shadow-md animate-bounce">
                        <Sparkles className="w-4 h-4" />
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="flex items-center justify-center gap-2 text-xl font-bold bg-gradient-to-br from-primary to-accent bg-clip-text text-transparent">
                        <Zap className="w-5 h-5 text-accent" />
                        {t('tips.didYouKnow')}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed italic border-l-2 border-primary/30 pl-4 py-1 text-left">
                        "{currentTip}"
                    </p>
                </div>

                <div className="flex w-full gap-3 pt-2">
                    <Button variant="outline" className="flex-1" onClick={() => setIsOpen(false)}>
                        {t('tips.gotIt')}
                    </Button>
                    <Button className="flex-1 shadow-lg shadow-primary/20" onClick={() => setIsOpen(false)}>
                        <Brain className="w-4 h-4 mr-2" />
                        {t('tips.discoverMore')}
                    </Button>
                </div>

                <div className="pt-2">
                    <button
                        onClick={() => setIsOpen(false)}
                        className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer bg-transparent border-none p-2"
                    >
                        {t('tips.dontShowAgain')}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

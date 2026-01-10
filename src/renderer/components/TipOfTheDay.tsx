import React, { useState, useEffect } from 'react';
import { X, Lightbulb } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from '@/i18n';

interface TipOfTheDayProps {
    language?: 'en' | 'tr';
}

export const TipOfTheDay: React.FC<TipOfTheDayProps> = ({ language = 'en' }) => {
    const { t } = useTranslation(language);
    const [isOpen, setIsOpen] = useState(false);
    const [tipIndex, setTipIndex] = useState(0);

    const TIPS = [
        t('tips.tip1'),
        t('tips.tip2'),
        t('tips.tip3'),
        t('tips.tip4'),
        t('tips.tip5')
    ];

    useEffect(() => {
        // Simple logic: Show tip 20% of the time on mount
        const timer = setTimeout(() => {
            if (Math.random() > 0.8) {
                setTipIndex(Math.floor(Math.random() * TIPS.length));
                setIsOpen(true);
            }
        }, 0);
        return () => clearTimeout(timer);
    }, [TIPS.length]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="fixed bottom-4 right-4 z-50 max-w-sm"
            >
                <div className="bg-card border border-border shadow-xl rounded-xl p-4 flex items-start gap-3">
                    <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500 shrink-0">
                        <Lightbulb className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <h4 className="text-sm font-bold text-foreground mb-1">{t('tips.title')}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">{TIPS[tipIndex]}</p>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

import { Button } from '@renderer/components/ui/button';
import { Modal } from '@renderer/components/ui/modal';
import { Brain,Lightbulb, Sparkles, Zap } from 'lucide-react';
import { useEffect,useState } from 'react';

import { Language,useTranslation } from '@/i18n';

export function TipModal({ language = 'tr' }: { language?: Language }) {
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
            <div className="p-6 flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center relative group">
                    <div className="absolute inset-0 bg-primary/20 rounded-3xl blur-xl transition-all group-hover:blur-2xl" />
                    <Lightbulb className="w-8 h-8 text-primary relative z-10 animate-pulse" />
                    <div className="absolute -top-2 -right-2 bg-warning rounded-full p-1 shadow-lg">
                        <Sparkles className="w-3 h-3 text-foreground" />
                    </div>
                </div>

                <div className="space-y-2">
                    <h3 className="text-lg font-black uppercase tracking-widest text-foreground/80 flex items-center justify-center gap-2">
                        <Zap className="w-4 h-4 text-primary" />
                        {t('tips.didYouKnow')}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed font-medium">
                        "{currentTip}"
                    </p>
                </div>

                <div className="w-full flex gap-3 pt-4">
                    <Button variant="outline" className="flex-1 rounded-2xl h-12 border-border/40 hover:bg-accent/30" onClick={() => setIsOpen(false)}>
                        {t('tips.gotIt')}
                    </Button>
                    <Button className="flex-[1.5] rounded-2xl h-12 shadow-xl shadow-primary/20" onClick={() => setIsOpen(false)}>
                        <Brain className="w-4 h-4 mr-2" />
                        {t('tips.discoverMore')}
                    </Button>
                </div>

                <button
                    onClick={() => setIsOpen(false)}
                    className="text-xxs font-bold text-muted-foreground/40 hover:text-muted-foreground transition-colors uppercase tracking-widest pt-2"
                >
                    {t('tips.dontShowAgain')}
                </button>
            </div>
        </Modal>
    );
}

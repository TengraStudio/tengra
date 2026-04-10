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
            <div className="tengra-tip-modal">
                <div className="tengra-tip-modal__icon-wrapper">
                    <div className="tengra-tip-modal__icon-glow" />
                    <Lightbulb className="tengra-tip-modal__icon" />
                    <div className="tengra-tip-modal__badge">
                        <Sparkles className="tengra-tip-modal__badge-icon" />
                    </div>
                </div>

                <div className="tengra-tip-modal__content">
                    <h3 className="tengra-tip-modal__title">
                        <Zap className="tengra-tip-modal__title-icon" />
                        {t('tips.didYouKnow')}
                    </h3>
                    <p className="tengra-tip-modal__text">
                        "{currentTip}"
                    </p>
                </div>

                <div className="tengra-tip-modal__actions">
                    <Button variant="outline" className="tengra-tip-modal__button tengra-tip-modal__button--outline" onClick={() => setIsOpen(false)}>
                        {t('tips.gotIt')}
                    </Button>
                    <Button className="tengra-tip-modal__button tengra-tip-modal__button--primary" onClick={() => setIsOpen(false)}>
                        <Brain className="w-4 h-4 mr-2" />
                        {t('tips.discoverMore')}
                    </Button>
                </div>

                <div className="tengra-tip-modal__footer">
                    <button
                        onClick={() => setIsOpen(false)}
                        className="tengra-tip-modal__dismiss"
                    >
                        {t('tips.dontShowAgain')}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

import { X } from 'lucide-react';
import React, { useState } from 'react';

import { Modal } from '@/components/ui/modal';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/i18n';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

interface OnboardingFlowProps {
    isOpen: boolean;
    onClose: () => void;
    onStartTour?: () => void;
}

const STEPS = [
    {
        title: 'welcome',
        icon: '🏮',
        color: 'from-warning to-destructive',
    },
    {
        title: 'multiModel',
        icon: '🧠',
        color: 'from-info to-primary',
    },
    {
        title: 'workspace',
        icon: '🚀',
        color: 'from-success to-success-light',
    },
    {
        title: 'privacy',
        icon: '🛡️',
        color: 'from-accent to-primary',
    },
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ isOpen, onClose, onStartTour }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const { language } = useAuth();
    const { t } = useTranslation(language);

    const completeOnboarding = () => {
        localStorage.setItem('Tandem-onboarding-complete', 'true');
        // Also update via IPC if available
        window.electron?.ipcRenderer
            ?.invoke?.('settings:update', {
                general: { onboardingCompleted: true },
            })
            .catch(() => {
                /* Settings update is optional */
            });
        onClose();
    };

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            completeOnboarding();
            // Optionally start the detailed tour
            onStartTour?.();
        }
    };

    const handleSkip = () => {
        completeOnboarding();
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const step = STEPS[currentStep];
    // Use camelCase keys: welcome -> welcomeTitle, welcomeDescription
    const titleKey = `onboarding.${step.title}Title` as const;
    const descKey = `onboarding.${step.title}Description` as const;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t(titleKey)} className="max-w-2xl">
            <div className="relative overflow-hidden min-h-[350px] flex flex-col">
                {/* Skip button */}
                <button
                    onClick={handleSkip}
                    className="absolute top-0 right-0 p-2 text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg transition-all z-10"
                    title={t('onboarding.skip')}
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Progress bar */}
                <div className="flex gap-1 mb-8 pr-8">
                    {STEPS.map((_, i) => (
                        <div
                            key={i}
                            className={cn(
                                'h-1.5 flex-1 rounded-full transition-all duration-500',
                                i <= currentStep ? 'bg-primary' : 'bg-muted'
                            )}
                        />
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -20, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="flex-1 flex flex-col items-center text-center space-y-6"
                    >
                        <div
                            className={cn(
                                'w-24 h-24 rounded-3xl bg-gradient-to-br flex items-center justify-center text-5xl shadow-2xl',
                                step.color
                            )}
                        >
                            {step.icon}
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-2xl font-black tracking-tight text-foreground">
                                {t(titleKey)}
                            </h2>
                            <p className="text-muted-foreground text-lg leading-relaxed max-w-md mx-auto">
                                {t(descKey)}
                            </p>
                        </div>
                    </motion.div>
                </AnimatePresence>

                <div className="mt-auto flex justify-between items-center pt-8 border-t border-border/50">
                    <button
                        onClick={handleBack}
                        className={cn(
                            'px-6 py-2 rounded-xl text-sm font-semibold transition-all',
                            currentStep === 0
                                ? 'opacity-0 pointer-events-none'
                                : 'hover:bg-muted text-muted-foreground'
                        )}
                    >
                        {t('common.back')}
                    </button>

                    <button
                        onClick={handleNext}
                        className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        {currentStep === STEPS.length - 1
                            ? t('common.getStarted')
                            : t('common.next')}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

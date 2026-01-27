import React, { useState } from 'react';

import { Modal } from '@/components/ui/modal';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/i18n';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

interface OnboardingFlowProps {
    isOpen: boolean;
    onClose: () => void;
}

const STEPS = [
    {
        title: 'welcome',
        icon: '🏮',
        color: 'from-orange-500 to-red-600',
    },
    {
        title: 'multiModel',
        icon: '🧠',
        color: 'from-blue-500 to-indigo-600',
    },
    {
        title: 'workspace',
        icon: '🚀',
        color: 'from-emerald-500 to-teal-600',
    },
    {
        title: 'privacy',
        icon: '🛡️',
        color: 'from-purple-500 to-pink-600',
    }
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ isOpen, onClose }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const { language } = useAuth();
    const { t } = useTranslation(language);

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            localStorage.setItem('orbit-onboarding-complete', 'true');
            onClose();
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const step = STEPS[currentStep];
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t(`onboarding.${step.title}.title`)}
            className="max-w-2xl"
        >
            <div className="relative overflow-hidden min-h-[350px] flex flex-col">
                {/* Progress bar */}
                <div className="flex gap-1 mb-8">
                    {STEPS.map((_, i) => (
                        <div
                            key={i}
                            className={cn(
                                "h-1.5 flex-1 rounded-full transition-all duration-500",
                                i <= currentStep ? "bg-primary" : "bg-muted"
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
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="flex-1 flex flex-col items-center text-center space-y-6"
                    >
                        <div className={cn(
                            "w-24 h-24 rounded-3xl bg-gradient-to-br flex items-center justify-center text-5xl shadow-2xl",
                            step.color
                        )}>
                            {step.icon}
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-2xl font-black tracking-tight text-foreground">
                                {t(`onboarding.${step.title}.title`)}
                            </h2>
                            <p className="text-muted-foreground text-lg leading-relaxed max-w-md mx-auto">
                                {t(`onboarding.${step.title}.description`)}
                            </p>
                        </div>
                    </motion.div>
                </AnimatePresence>

                <div className="mt-auto flex justify-between items-center pt-8 border-t border-border/50">
                    <button
                        onClick={handleBack}
                        className={cn(
                            "px-6 py-2 rounded-xl text-sm font-semibold transition-all",
                            currentStep === 0 ? "opacity-0 pointer-events-none" : "hover:bg-muted text-muted-foreground"
                        )}
                    >
                        {t('common.back')}
                    </button>

                    <button
                        onClick={handleNext}
                        className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        {currentStep === STEPS.length - 1 ? t('common.getStarted') : t('common.next')}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

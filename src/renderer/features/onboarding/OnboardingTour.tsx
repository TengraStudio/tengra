import {
    ChevronLeft,
    ChevronRight,
    Command,
    Layers,
    MessageSquare,
    ShieldCheck,
    Sparkles,
    X
} from 'lucide-react'
import { useState } from 'react'

import { Language, useTranslation } from '@/i18n'
import { AnimatePresence, motion } from '@/lib/framer-motion-compat'
import { cn } from '@/lib/utils'

interface Step {
    title: string
    description: string
    highlight?: string
    icon: React.ReactNode
}

interface OnboardingTourProps {
    isOpen: boolean
    onClose: () => void
    onComplete: () => void
    language?: Language
}

export function OnboardingTour({ isOpen, onClose, onComplete, language = 'en' }: OnboardingTourProps) {
    const { t } = useTranslation(language)
    const [currentStep, setCurrentStep] = useState(0)

    const steps: Step[] = [
        {
            title: t('onboarding.step1Title'),
            description: t('onboarding.step1Desc'),
            icon: <Sparkles className="w-8 h-8 text-primary" />
        },
        {
            title: t('onboarding.step2Title'),
            description: t('onboarding.step2Desc'),
            icon: <Command className="w-8 h-8 text-blue-400" />,
            highlight: "Cmd+K"
        },
        {
            title: t('onboarding.step3Title'),
            description: t('onboarding.step3Desc'),
            icon: <Layers className="w-8 h-8 text-purple-400" />
        },
        {
            title: t('onboarding.step4Title'),
            description: t('onboarding.step4Desc'),
            icon: <ShieldCheck className="w-8 h-8 text-emerald-400" />
        },
        {
            title: t('onboarding.step5Title'),
            description: t('onboarding.step5Desc'),
            icon: <MessageSquare className="w-8 h-8 text-primary animate-bounce" />
        }
    ]

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1)
        } else {
            onComplete()
        }
    }

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1)
        }
    }

    if (!isOpen) { return null }

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-background/80 backdrop-blur-md"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-lg bg-card border border-border rounded-3xl shadow-2xl overflow-hidden"
                    >
                        {/* Progress Bar */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-muted/20">
                            <motion.div
                                className="h-full bg-primary"
                                initial={{ width: 0 }}
                                animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                                transition={{ duration: 0.3 }}
                            />
                        </div>

                        <div className="p-8 pb-6">
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-2 hover:bg-muted/30 rounded-full text-muted-foreground transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="mb-8 flex justify-center">
                                <div className="p-4 bg-primary/10 rounded-2xl">
                                    {steps[currentStep]!.icon}
                                </div>
                            </div>

                            <div className="text-center space-y-3">
                                <h2 className="text-2xl font-black tracking-tight text-white uppercase italic">
                                    {steps[currentStep]!.title}
                                </h2>
                                <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
                                    {steps[currentStep]!.description}
                                </p>
                            </div>
                        </div>

                        <div className="p-6 bg-muted/5 flex items-center justify-between border-t border-border/50">
                            <button
                                onClick={handleBack}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all rounded-xl",
                                    currentStep === 0 ? "opacity-0 pointer-events-none" : "text-muted-foreground hover:text-white hover:bg-white/5"
                                )}
                            >
                                <ChevronLeft className="w-4 h-4" />
                                {t('onboarding.back')}
                            </button>

                            <div className="flex gap-1.5">
                                {steps.map((_, i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            "w-1.5 h-1.5 rounded-full transition-all duration-300",
                                            i === currentStep ? "bg-primary w-4" : "bg-muted-foreground/30"
                                        )}
                                    />
                                ))}
                            </div>

                            <button
                                onClick={handleNext}
                                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20"
                            >
                                {currentStep === steps.length - 1 ? t('onboarding.letsStart') : t('onboarding.continue')}
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}

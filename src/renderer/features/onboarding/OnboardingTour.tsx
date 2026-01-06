import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    X,
    ChevronRight,
    ChevronLeft,
    Sparkles,
    Command,
    MessageSquare,
    Layers,
    ShieldCheck
} from 'lucide-react'
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
}

export function OnboardingTour({ isOpen, onClose, onComplete }: OnboardingTourProps) {
    const [currentStep, setCurrentStep] = useState(0)

    const steps: Step[] = [
        {
            title: "Orbit'e HoÅŸ Geldiniz",
            description: "GÃ¼Ã§lÃ¼ AI modelleriyle projelerinizi yÃ¶netebileceÄŸiniz modern Ã§alÄ±ÅŸma alanÄ±nÄ±za adÄ±m attÄ±nÄ±z. Sizi kÄ±sa bir tura Ã§Ä±karalÄ±m.",
            icon: <Sparkles className="w-8 h-8 text-primary" />
        },
        {
            title: "Evrensel Komut Paleti",
            description: "Her yerden Cmd+K (veya Ctrl+K) tuÅŸlarÄ±na basarak projelere, sohbetlere ve tÃ¼m AI araÃ§larÄ±na anÄ±nda ulaÅŸÄ±n. Her ÅŸey parmaklarÄ±nÄ±zÄ±n ucunda.",
            icon: <Command className="w-8 h-8 text-blue-400" />,
            highlight: "Cmd+K"
        },
        {
            title: "Esnek Ã‡alÄ±ÅŸma AlanÄ±",
            description: "Panelleri kenarlarÄ±ndan sÃ¼rÃ¼kleyerek istediÄŸiniz gibi boyutlandÄ±rÄ±n. OdaklanmanÄ±z gerektiÄŸinde 'Focus Mode' ile dikkat daÄŸÄ±tÄ±cÄ±larÄ± gizleyin.",
            icon: <Layers className="w-8 h-8 text-purple-400" />
        },
        {
            title: "Gizlilik ve GÃ¼venlik",
            description: "Orbit, yerel modelleri (Ollama) ve bulut modellerini birleÅŸtirir. TÃ¼m yerel verileriniz cihazÄ±nÄ±zda ÅŸifrelenmiÅŸ olarak saklanÄ±r.",
            icon: <ShieldCheck className="w-8 h-8 text-emerald-400" />
        },
        {
            title: "HazÄ±rsÄ±nÄ±z!",
            description: "ArtÄ±k keÅŸfetmeye hazÄ±rsÄ±nÄ±z. Yeni bir sohbet baÅŸlatÄ±n veya mevcut bir projenizi ekleyerek AI Council ile iÅŸbirliÄŸine baÅŸlayÄ±n.",
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

    if (!isOpen) return null

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
                                    {steps[currentStep].icon}
                                </div>
                            </div>

                            <div className="text-center space-y-3">
                                <h2 className="text-2xl font-black tracking-tight text-white uppercase italic">
                                    {steps[currentStep].title}
                                </h2>
                                <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
                                    {steps[currentStep].description}
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
                                Geri
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
                                {currentStep === steps.length - 1 ? 'BaÅŸlayalÄ±m' : 'Devam'}
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}

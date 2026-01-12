import { useEffect } from 'react'
import { motion, AnimatePresence } from '@/lib/framer-motion-compat'
import { Mic, X, Volume2, Loader2, StopCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/i18n'

interface AudioChatOverlayProps {
    isOpen: boolean
    onClose: () => void
    isListening: boolean
    startListening: () => void
    stopListening: () => void
    isSpeaking: boolean
    onStopSpeaking: () => void
    language: 'tr' | 'en'
}

export function AudioChatOverlay({
    isOpen,
    onClose,
    isListening,
    startListening,
    stopListening,
    isSpeaking,
    onStopSpeaking,
    language
}: AudioChatOverlayProps) {
    const { t } = useTranslation(language)

    // Auto-start listening when opened if not speaking
    useEffect(() => {
        if (isOpen && !isListening && !isSpeaking) {
            startListening()
        }
    }, [isOpen, isSpeaking])

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-2xl"
            >
                <button
                    onClick={onClose}
                    className="absolute top-8 right-8 p-4 rounded-full bg-white/5 hover:bg-white/10 transition-all z-50 hover:scale-110 active:scale-95 shadow-xl"
                >
                    <X className="w-8 h-8 text-white/50 hover:text-white" />
                </button>

                <div className="flex flex-col items-center gap-16 relative w-full max-w-lg mx-auto p-4">
                    {/* Visualizer / Status Indicator */}
                    <div className="relative flex items-center justify-center">
                        {/* Pulse Rings */}
                        {(isListening || isSpeaking) && (
                            <>
                                <motion.div
                                    animate={{
                                        scale: [1, 1.8, 1],
                                        opacity: [0.3, 0, 0.3],
                                        rotate: [0, 90, 0]
                                    }}
                                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                    className={cn(
                                        "absolute w-80 h-80 rounded-full blur-[80px]",
                                        isListening ? "bg-primary/30" : "bg-emerald-500/30"
                                    )}
                                />
                                <motion.div
                                    animate={{
                                        scale: [1, 1.4, 1],
                                        opacity: [0.5, 0.1, 0.5]
                                    }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                                    className={cn(
                                        "absolute w-64 h-64 rounded-full blur-[60px]",
                                        isListening ? "bg-primary/20" : "bg-emerald-500/20"
                                    )}
                                />
                            </>
                        )}

                        {/* Central Icon */}
                        <motion.div
                            animate={{
                                scale: isListening ? [1, 1.05, 1] : 1,
                                boxShadow: isListening
                                    ? "0 0 80px rgba(var(--primary), 0.4)"
                                    : (isSpeaking ? "0 0 80px rgba(16, 185, 129, 0.4)" : "none")
                            }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className={cn(
                                "w-40 h-40 rounded-full flex items-center justify-center shadow-2xl transition-all duration-700 relative z-10 border border-white/10",
                                isListening ? "bg-primary text-primary-foreground" :
                                    isSpeaking ? "bg-emerald-500 text-white" :
                                        "bg-zinc-800 text-zinc-400"
                            )}
                        >
                            {isListening ? (
                                <Mic className="w-16 h-16 drop-shadow-lg" />
                            ) : isSpeaking ? (
                                <Volume2 className="w-16 h-16 drop-shadow-lg" />
                            ) : (
                                <Loader2 className="w-16 h-16 animate-spin opacity-50" />
                            )}
                        </motion.div>
                    </div>

                    {/* Status Text */}
                    <div className="text-center space-y-6">
                        <motion.h2
                            key={isListening ? 'listen' : isSpeaking ? 'speak' : 'process'}
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            className="text-4xl font-black tracking-tight uppercase font-sans"
                        >
                            {isListening ? t('audioChat.listening') : isSpeaking ? t('audioChat.speaking') : t('audioChat.thinking')}
                        </motion.h2>
                        <p className="text-muted-foreground/80 text-xl max-w-[320px] mx-auto font-medium leading-relaxed">
                            {isListening ? t('audioChat.listeningDesc') : isSpeaking ? t('audioChat.speakingDesc') : t('audioChat.thinkingDesc')}
                        </p>
                    </div>

                    {/* Controls */}
                    <div className="flex gap-4">
                        {isSpeaking && (
                            <button
                                onClick={onStopSpeaking}
                                className="px-10 py-4 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 font-bold transition-all flex items-center gap-3 shadow-lg active:scale-95"
                            >
                                <StopCircle className="w-6 h-6" />
                                {t('audioChat.stopSpeaking')}
                            </button>
                        )}
                        {!isListening && !isSpeaking && (
                            <button
                                onClick={startListening}
                                className="px-10 py-4 rounded-2xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 font-bold transition-all flex items-center gap-3 shadow-lg active:scale-95"
                            >
                                <Mic className="w-6 h-6" />
                                {t('audioChat.resumeListening')}
                            </button>
                        )}
                        {isListening && (
                            <button
                                onClick={stopListening}
                                className="px-10 py-4 rounded-2xl bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10 font-bold transition-all flex items-center gap-3 shadow-lg active:scale-95"
                            >
                                <StopCircle className="w-6 h-6" />
                                {t('audioChat.pauseListening')}
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    )
}

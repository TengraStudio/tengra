import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, X, Volume2, Loader2, StopCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AudioChatOverlayProps {
    isOpen: boolean
    onClose: () => void
    isListening: boolean
    startListening: () => void
    stopListening: () => void
    isSpeaking: boolean
    onStopSpeaking: () => void
    currentTranscription?: string // Optional for future
}

export function AudioChatOverlay({
    isOpen,
    onClose,
    isListening,
    startListening,
    stopListening,
    isSpeaking,
    onStopSpeaking
}: AudioChatOverlayProps) {
    // Auto-start listening when opened if not speaking
    useEffect(() => {
        if (isOpen && !isListening && !isSpeaking) {
            startListening()
        }
    }, [isOpen, isSpeaking]) // Depend on isSpeaking to auto-listen after AI stops speaking (hands-free loop)

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-xl"
            >
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-4 rounded-full bg-white/5 hover:bg-white/10 transition-colors z-50"
                >
                    <X className="w-8 h-8 text-white/50 hover:text-white" />
                </button>

                <div className="flex flex-col items-center gap-12 relative w-full max-w-lg mx-auto">
                    {/* Visualizer / Status Indicator */}
                    <div className="relative flex items-center justify-center">
                        {/* Pulse Rings */}
                        {isListening && (
                            <>
                                <motion.div
                                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                    className="absolute w-64 h-64 rounded-full bg-primary/20 blur-3xl"
                                />
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1], opacity: [0.8, 0.2, 0.8] }}
                                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                                    className="absolute w-48 h-48 rounded-full bg-primary/10 blur-2xl"
                                />
                            </>
                        )}
                        {isSpeaking && (
                            <motion.div
                                animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.3, 0.6] }}
                                transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute w-56 h-56 rounded-full bg-emerald-500/20 blur-3xl"
                            />
                        )}

                        {/* Central Icon */}
                        <motion.div
                            animate={{ scale: isListening ? 1.1 : 1 }}
                            className={cn(
                                "w-32 h-32 rounded-full flex items-center justify-center shadow-2xl transition-colors duration-500 relative z-10",
                                isListening ? "bg-primary text-primary-foreground shadow-primary/40" :
                                    isSpeaking ? "bg-emerald-500 text-white shadow-emerald-500/40" :
                                        "bg-zinc-800 text-zinc-400"
                            )}
                        >
                            {isListening ? (
                                <Mic className="w-12 h-12" />
                            ) : isSpeaking ? (
                                <Volume2 className="w-12 h-12" />
                            ) : (
                                <Loader2 className="w-12 h-12 animate-spin opacity-50" />
                            )}
                        </motion.div>
                    </div>

                    {/* Status Text */}
                    <div className="text-center space-y-4">
                        <motion.h2
                            key={isListening ? 'listen' : isSpeaking ? 'speak' : 'process'}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-3xl font-bold tracking-tight"
                        >
                            {isListening ? "Listening..." : isSpeaking ? "Speaking..." : "Thinking..."}
                        </motion.h2>
                        <p className="text-muted-foreground text-lg max-w-sm mx-auto">
                            {isListening ? "Kusursuz bir deneyim iÃ§in sadece konuÅŸun." : isSpeaking ? "Dinlemek iÃ§in dokunarak durdurabilirsiniz." : "YanÄ±t hazÄ±rlanÄ±yor..."}
                        </p>
                    </div>

                    {/* Controls */}
                    <div className="flex gap-4">
                        {isSpeaking && (
                            <button
                                onClick={onStopSpeaking}
                                className="px-8 py-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 font-medium transition-all flex items-center gap-2"
                            >
                                <StopCircle className="w-5 h-5" />
                                Stop Speaking
                            </button>
                        )}
                        {!isListening && !isSpeaking && (
                            <button
                                onClick={startListening}
                                className="px-8 py-3 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 font-medium transition-all flex items-center gap-2"
                            >
                                <Mic className="w-5 h-5" />
                                Resume Listening
                            </button>
                        )}
                        {isListening && (
                            <button
                                onClick={stopListening}
                                className="px-8 py-3 rounded-xl bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10 font-medium transition-all flex items-center gap-2"
                            >
                                <StopCircle className="w-5 h-5" />
                                Pause Listening
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    )
}

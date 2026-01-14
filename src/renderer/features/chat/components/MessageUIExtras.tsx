import { Sparkles } from 'lucide-react'

import { useTranslation } from '@/i18n'

export const TypingDots = () => {
    const { t } = useTranslation() // This might fail if outside provider, but assuming context exists. Better pass language or use hook.
    // MessageUIExtras seems to be stateless utility components?
    // If they are used inside components under I18nextProvider, hook works.
    return (
        <div className="flex gap-2 items-center px-2 py-3">
            <div className="flex gap-1.5 items-center">
                <div className="w-2 h-2 bg-gradient-to-r from-primary to-purple-500 rounded-full animate-bounce [animation-delay:-0.3s] shadow-lg shadow-primary/30" />
                <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-bounce [animation-delay:-0.15s] shadow-lg shadow-purple-500/30" />
                <div className="w-2 h-2 bg-gradient-to-r from-pink-500 to-primary rounded-full animate-bounce shadow-lg shadow-pink-500/30" />
            </div>
            <span className="text-[10px] text-muted-foreground/50 font-medium animate-pulse">{t('messageBubble.thinking')}</span>
        </div>
    )
}

export const ResponseProgress = () => (
    <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden bg-primary/5">
        <div className="h-full w-full bg-primary/40 animate-[shimmer_2s_infinite_linear]" style={{ background: 'linear-gradient(90deg, transparent 0%, var(--primary) 50%, transparent 100%)', backgroundSize: '200% 100%' }} />
    </div>
)

export const ImageSkeleton = () => {
    const { t } = useTranslation()
    return (
        <div className="w-[300px] h-[300px] rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-4 relative overflow-hidden group/skel">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-slide-shimmer" />
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center animate-pulse">
                <Sparkles className="w-6 h-6 text-primary/40" />
            </div>
            <div className="space-y-2 text-center">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 animate-pulse">{t('messageBubble.orbitDrawing')}</div>
                <div className="flex gap-1 justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/30 animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/30 animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/30 animate-bounce" />
                </div>
            </div>
        </div>
    )
}

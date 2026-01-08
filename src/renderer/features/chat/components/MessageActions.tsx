import React, { useState } from 'react'
import { Copy, Check, Bookmark, ThumbsUp, ThumbsDown, Code2, Smile, Volume2, VolumeX, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ActionButtonProps {
    title?: string
    onClick: () => void
    children: React.ReactNode
    active?: boolean
    activeClassName?: string
}

const ActionButton: React.FC<ActionButtonProps> = ({ title, onClick, children, active, activeClassName }) => (
    <button
        onClick={onClick}
        className={cn(
            "p-1.5 rounded-lg transition-all border border-transparent backdrop-blur-sm",
            active ? (activeClassName || "bg-primary/10 text-primary border-primary/20") : "bg-muted/20 hover:bg-muted/40 text-muted-foreground hover:text-foreground"
        )}
        title={title}
    >
        {children}
    </button>
)

export const CopyButton = ({ text }: { text: string }) => {
    const [copied, setCopied] = useState(false)
    const handleCopy = async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }
    return (
        <ActionButton title="Kopyala" onClick={handleCopy}>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </ActionButton>
    )
}

export const BookmarkButton = ({ active, onClick }: { active: boolean; onClick: () => void }) => (
    <ActionButton
        title={active ? "Yer iÅŸaretini kaldÄ±r" : "Yer iÅŸareti ekle"}
        onClick={onClick}
        active={active}
        activeClassName="text-amber-400 bg-amber-400/10 border-amber-400/20 shadow-[0_0_10px_rgba(251,191,36,0.1)]"
    >
        <Bookmark className={cn("w-3.5 h-3.5", active && "fill-current")} />
    </ActionButton>
)

export const RatingButtons = ({ rating, onRate }: { rating?: 1 | -1 | 0; onRate: (val: 1 | -1 | 0) => void }) => (
    <div className="flex items-center gap-1 border-l border-white/5 pl-2 ml-1">
        <button
            onClick={() => onRate(rating === 1 ? 0 : 1)}
            className={cn(
                "p-1.5 rounded-md transition-all duration-200",
                rating === 1 ? "text-emerald-400 bg-emerald-400/10" : "text-zinc-400 hover:text-emerald-400 hover:bg-emerald-400/5"
            )}
            title="Ä°yi cevap"
        >
            <ThumbsUp className={cn("w-3.5 h-3.5", rating === 1 && "fill-current")} />
        </button>
        <button
            onClick={() => onRate(rating === -1 ? 0 : -1)}
            className={cn(
                "p-1.5 rounded-md transition-all duration-200",
                rating === -1 ? "text-red-400 bg-red-400/10" : "text-zinc-400 hover:text-red-400 hover:bg-red-400/5"
            )}
            title="KÃ¶tÃ¼ cevap"
        >
            <ThumbsDown className={cn("w-3.5 h-3.5", rating === -1 && "fill-current")} />
        </button>
    </div>
)

export const CopyMarkdownButton = ({ text, role }: { text: string; role: string }) => {
    const [copied, setCopied] = useState(false)
    const handleCopy = async () => {
        const markdown = `**${role === 'user' ? 'KullanÄ±cÄ±' : 'Asistan'}:**\n\n${text}`
        await navigator.clipboard.writeText(markdown)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }
    return (
        <ActionButton title="Markdown olarak kopyala" onClick={handleCopy}>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Code2 className="w-3.5 h-3.5" />}
        </ActionButton>
    )
}

export const MessageActionsGroup = ({
    displayContent,
    role,
    isBookmarked,
    onBookmark,
    rating,
    onRate,
    isSpeaking,
    onSpeak,
    onStop,
    onReact
}: any) => {
    return (
        <div className="absolute left-full ml-4 top-0 flex flex-col gap-1 opacity-0 group-hover/bubble:opacity-100 transition-all duration-200">
            <ActionButton
                title={isSpeaking ? "Durdur" : "Sesli Oku"}
                onClick={isSpeaking ? onStop : () => onSpeak?.(displayContent)}
                active={isSpeaking}
            >
                {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </ActionButton>

            <CopyButton text={displayContent} />
            <CopyMarkdownButton text={displayContent} role={role} />
            <BookmarkButton active={!!isBookmarked} onClick={() => onBookmark?.(!isBookmarked)} />

            <div className="relative group/react">
                <ActionButton title="Tepki Ver" onClick={() => { }}>
                    <Smile className="w-3.5 h-3.5" />
                </ActionButton>
                <div className="absolute bottom-full mb-2 bg-[#1a1b26] border border-border/50 rounded-full px-2 py-1 shadow-xl flex gap-1 opacity-0 group-hover/react:opacity-100 pointer-events-none group-hover/react:pointer-events-auto transition-all scale-90 group-hover/react:scale-100 origin-bottom">
                    {['ğŸ‘', 'ğŸ‘', 'â¤ï¸', 'ğŸ‰', 'ğŸš€'].map(emoji => (
                        <button
                            key={emoji}
                            onClick={() => onReact?.(emoji)}
                            className="hover:scale-125 transition-transform text-sm p-1"
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </div>

            {/* Regenerate Skeleton */}
            {role === 'assistant' && (
                <ActionButton title="Yeniden Oluştur (Geçici)" onClick={() => alert('Regenerate feature coming soon!')}>
                    <RotateCcw className="w-3.5 h-3.5" />
                </ActionButton>
            )}

            {onRate && <RatingButtons rating={rating} onRate={onRate} />}
        </div>
    )
}

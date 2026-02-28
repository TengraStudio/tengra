import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Language, useTranslation } from '@/i18n'
import { cn } from '@/lib/utils'
import { Message } from '@/types'

interface ChatSearchOverlayProps {
    messages: Message[]
    language: Language
    onHighlightMessage?: (messageId: string, matchIndex: number) => void
    onClose: () => void
    isOpen: boolean
}

interface SearchMatch {
    messageId: string
    index: number
}

/** Extract text content from a message */
function getMessageText(message: Message): string {
    if (typeof message.content === 'string') return message.content
    return message.content
        .filter((p) => p.type === 'text')
        .map((p) => ('text' in p ? p.text : ''))
        .join(' ')
}

export const ChatSearchOverlay: React.FC<ChatSearchOverlayProps> = ({
    messages,
    language,
    onHighlightMessage,
    onClose,
    isOpen
}) => {
    const { t } = useTranslation(language)
    const inputRef = useRef<HTMLInputElement>(null)
    const [query, setQuery] = useState('')
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0)

    const matches = useMemo<SearchMatch[]>(() => {
        if (!query.trim()) return []
        const lowerQuery = query.toLowerCase()
        const result: SearchMatch[] = []
        for (const message of messages) {
            if (message.role === 'system') continue
            const text = getMessageText(message).toLowerCase()
            let startPos = 0
            let foundIndex = text.indexOf(lowerQuery, startPos)
            while (foundIndex !== -1) {
                result.push({ messageId: message.id, index: foundIndex })
                startPos = foundIndex + 1
                foundIndex = text.indexOf(lowerQuery, startPos)
            }
        }
        return result
    }, [query, messages])

    useEffect(() => {
        if (matches.length > 0) {
            setCurrentMatchIndex(0)
        }
    }, [matches.length])

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus()
        } else {
            setQuery('')
            setCurrentMatchIndex(0)
        }
    }, [isOpen])

    useEffect(() => {
        if (matches.length > 0 && onHighlightMessage) {
            const match = matches[currentMatchIndex]
            onHighlightMessage(match.messageId, match.index)
        }
    }, [currentMatchIndex, matches, onHighlightMessage])

    const goToNext = useCallback(() => {
        if (matches.length === 0) return
        setCurrentMatchIndex((prev) => (prev + 1) % matches.length)
    }, [matches.length])

    const goToPrev = useCallback(() => {
        if (matches.length === 0) return
        setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length)
    }, [matches.length])

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
                e.shiftKey ? goToPrev() : goToNext()
            }
            if (e.key === 'Escape') {
                onClose()
            }
        },
        [goToNext, goToPrev, onClose]
    )

    if (!isOpen) return null

    const matchLabel =
        matches.length > 0
            ? t('chatSearch.matchCount', {
                  current: String(currentMatchIndex + 1),
                  total: String(matches.length)
              })
            : query.trim()
              ? t('chatSearch.noResults')
              : ''

    return (
        <div
            className={cn(
                'absolute top-0 right-4 z-30 flex items-center gap-1.5',
                'bg-popover border border-border rounded-b-lg shadow-lg px-3 py-2'
            )}
        >
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('chatSearch.placeholder')}
                className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-48"
            />
            {matchLabel && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">{matchLabel}</span>
            )}
            <button
                onClick={goToPrev}
                disabled={matches.length === 0}
                className="p-1 rounded hover:bg-accent disabled:opacity-30"
                aria-label={t('chatSearch.previous')}
            >
                <ChevronUp className="w-4 h-4" />
            </button>
            <button
                onClick={goToNext}
                disabled={matches.length === 0}
                className="p-1 rounded hover:bg-accent disabled:opacity-30"
                aria-label={t('chatSearch.next')}
            >
                <ChevronDown className="w-4 h-4" />
            </button>
            <button
                onClick={onClose}
                className="p-1 rounded hover:bg-accent"
                aria-label={t('common.close')}
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    )
}

ChatSearchOverlay.displayName = 'ChatSearchOverlay'

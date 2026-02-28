import { memo } from 'react';
import { Bookmark } from 'lucide-react';
import { Message } from '@/types';
import { useTranslation, Language } from '@/i18n';

export interface MessageFooterProps {
    message: Message;
    displayContent: string;
    language: Language;
    isStreaming?: boolean;
    streamingSpeed?: number | null;
}

/**
 * MessageFooter component
 * 
 * Displays metadata at the bottom of the AI message, including:
 * - Timestamp
 * - Token estimate
 * - Model name
 * - Response time
 * - Bookmark status
 * - Streaming speed
 */
export const MessageFooter = memo(
    ({ message, displayContent, language, isStreaming, streamingSpeed }: MessageFooterProps) => {
        const { t } = useTranslation(language);
        return (
            <div className="flex items-center gap-3 mt-2 text-xxs text-muted-foreground/40 font-medium">
                <span>
                    {new Date(message.timestamp).toLocaleTimeString(t('common.locale'), {
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </span>
                <span className="h-1 rounded-full bg-muted-foreground/20" />
                <span>
                    {t('messageBubble.tokenEstimate', {
                        count: Math.ceil(displayContent.length / 4),
                    })}
                </span>
                {message.model && (
                    <>
                        <span className="h-1 rounded-full bg-muted-foreground/20" />
                        <span className="truncate max-w-[120px]">{message.model}</span>
                    </>
                )}
                {message.responseTime && (
                    <>
                        <span className="h-1 rounded-full bg-muted-foreground/20" />
                        <span className="text-success/60">
                            {(message.responseTime / 1000).toFixed(1)}
                            {t('messageBubble.secondsShort')}
                        </span>
                    </>
                )}
                {message.isBookmarked && (
                    <>
                        <span className="h-1 rounded-full bg-muted-foreground/20" />
                        <span className="text-warning/60 flex items-center gap-1">
                            <Bookmark className="w-2.5 h-2.5 fill-current" />
                        </span>
                    </>
                )}
                {isStreaming && streamingSpeed && (
                    <>
                        <span className="h-1 rounded-full bg-muted-foreground/20" />
                        <span className="text-primary animate-pulse font-bold">
                            {streamingSpeed.toFixed(1)} {t('messageBubble.tokensPerSecond')}
                        </span>
                    </>
                )}
            </div>
        );
    }
);

MessageFooter.displayName = 'MessageFooter';

import { FileCode, Sparkles } from 'lucide-react';
import { memo } from 'react';

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

export interface MessageSourcesProps {
    sources: string[];
    onSourceClick?: (p: string) => void;
    t: TranslationFn;
}

/**
 * MessageSources component
 * 
 * Renders a list of chips representing source files used for generating the message.
 * Clicking a chip triggers the onSourceClick callback.
 */
export const MessageSources = memo(
    ({
        sources,
        onSourceClick,
        t,
    }: MessageSourcesProps) => {
        if (sources.length === 0) {
            return null;
        }
        return (
            <div className="flex flex-wrap gap-2 mt-3 animate-fade-in">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-primary/5 border border-primary/10 text-xxs text-primary font-bold uppercase tracking-wider mb-1">
                    <Sparkles className="w-3 h-3" />
                    {t('chat.sources')}
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {sources.map((path, idx) => (
                        <button
                            key={idx}
                            onClick={() => onSourceClick?.(path)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/30 border border-border/30 hover:border-primary/50 hover:bg-primary/5 transition-all text-xs text-muted-foreground hover:text-foreground group/chip"
                            title={path}
                        >
                            <FileCode className="w-3.5 h-3.5 text-primary/60 group-hover/chip:text-primary" />
                            <span>{path.split(/[\\/]/).pop() ?? path}</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }
);

MessageSources.displayName = 'MessageSources';

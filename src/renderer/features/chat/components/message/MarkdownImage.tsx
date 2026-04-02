import { Code2 } from 'lucide-react';
import { memo } from 'react';

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

export interface MarkdownImageProps {
    src?: string;
    alt?: string;
    onCodeConvert?: (url: string) => void;
    t: TranslationFn;
}

/**
 * MarkdownImage component
 * 
 * Renders an image within markdown content with optional "convert to code" functionality.
 * Clicking the image opens it in an external browser.
 */
export const MarkdownImage = memo(
    ({
        src,
        alt,
        onCodeConvert,
        t,
    }: MarkdownImageProps) => (
        <span className="block my-2 relative group/image">
            <img
                src={src}
                alt={alt ?? t('messageBubble.imageAlt')}
                className="max-w-full max-h-96 rounded-lg border border-border/50 cursor-pointer hover:opacity-90 transition-opacity whitespace-pre-wrap"
                onClick={() => {
                    if (src) {
                        window.electron.openExternal(src);
                    }
                }}
            />
            {alt && (
                <span className="text-xs text-muted-foreground mt-1 block font-medium">{alt}</span>
            )}
            {src && onCodeConvert && (
                <button
                    onClick={e => {
                        e.stopPropagation();
                        onCodeConvert(src);
                    }}
                    className="absolute top-2 right-2 bg-background/60 hover:bg-background/80 backdrop-blur-md border border-border/50 text-foreground px-3 py-1.5 rounded-lg text-xs font-bold opacity-0 group-hover/image:opacity-100 transition-all flex items-center gap-2 transform translate-y-2 group-hover/image:translate-y-0"
                >
                    <Code2 className="w-3.5 h-3.5" />
                    {t('messageBubble.convertToCode')}
                </button>
            )}
        </span>
    )
);

MarkdownImage.displayName = 'MarkdownImage';

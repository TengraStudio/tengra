/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconCode } from '@tabler/icons-react';
import { memo } from 'react';

/* Batch-02: Extracted Long Classes */
const C_MARKDOWNIMAGE_1 = "max-w-full max-h-96 rounded-lg border border-border/50 cursor-pointer hover:opacity-90 transition-opacity whitespace-pre-wrap";
const C_MARKDOWNIMAGE_2 = "absolute top-2 right-2 bg-background/60 hover:bg-background/80 backdrop-blur-md border border-border/50 text-foreground px-3 py-1.5 rounded-lg typo-caption font-bold opacity-0 group-hover/image:opacity-100 transition-all flex items-center gap-2 transform translate-y-2 group-hover/image:translate-y-0";


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
                className={C_MARKDOWNIMAGE_1}
                onClick={() => {
                    if (src) {
                        window.electron.openExternal(src);
                    }
                }}
            />
            {alt && (
                <span className="typo-caption text-muted-foreground mt-1 block font-medium">{alt}</span>
            )}
            {src && onCodeConvert && (
                <button
                    onClick={e => {
                        e.stopPropagation();
                        onCodeConvert(src);
                    }}
                    className={C_MARKDOWNIMAGE_2}
                >
                    <IconCode className="w-3.5 h-3.5" />
                    {t('messageBubble.convertToCode')}
                </button>
            )}
        </span>
    )
);

MarkdownImage.displayName = 'MarkdownImage';

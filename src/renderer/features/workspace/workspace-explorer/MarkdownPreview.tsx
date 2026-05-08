/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React from 'react';
import { MarkdownContent } from '@/features/chat/components/message/MarkdownContent';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface MarkdownPreviewProps {
    content: string;
    t: (key: string) => string;
    className?: string;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
    content,
    t,
    className,
}) => {
    return (
        <div className={cn("h-full flex flex-col bg-background/95 backdrop-blur-sm overflow-hidden border-l border-border/30", className)}>
            <ScrollArea className="flex-1">
                <div className="p-12 max-w-5xl mx-auto min-h-full bg-background/40">
                    <div className="prose prose-lg dark:prose-invert max-w-none 
                        prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-foreground
                        prose-headings:mt-16 prose-headings:mb-10
                        prose-p:text-foreground/90 prose-p:leading-loose prose-p:my-12 prose-p:tracking-wide
                        prose-li:text-foreground/90 prose-li:leading-relaxed prose-li:my-6 prose-li:tracking-wide
                        prose-strong:text-foreground prose-strong:font-bold
                        prose-code:text-primary prose-code:bg-primary/5 prose-code:px-2 prose-code:py-1 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none
                        prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border/30 prose-pre:my-12
                        prose-img:rounded-3xl prose-img:shadow-2xl prose-img:my-12
                        prose-a:text-primary prose-a:no-underline hover:prose-a:underline font-medium
                        prose-ul:my-8 prose-ol:my-8
                    ">
                        <MarkdownContent
                            content={content}
                            t={(key) => t(key)}
                        />
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
};

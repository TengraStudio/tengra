/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';

import { cn } from '@/lib/utils';


interface ToolOutputVirtualizerProps {
    content: string;
    maxHeight?: string;
    className?: string;
    isDark?: boolean;
}

export const ToolOutputVirtualizer: React.FC<ToolOutputVirtualizerProps> = ({
    content,
    maxHeight = '400px',
    className,
    isDark = true,
}) => {
    const lines = useMemo(() => content.split('\n'), [content]);

    // Only virtualize if content is long enough to justify it
    if (lines.length < 50) {
        return (
            <pre
                className={cn(
                    'p-4 m-0 overflow-y-auto font-mono text-sm leading-relaxed rounded-lg border border-border/20 shadow-inner break-all whitespace-pre-wrap custom-scrollbar',
                    isDark ? 'bg-zinc-950 text-zinc-300 shadow-black/20' : 'bg-muted/30 text-foreground shadow-black/5',
                    className
                )}
                style={{ maxHeight }}
            >
                {content}
            </pre>
        );
    }

    return (
        <div
            className={cn(
                'rounded-lg border border-border/20 shadow-inner overflow-hidden font-mono text-sm leading-relaxed',
                isDark ? 'bg-zinc-950 text-zinc-300 shadow-black/20' : 'bg-muted/30 text-foreground shadow-black/5',
                className
            )}
            style={{ height: maxHeight }}
        >
            <Virtuoso
                className="h-full w-full custom-scrollbar"
                totalCount={lines.length}
                data={lines}
                itemContent={(index, line) => (
                    <div className="flex w-full py-0.5 px-4 hover:bg-muted/50 transition-colors">
                        <span className="shrink-0 w-10 min-w-10 text-right pr-4 text-sm tabular-nums text-muted-foreground/50 border-r border-border/10 select-none cursor-default font-medium">
                            {index + 1}
                        </span>
                        <span className="flex-1 pl-4 break-all whitespace-pre-wrap break-words min-w-0">{line || ' '}</span>
                    </div>
                )}
            />
        </div>
    );
};

ToolOutputVirtualizer.displayName = 'ToolOutputVirtualizer';


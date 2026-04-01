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
                    'p-3 rounded-lg border font-mono text-xxs overflow-auto custom-scrollbar',
                    isDark
                        ? 'bg-card/70 border-border/40 text-warning-light/70'
                        : 'bg-muted/30 border-border/50 text-foreground/80',
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
                    'rounded-lg border font-mono text-xxs overflow-hidden flex flex-col',
                    isDark
                        ? 'bg-card/70 border-border/40 text-warning-light/70'
                        : 'bg-muted/30 border-border/50 text-foreground/80',
                    className
                )}
            style={{ height: maxHeight }}
        >
            <Virtuoso
                style={{ height: '100%', width: '100%' }}
                totalCount={lines.length}
                data={lines}
                itemContent={(index, line) => (
                    <div className="px-3 py-0.5 whitespace-pre break-all hover:bg-muted/20 transition-colors leading-tight">
                        <span className="inline-block w-8 mr-4 text-right text-muted-foreground/30 select-none border-r border-border/40 pr-2">
                            {index + 1}
                        </span>
                        <span>{line || ' '}</span>
                    </div>
                )}
                className="custom-scrollbar"
            />
        </div>
    );
};

ToolOutputVirtualizer.displayName = 'ToolOutputVirtualizer';

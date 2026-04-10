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
                    'tengra-tool-output custom-scrollbar',
                    isDark ? 'tengra-tool-output--dark' : 'tengra-tool-output--light',
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
                'tengra-tool-output-virtualized',
                isDark ? 'tengra-tool-output-virtualized--dark' : 'tengra-tool-output-virtualized--light',
                className
            )}
            style={{ height: maxHeight }}
        >
            <Virtuoso
                style={{ height: '100%', width: '100%' }}
                totalCount={lines.length}
                data={lines}
                itemContent={(index, line) => (
                    <div className="tengra-tool-output__line">
                        <span className="tengra-tool-output__line-number">
                            {index + 1}
                        </span>
                        <span className="tengra-tool-output__line-content">{line || ' '}</span>
                    </div>
                )}
                className="custom-scrollbar"
            />
        </div>
    );
};

ToolOutputVirtualizer.displayName = 'ToolOutputVirtualizer';

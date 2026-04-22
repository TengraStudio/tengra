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
import { cn } from '@renderer/lib/utils';

interface DiffLineProps {
    line: string;
    idx: number;
}

export const GitDiffLine: React.FC<DiffLineProps> = ({ line, idx }) => {
    const isAddition = line.startsWith('+') && !line.startsWith('+++');
    const isDeletion = line.startsWith('-') && !line.startsWith('---');
    const isHeader = /^(diff --git|index|---|---|\+\+\+|@@)/.test(line);
    const hasPrefix = isAddition || isDeletion || line.startsWith(' ');

    return (
        <div
            key={idx}
            className={cn(
                "whitespace-pre font-mono text-[12px] leading-6 px-4 border-l-4 border-transparent transition-colors min-h-[1.5rem] flex items-center",
                isAddition && "text-[#3fb950] bg-[#2ea04326] border-[#3fb950]",
                isDeletion && "text-[#f85149] bg-[#f851491a] border-[#f85149]",
                isHeader && "text-[#7d8590] font-bold bg-[#161b22] mt-4 first:mt-0 py-1 border-border/20 italic"
            )}
        >
            <span className="opacity-40 select-none mr-4 w-4 text-center">
                {isAddition ? '+' : isDeletion ? '-' : ''}
            </span>
            <span className="flex-1">{hasPrefix ? line.substring(1) : line}</span>
        </div>
    );
};

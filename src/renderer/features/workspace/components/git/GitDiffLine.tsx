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

import { cn } from '@/lib/utils';

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
                "whitespace-pre font-mono typo-overline leading-6 px-4 border-l-4 border-transparent transition-colors min-h-6 flex items-center",
                isAddition && "text-git-diff-added-text bg-git-diff-added-bg border-git-diff-added-border",
                isDeletion && "text-git-diff-deleted-text bg-git-diff-deleted-bg border-git-diff-deleted-border",
                isHeader && "text-git-diff-neutral-text font-bold bg-git-diff-neutral-bg mt-4 first:mt-0 py-1 border-border/20 "
            )}>
            <span className="opacity-40 select-none mr-4 w-4 text-center">
                {isAddition ? '+' : isDeletion ? '-' : ''}
            </span>
            <span className="flex-1">{hasPrefix ? line.substring(1) : line}</span>
        </div>
    );
};


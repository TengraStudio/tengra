/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { cn } from '@/lib/utils';

interface DiffLineProps {
    line: string;
    idx: number;
}

export const GitDiffLine: React.FC<DiffLineProps> = ({ line, idx }) => {
    const isAddition = line.startsWith('+') && !line.startsWith('+++');
    const isDeletion = line.startsWith('-') && !line.startsWith('---');
    const isHeader = /^(diff --git|index|---|---|\+\+\+|@@)/.test(line);

    return (
        <div
            key={idx}
            className={cn(
                "whitespace-pre",
                isAddition && "text-success bg-success/5",
                isDeletion && "text-destructive bg-destructive/5",
                isHeader && "text-primary font-bold opacity-80 mt-2 first:mt-0"
            )}
        >
            {line || ' '}
        </div>
    );
};

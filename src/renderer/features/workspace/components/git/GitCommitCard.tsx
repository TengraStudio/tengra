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

import { GitCommitInfo } from './types';

interface CommitCardProps {
    commit: GitCommitInfo;
    isSelected: boolean;
    onSelect: (commit: GitCommitInfo) => void;
}

export const GitCommitCard: React.FC<CommitCardProps> = ({ commit, isSelected, onSelect }) => {
    const date = new Date(commit.date);

    return (
        <div
            onClick={() => onSelect(commit)}
            className={cn(
                "flex flex-col gap-0.5 py-2 px-3 cursor-pointer transition-colors border-l-2 select-none group",
                isSelected
                    ? "bg-primary/10 border-primary"
                    : "border-transparent hover:bg-muted/40"
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <span className={cn(
                    "text-xs truncate",
                    isSelected ? "text-primary font-medium" : "text-foreground/90"
                )}>
                    {commit.message}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground/40 shrink-0">
                    {commit.hash.substring(0, 7)}
                </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground/50">
                <span className="truncate">{commit.author}</span>
                <span>{date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            </div>
        </div>
    );
};


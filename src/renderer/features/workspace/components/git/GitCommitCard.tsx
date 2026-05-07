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
                "flex flex-col gap-1.5 p-3 cursor-pointer transition-all border-l-2 border-transparent select-none",
                isSelected
                    ? "bg-primary/5 border-primary"
                    : "hover:bg-muted/50"
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <span className={cn(
                    "text-sm font-semibold truncate",
                    isSelected ? "text-primary" : "text-foreground/90"
                )}>
                    {commit.message}
                </span>
                <span className="typo-overline font-mono text-muted-foreground/50 shrink-0">
                    {commit.hash.substring(0, 7)}
                </span>
            </div>
            <div className="flex items-center justify-between typo-overline text-muted-foreground/40 font-medium">
                <span className="truncate max-w-120">{commit.author}</span>
                <span>{date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            </div>
        </div>
    );
};


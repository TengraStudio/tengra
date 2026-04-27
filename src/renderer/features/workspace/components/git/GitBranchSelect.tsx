/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconGitBranch } from '@tabler/icons-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BranchSelectProps {
    branch: string | null;
    branches: string[];
    isCheckingOut: boolean;
    handleCheckout: (branch: string) => Promise<void>;
}

export const GitBranchSelect: React.FC<BranchSelectProps> = ({ branch, branches, isCheckingOut, handleCheckout }) => {
    if (branches.length === 0) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/20 border border-border/10">
                <IconGitBranch className="w-3.5 h-3.5 text-muted-foreground/40" />
                <span className="text-sm font-semibold text-foreground/60">{branch ?? 'N/A'}</span>
            </div>
        );
    }

    return (
        <Select
            value={branch ?? ''}
            onValueChange={(value) => { void handleCheckout(value); }}
            disabled={isCheckingOut}
        >
            <SelectTrigger className="h-10 rounded-xl border-border/20 bg-background/40 hover:bg-muted/40 transition-all font-semibold text-sm focus:ring-indigo-500/20">
                <SelectValue>
                    <div className="flex items-center gap-2">
                        <IconGitBranch className="w-3.5 h-3.5 text-indigo-400/60" />
                        <span className="text-foreground/80">{branch ?? 'Select Branch'}</span>
                    </div>
                </SelectValue>
            </SelectTrigger>
            <SelectContent className="border-border/40 backdrop-blur-xl bg-background/90 min-w-200">
                {branches.map((b: string) => {
                    const isSelected = b === branch;
                    return (
                        <SelectItem
                            key={b}
                            value={b}
                            className="text-sm focus:bg-indigo-500/10 focus:text-indigo-400 py-2.5"
                        >
                            <div className="flex items-center justify-between w-full">
                                <span>{b}</span>
                                {isSelected && <Badge variant="outline" className="ml-2 h-4 px-1 border-none bg-indigo-500/10 text-indigo-400 typo-overline uppercase">Active</Badge>}
                            </div>
                        </SelectItem>
                    );
                })}
            </SelectContent>
        </Select>
    );
};

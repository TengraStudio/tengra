/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Check,GitBranch } from 'lucide-react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BranchSelectProps {
    branch: string | null;
    branches: string[];
    isCheckingOut: boolean;
    handleCheckout: (branch: string) => Promise<void>;
}

export const GitBranchSelect: React.FC<BranchSelectProps> = ({ branch, branches, isCheckingOut, handleCheckout }) => {
    if (branches.length === 0) {
        return <div className="text-sm font-semibold text-foreground">{branch ?? 'N/A'}</div>;
    }
    return (
        <Select value={branch ?? ''} onValueChange={(value) => { void handleCheckout(value); }} disabled={isCheckingOut}>
            <SelectTrigger className="h-8 text-sm">
                <SelectValue>
                    <div className="flex items-center gap-2">
                        <GitBranch className="w-3.5 h-3.5" />
                        {branch ?? 'N/A'}
                    </div>
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {branches.map((b: string) => (
                    <SelectItem key={b} value={b}>
                        {b === branch && <Check className="w-3.5 h-3.5 inline mr-2" />}
                        {b}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};

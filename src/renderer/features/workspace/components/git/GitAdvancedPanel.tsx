/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Button } from '@renderer/components/ui/button';
import { ConfirmationModal } from '@renderer/components/ui/ConfirmationModal';
import { Input } from '@renderer/components/ui/input';
import { useTranslation } from '@renderer/i18n';
import {
    Plus,
    RefreshCw,
    Trash2,
} from 'lucide-react';
import React, { useState } from 'react';

import { useGitAdvanced } from '../../hooks/useGitAdvanced';

interface GitAdvancedPanelProps {
    workspacePath: string;
}

export const GitAdvancedPanel: React.FC<GitAdvancedPanelProps> = ({ workspacePath }) => {
    const { t } = useTranslation();
    const git = useGitAdvanced(workspacePath);
    const [newBranchName, setNewBranchName] = useState('');
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

    const handleCreateBranch = async () => {
        if (!newBranchName.trim()) { return; }
        const result = await git.createBranch(newBranchName);
        if (result.success) {
            setNewBranchName('');
            await git.fetchRemoteLinks();
        }
    };

    const handleDeleteBranch = () => {
        if (!git.currentBranch) { return; }
        setIsConfirmDeleteOpen(true);
    };

    const confirmDeleteBranch = async () => {
        if (!git.currentBranch) { return; }
        setIsConfirmDeleteOpen(false);
        const result = await git.deleteBranch(git.currentBranch);
        if (result.success) { await git.fetchRemoteLinks(); }
    };

    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <span className="text-11 font-semibold text-muted-foreground uppercase tracking-wider px-1">{t('git.advanced.branchManagement')}</span>
                <div className="p-4 rounded-lg bg-card border border-border/40 space-y-4">
                    <div className="flex gap-2">
                        <Input
                            value={newBranchName}
                            onChange={e => setNewBranchName(e.target.value)}
                            placeholder={t('git.advanced.enterNewBranchName')}
                            className="h-8 text-xs bg-background/50 border-border/20"
                        />
                        <Button 
                            disabled={!newBranchName.trim()} 
                            onClick={handleCreateBranch}
                            size="sm"
                            className="h-8 px-3 text-11 font-bold"
                        >
                            <Plus className="w-3 h-3" />
                        </Button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground/70 truncate mr-4">{git.currentBranch}</span>
                        <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={handleDeleteBranch} className="h-7 w-7 p-0 text-destructive/40 hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                <span className="text-11 font-semibold text-muted-foreground uppercase tracking-wider px-1">{t('git.advanced.maintenance')}</span>
                <div className="flex flex-col gap-2">
                    <Button variant="outline" className="justify-start h-9 text-xs font-medium border-border/20 hover:bg-muted/40 transition-colors" onClick={() => git.refreshAll()}>
                        <RefreshCw className="w-3.5 h-3.5 mr-2 text-muted-foreground/40" />
                        {t('git.advanced.pruneAndRefresh')}
                    </Button>
                </div>
            </div>

            <ConfirmationModal
                isOpen={isConfirmDeleteOpen}
                onClose={() => setIsConfirmDeleteOpen(false)}
                onConfirm={confirmDeleteBranch}
                title={t('git.advanced.deleteBranchTitle') || 'Delete Branch'}
                message={t('git.advanced.confirmDeleteBranch', { name: git.currentBranch || '' })}
                variant="danger"
            />
        </div>
    );
};

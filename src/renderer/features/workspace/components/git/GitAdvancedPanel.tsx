/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconPlus, IconRefresh, IconTrash } from '@tabler/icons-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n';

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
                <span className="typo-overline font-semibold text-muted-foreground uppercase px-1">{t('frontend.git.advanced.branchManagement')}</span>
                <div className="p-4 rounded-lg bg-card border border-border/40 space-y-4">
                    <div className="flex gap-2">
                        <Input
                            value={newBranchName}
                            onChange={e => setNewBranchName(e.target.value)}
                            placeholder={t('frontend.git.advanced.enterNewBranchName')}
                            className="h-8 text-sm bg-background/50 border-border/20"
                        />
                        <Button
                            disabled={!newBranchName.trim()}
                            onClick={handleCreateBranch}
                            size="sm"
                            className="h-8 px-3 typo-overline font-bold"
                        >
                            <IconPlus className="w-3 h-3" />
                        </Button>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground/70 truncate mr-4">{git.currentBranch}</span>
                        <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={handleDeleteBranch} className="h-7 w-7 p-0 text-destructive/40 hover:text-destructive hover:bg-destructive/10">
                                <IconTrash className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                <span className="typo-overline font-semibold text-muted-foreground uppercase px-1">{t('frontend.git.advanced.maintenance')}</span>
                <div className="flex flex-col gap-2">
                    <Button variant="outline" className="justify-start h-9 text-sm font-medium border-border/20 hover:bg-muted/40 transition-colors" onClick={() => git.refreshAll()}>
                        <IconRefresh className="w-3.5 h-3.5 mr-2 text-muted-foreground/40" />
                        {t('frontend.git.advanced.pruneAndRefresh')}
                    </Button>
                </div>
            </div>

            <ConfirmationModal
                isOpen={isConfirmDeleteOpen}
                onClose={() => setIsConfirmDeleteOpen(false)}
                onConfirm={confirmDeleteBranch}
                title={t('frontend.git.advanced.deleteBranchTitle')}
                message={t('frontend.git.advanced.confirmDeleteBranch', { name: git.currentBranch || '' })}
                variant="danger"
            />
        </div>
    );
};


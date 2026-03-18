import { useTranslation } from '@renderer/i18n';
import {
    GitCompareArrows,
    GitMerge,
    Plus,
    RefreshCw,
    Scissors,
    Trash2,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

import { confirmDialog, promptDialog } from '../../../terminal/utils/dialog';
import { useGitAdvanced } from '../../hooks/useGitAdvanced';

interface GitAdvancedPanelProps {
    workspacePath: string;
}

const Card: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }> = ({
    title,
    icon,
    children,
    className,
}) => (
    <section className={cn('bg-card/80 backdrop-blur-md rounded-2xl border border-border/50 p-5 space-y-3', className)}>
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            {icon}
            {title}
        </div>
        {children}
    </section>
);

const Field: React.FC<{
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    className?: string;
}> = ({ value, onChange, placeholder, className }) => (
    <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn('h-9 rounded-lg border border-border/50 bg-muted/20 px-3 text-sm outline-none focus:border-primary/50', className)}
    />
);

export const GitAdvancedPanel: React.FC<GitAdvancedPanelProps> = ({ workspacePath }) => {
    const { t } = useTranslation();
    const git = useGitAdvanced(workspacePath);
    const [statsDays, setStatsDays] = useState('365');
    const [newBranchName, setNewBranchName] = useState('');

    const handleCreateBranch = async () => {
        if (!newBranchName.trim()) {
            return;
        }

        const result = await git.createBranch(newBranchName);
        if (result.success) {
            setNewBranchName('');
            await git.fetchRemoteLinks();
        }
    };

    const handleDeleteBranch = async () => {
        if (!git.currentBranch) {
            return;
        }

        if (!confirmDialog(t('git.advanced.confirmDeleteBranch', { name: git.currentBranch }))) {
            return;
        }

        const result = await git.deleteBranch(git.currentBranch);
        if (result.success) {
            await git.fetchRemoteLinks();
        }
    };

    const handleRenameBranch = async () => {
        if (!git.currentBranch) {
            return;
        }

        const newName = promptDialog(t('git.advanced.enterNewBranchName'), git.currentBranch);
        if (newName && newName !== git.currentBranch) {
            const result = await git.renameBranch(git.currentBranch, newName);
            if (result.success) {
                await git.fetchRemoteLinks();
            }
        }
    };


    useEffect(() => {
        void git.refreshAll();
    }, [git]);

    const topFiles = useMemo(() => git.stats?.fileStats.slice(0, 8) ?? [], [git.stats]);
    const topAuthors = useMemo(() => git.stats?.authorStats.slice(0, 8) ?? [], [git.stats]);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

            <Card title={t('git.advanced.branchManagement')} icon={<GitMerge className="w-4 h-4 text-primary" />}>
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <Field
                            value={newBranchName}
                            onChange={setNewBranchName}
                            placeholder={t('git.advanced.newBranchName')}
                            className="flex-1"
                        />
                        <button
                            onClick={() => void handleCreateBranch()}
                            disabled={!newBranchName.trim()}
                            className="inline-flex items-center gap-1.5 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            {t('common.create')}
                        </button>
                    </div>

                    <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{t('git.branch')}</span>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => void handleRenameBranch()}
                                    className="p-1 hover:bg-muted/40 rounded text-muted-foreground hover:text-foreground"
                                    title={t('git.advanced.rename')}
                                >
                                    <Scissors className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => void handleDeleteBranch()}
                                    className="p-1 hover:bg-muted/40 rounded text-destructive/70 hover:text-destructive"
                                    title={t('common.delete')}
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                        <div className="text-sm font-medium">{git.currentBranch}</div>
                    </div>
                </div>
            </Card>

            <Card title={t('git.advanced.repositoryStatistics')} icon={<GitCompareArrows className="w-4 h-4 text-primary" />} className="xl:col-span-2">
                <div className="flex flex-wrap items-center gap-2">
                    <Field value={statsDays} onChange={setStatsDays} placeholder={t('placeholder.days')} className="w-28" />
                    <button onClick={() => void git.fetchStats(Number(statsDays) || 365)} className="px-3 h-9 rounded-lg border border-border/40 hover:bg-muted/40 text-xs">{t('git.advanced.refreshStats')}</button>
                    <button onClick={() => void git.exportStats(Number(statsDays) || 365)} className="px-3 h-9 rounded-lg border border-border/40 hover:bg-muted/40 text-xs">{t('git.advanced.export')}</button>
                </div>
                {git.stats ? (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
                                <div className="text-muted-foreground">{t('git.advanced.totalCommits')}</div>
                                <div className="text-xl font-semibold text-foreground">{git.stats.totalCommits}</div>
                            </div>
                            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
                                <div className="text-muted-foreground">{t('git.advanced.authors')}</div>
                                <div className="text-xl font-semibold text-foreground">{git.stats.authorStats.length}</div>
                            </div>
                            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
                                <div className="text-muted-foreground">{t('git.advanced.trackedFiles')}</div>
                                <div className="text-xl font-semibold text-foreground">{git.stats.fileStats.length}</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-1">
                                <div className="font-semibold text-muted-foreground">{t('git.advanced.topAuthors')}</div>
                                {topAuthors.map(item => (
                                    <div key={item.author} className="flex justify-between gap-3">
                                        <span className="truncate text-foreground">{item.author}</span>
                                        <span className="text-muted-foreground">{item.commits}</span>
                                    </div>
                                ))}
                                {topAuthors.length === 0 && <div className="text-muted-foreground">{t('git.advanced.noData')}</div>}
                            </div>
                            <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-1">
                                <div className="font-semibold text-muted-foreground">{t('git.advanced.topFiles')}</div>
                                {topFiles.map(item => (
                                    <div key={item.file} className="flex justify-between gap-3">
                                        <span className="truncate text-foreground font-mono">{item.file}</span>
                                        <span className="text-muted-foreground">{item.commits}</span>
                                    </div>
                                ))}
                                {topFiles.length === 0 && <div className="text-muted-foreground">{t('git.advanced.noData')}</div>}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="text-xs text-muted-foreground rounded-lg border border-border/40 bg-muted/20 p-3">{t('git.advanced.statsNotLoaded')}</div>
                )}
            </Card>

            {git.isLoading && (
                <div className="xl:col-span-2 text-xs text-muted-foreground inline-flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {t('git.advanced.refreshingData')}
                </div>
            )}
        </div>
    );
};

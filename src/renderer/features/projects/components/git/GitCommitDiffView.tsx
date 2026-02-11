import { GitCommit, RefreshCw } from 'lucide-react';

import { GitDiffLine } from './GitDiffLine';
import { GitCommitInfo } from './types';

interface CommitDiffViewProps {
    selectedCommit: GitCommitInfo;
    loadingDiff: boolean;
    commitDiff: string | null;
    t: (key: string) => string;
}

export const GitCommitDiffView: React.FC<CommitDiffViewProps> = ({
    selectedCommit,
    loadingDiff,
    commitDiff,
    t,
}) => (
    <div className="mt-6 border-t border-border/50 pt-6 animate-in fade-in slide-in-from-top-4 duration-300">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
                <GitCommit className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-bold text-foreground">
                    {t('projectDashboard.commitChangesTitle')}:{' '}
                    {selectedCommit.hash.substring(0, 7)}
                </h4>
            </div>
            <div className="text-xxs text-muted-foreground uppercase tracking-widest font-bold">
                {t('projectDashboard.unifiedDiff')}
            </div>
        </div>
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
            {loadingDiff ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mr-3" />
                    <span>{t('projectDashboard.analyzingCommit')}</span>
                </div>
            ) : commitDiff ? (
                <div className="max-h-[500px] overflow-auto p-4 font-mono text-xs leading-relaxed">
                    {commitDiff.split('\n').map((line: string, idx: number) => (
                        <GitDiffLine key={idx} line={line} idx={idx} />
                    ))}
                </div>
            ) : (
                <div className="h-40 flex items-center justify-center text-muted-foreground text-sm italic">
                    {t('projectDashboard.noDiffData')}
                </div>
            )}
        </div>
    </div>
);

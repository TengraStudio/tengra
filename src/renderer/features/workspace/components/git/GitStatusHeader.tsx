import { RefreshCw } from 'lucide-react';

import { cn } from '@/lib/utils';

import { GitBranchSelect } from './GitBranchSelect';
import { GitTrackingStatus } from './GitTrackingStatus';
import { GitData, TrackingInfo } from './types';

interface StatusHeaderProps {
    gitData: GitData;
    branches: string[];
    trackingInfo: TrackingInfo | null;
    isCheckingOut: boolean;
    handleCheckout: (branch: string) => Promise<void>;
    fetchGitData: () => Promise<void>;
    t: (key: string) => string;
}

export const GitStatusHeader: React.FC<StatusHeaderProps> = ({ gitData, branches, trackingInfo, isCheckingOut, handleCheckout, fetchGitData, t }) => (
    <div className="bg-card/80 backdrop-blur-md rounded-2xl border border-border/50 p-6">
        <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-3">
                <div className={cn("w-3 h-3 rounded-full", gitData.isClean ? "bg-success" : "bg-warning")} />
                {t('workspaceDashboard.gitRepository')}
            </h2>
            <button
                onClick={() => { void fetchGitData(); }}
                className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                title={t('common.refresh')}
            >
                <RefreshCw className="w-4 h-4" />
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-muted/30 rounded-xl p-4">
                <div className="typo-caption text-muted-foreground mb-2">{t('workspaceDashboard.branch')}</div>
                <GitBranchSelect
                    branch={gitData.branch}
                    branches={branches}
                    isCheckingOut={isCheckingOut}
                    handleCheckout={handleCheckout}
                />
            </div>
            <div className="bg-muted/30 rounded-xl p-4">
                <div className="typo-caption text-muted-foreground mb-1">{t('workspaceDashboard.status')}</div>
                <div className={cn("text-sm font-semibold", gitData.isClean ? "text-success" : "text-warning")}>
                    {gitData.isClean ? t('workspaceDashboard.clean') : t('workspaceDashboard.dirty')}
                </div>
            </div>
            <div className="bg-muted/30 rounded-xl p-4">
                <div className="typo-caption text-muted-foreground mb-1">{t('workspaceDashboard.lastCommit')}</div>
                <div className="text-sm font-semibold text-foreground">
                    {gitData.lastCommit?.relativeTime ?? 'N/A'}
                </div>
            </div>
            <div className="bg-muted/30 rounded-xl p-4">
                <div className="typo-caption text-muted-foreground mb-1">{t('workspaceDashboard.tracking')}</div>
                <GitTrackingStatus trackingInfo={trackingInfo} t={t} />
            </div>
        </div>
    </div>
);

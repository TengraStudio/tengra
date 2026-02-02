import { GitCommit, RefreshCw } from 'lucide-react';

import { cn } from '@/lib/utils';

interface CommitSectionProps {
    commitMessage: string;
    setCommitMessage: (msg: string) => void;
    isCommitting: boolean;
    handleCommit: () => Promise<void>;
    t: (key: string) => string;
}

export const GitCommitSection: React.FC<CommitSectionProps> = ({ commitMessage, setCommitMessage, isCommitting, handleCommit, t }) => (
    <div className="mt-4 pt-4 border-t border-border/50">
        <div className="flex gap-2">
            <input
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && commitMessage.trim()) {
                        e.preventDefault();
                        void handleCommit();
                    }
                }}
                placeholder={t('projectDashboard.commitMessage')}
                className="flex-1 bg-muted/30 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            <button
                onClick={() => { void handleCommit(); }}
                disabled={!commitMessage.trim() || isCommitting}
                className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    "bg-primary border border-primary/30 text-primary-foreground hover:bg-primary/90",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
            >
                {isCommitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <GitCommit className="w-4 h-4" />}
                {t('projectDashboard.commit')}
            </button>
        </div>
    </div>
);

import { cn } from '@/lib/utils';

import { GitCommitInfo } from './types';

interface CommitCardProps {
    commit: GitCommitInfo;
    isSelected: boolean;
    onSelect: (commit: GitCommitInfo) => void;
}

export const GitCommitCard: React.FC<CommitCardProps> = ({ commit, isSelected, onSelect }) => (
    <button
        onClick={() => { onSelect(commit); }}
        className={cn(
            "flex flex-col gap-3 p-5 rounded-2xl transition-all text-left group",
            isSelected
                ? "bg-primary/20 border-2 border-primary shadow-lg shadow-primary/10"
                : "bg-muted/30 border border-border/50 hover:bg-muted/50 hover:border-primary/30"
        )}
    >
        <div className="flex items-center justify-between w-full">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                {commit.author[0].toUpperCase()}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded group-hover:text-primary transition-colors">
                {commit.hash.substring(0, 7)}
            </div>
        </div>
        <div className="flex-1 min-w-0">
            <div className="text-sm text-foreground font-bold line-clamp-2 leading-tight mb-1">
                {commit.message}
            </div>
            <div className="text-xs text-muted-foreground">
                <span className="font-semibold text-primary/70">{commit.author}</span>
                <span className="mx-1.5">/</span>
                {new Date(commit.date).toLocaleDateString()}
            </div>
        </div>
    </button>
);

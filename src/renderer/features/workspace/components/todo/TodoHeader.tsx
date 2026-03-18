import { CheckSquare, Plus, RefreshCw } from 'lucide-react';

import { cn } from '@/lib/utils';

import { TodoStats } from './types';

interface TodoHeaderProps {
    totalStats: TodoStats;
    isAdding: boolean;
    onToggleAdding: () => void;
    onRefresh: () => void;
    loading: boolean;
    t: (key: string) => string;
}

export const TodoHeader = ({ totalStats, isAdding, onToggleAdding, onRefresh, loading, t }: TodoHeaderProps) => (
    <div className="p-4 border-b border-border/50 flex items-center justify-between shrink-0 bg-background/50 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
                <CheckSquare className="w-5 h-5 text-primary" />
            </div>
            <div>
                <h2 className="text-sm font-bold text-foreground">{t('workspaceDashboard.workspaceTasks')}</h2>
                <div className="text-xs text-muted-foreground flex gap-2">
                    <span className="text-success">{totalStats.completed} {t('common.done')}</span>
                    <span className="text-muted-foreground/20">•</span>
                    <span className="text-muted-foreground/60">{totalStats.pending} {t('workspaceDashboard.pending')}</span>
                </div>
            </div>
        </div>
        <div className="flex gap-2">
            <button
                onClick={onToggleAdding}
                className={cn(
                    "p-2 rounded-lg transition-colors",
                    isAdding ? "bg-primary text-primary-foreground" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                )}
                title={t('common.add')}
            >
                <Plus className="w-4 h-4" />
            </button>
            <button
                onClick={onRefresh}
                className="p-2 hover:bg-muted/50 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                title={t('common.refresh')}
            >
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </button>
        </div>
    </div>
);

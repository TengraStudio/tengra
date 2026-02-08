import { Play, Clock, Hash } from 'lucide-react';
import React from 'react';

import { CheckpointItem } from '@/features/projects/hooks/useAgentHistory';

interface CheckpointListProps {
    checkpoints: CheckpointItem[];
    onResume: (checkpointId: string) => void;
    isLoading?: boolean;
    formatTime: (date: Date) => string;
    t: (key: string, options?: Record<string, string | number>) => string;
}

export const CheckpointList: React.FC<CheckpointListProps> = ({
    checkpoints,
    onResume,
    isLoading,
    formatTime,
    t
}) => {
    if (isLoading) {
        return (
            <div className="p-4 text-center text-muted-foreground text-sm">
                {t('common.loading')}...
            </div>
        );
    }

    if (checkpoints.length === 0) {
        return (
            <div className="p-4 text-center text-muted-foreground text-sm opacity-50">
                {t('agent.no_checkpoints')}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto p-1">
            {checkpoints.map((cp) => (
                <div
                    key={cp.id}
                    className="flex items-center justify-between p-2 rounded hover:bg-muted/10 border border-transparent hover:border-border/20 transition-all group"
                >
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <Hash className="w-3 h-3" />
                                {cp.stepIndex}
                            </span>
                            <span className="opacity-30">|</span>
                            <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTime(cp.createdAt)}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={() => onResume(cp.id)}
                        className="p-1.5 hover:bg-primary/20 text-primary/50 hover:text-primary rounded-md transition-colors opacity-0 group-hover:opacity-100"
                        title={t('common.resume')}
                    >
                        <Play className="w-3 h-3 fill-current" />
                    </button>
                </div>
            ))}
        </div>
    );
};

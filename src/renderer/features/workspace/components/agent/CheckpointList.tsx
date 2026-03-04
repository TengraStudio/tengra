import { AlertTriangle, Check, Clock, Hash, Play, RefreshCw, RotateCcw } from 'lucide-react';
import React, { useState } from 'react';

import { CheckpointItem } from '@/features/workspace/hooks/useAgentHistory';

interface CheckpointListProps {
    checkpoints: CheckpointItem[];
    onResume: (checkpointId: string) => void;
    onRollback: (checkpointId: string) => void;
    isLoading?: boolean;
    error?: string | null;
    onRetry?: () => void;
    formatTime: (date: Date) => string;
    t: (key: string, options?: Record<string, string | number>) => string;
}

export const CheckpointList: React.FC<CheckpointListProps> = ({
    checkpoints,
    onResume,
    onRollback,
    isLoading,
    error,
    onRetry,
    formatTime,
    t,
}) => {
    const [confirmRollbackId, setConfirmRollbackId] = useState<string | null>(null);

    if (isLoading) {
        return (
            <div className="p-4 text-center text-muted-foreground text-sm">
                {t('common.loading')}...
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-center text-sm">
                <AlertTriangle className="w-5 h-5 text-destructive mx-auto mb-2" />
                <p className="text-destructive mb-2">{error}</p>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                        <RefreshCw className="w-3 h-3" />
                        {t('common.retry')}
                    </button>
                )}
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
            {checkpoints.map(cp => (
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

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => onResume(cp.id)}
                            className="p-1.5 hover:bg-primary/20 text-primary/50 hover:text-primary rounded-md transition-colors"
                            title={t('common.resume')}
                        >
                            <Play className="w-3 h-3 fill-current" />
                        </button>
                        <button
                            onClick={() => {
                                if (confirmRollbackId === cp.id) {
                                    onRollback(cp.id);
                                    setConfirmRollbackId(null);
                                    return;
                                }
                                setConfirmRollbackId(cp.id);
                            }}
                            className={`p-1.5 rounded-md transition-colors ${
                                confirmRollbackId === cp.id
                                    ? 'bg-destructive/20 text-destructive'
                                    : 'hover:bg-destructive/10 text-destructive/60 hover:text-destructive'
                            }`}
                            title={
                                confirmRollbackId === cp.id
                                    ? t('agent.confirmRollback')
                                    : t('agent.rollback')
                            }
                        >
                            {confirmRollbackId === cp.id ? (
                                <Check className="w-3 h-3" />
                            ) : (
                                <RotateCcw className="w-3 h-3" />
                            )}
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

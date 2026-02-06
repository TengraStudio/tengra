import { AlertCircle, CheckCircle, Coins, Loader2, Sparkles, Zap } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

interface StatusIndicatorsProps {
    state: string;
    progress: number;
    currentStep?: string;
    error?: string | null;
    metrics?: {
        tokensUsed?: number;
        llmCalls?: number;
        toolCalls?: number;
        estimatedCost?: number;
    };
    t: (key: string, options?: Record<string, string | number>) => string;
}

interface AgentStatusFlags {
    isRunning: boolean;
    isCompleted: boolean;
    isFailed: boolean;
    isStuck: boolean;
    isInterrupted: boolean;
    isPaused: boolean;
}

const getStatusColor = (flags: AgentStatusFlags) => {
    if (flags.isRunning) { return "bg-primary text-primary-foreground animate-pulse shadow-primary/20"; }
    if (flags.isCompleted) { return "bg-success text-success-foreground shadow-success/20"; }
    if (flags.isFailed) { return "bg-destructive text-destructive-foreground shadow-destructive/20"; }
    if (flags.isStuck) { return "bg-warning text-warning-foreground animate-pulse shadow-warning/20"; }
    if (flags.isInterrupted) { return "bg-warning text-warning-foreground animate-bounce shadow-warning/20"; }
    if (flags.isPaused) { return "bg-secondary text-secondary-foreground shadow-secondary/20"; }
    return "bg-muted text-muted-foreground";
};

const getStatusIconElement = (flags: Omit<AgentStatusFlags, 'isPaused'>) => {
    if (flags.isRunning) { return <Loader2 className="w-5 h-5 animate-spin" />; }
    if (flags.isCompleted) { return <CheckCircle className="w-5 h-5" />; }
    if (flags.isFailed || flags.isStuck || flags.isInterrupted) { return <AlertCircle className="w-5 h-5" />; }
    return <Sparkles className="w-5 h-5" />;
};

const MetricItem = ({ icon: Icon, label, value, valueClassName }: { icon: React.ComponentType<{ className?: string }>, label: string, value: string | number, valueClassName?: string }) => (
    <div className="flex flex-col items-end">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
            <Icon className="w-3 h-3 text-inherit" />
            {label}
        </span>
        <span className={cn("text-sm font-mono font-bold leading-none", valueClassName)}>
            {value}
        </span>
    </div>
);

const getStatusMessage = (error: string | null | undefined, currentStep: string | undefined, isCompleted: boolean, t: (k: string) => string) => {
    if (error) { return error; }
    if (currentStep) { return currentStep; }
    return isCompleted ? t('agent.allStepsFinished') : t('agent.readyForInstructions');
};

const ProgressBar = ({ progress, isCompleted, isFailed, isRunning }: { progress: number, isCompleted: boolean, isFailed: boolean, isRunning: boolean }) => (
    <div className="flex-1 max-w-md h-2 bg-muted/20 rounded-full overflow-hidden relative">
        <div
            className={cn(
                "absolute inset-y-0 left-0 transition-all duration-1000 ease-out rounded-full",
                isCompleted ? "bg-success" : isFailed ? "bg-destructive" : "bg-primary glow-primary"
            )}
            style={{ width: `${progress}%` }}
        />
        {isRunning && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
        )}
    </div>
);

const MetricsSection = ({ metrics, t }: { metrics: StatusIndicatorsProps['metrics'], t: StatusIndicatorsProps['t'] }) => (
    <div className="flex items-center gap-6 ml-auto">
        <MetricItem
            icon={Zap}
            label={t('agent.tokens')}
            value={`${metrics ? ((metrics.tokensUsed ?? 0) / 1000).toFixed(1) : '0.0'}k`}
            valueClassName="text-foreground"
        />
        <MetricItem
            icon={Sparkles}
            label={t('agent.calls')}
            value={metrics ? (metrics.llmCalls ?? 0) + (metrics.toolCalls ?? 0) : 0}
            valueClassName="text-foreground"
        />
        <MetricItem
            icon={Coins}
            label={t('agent.cost')}
            value={`$${metrics ? (metrics.estimatedCost ?? 0).toFixed(4) : '0.0000'}`}
            valueClassName="text-success"
        />
    </div>
);

export const StatusIndicators: React.FC<StatusIndicatorsProps> = ({
    state,
    progress,
    currentStep,
    error,
    metrics,
    t
}) => {
    const isCompleted = state === 'completed';
    const isFailed = state === 'failed' || state === 'stopped';
    const statusFlags: AgentStatusFlags = {
        isRunning: !isCompleted && !isFailed && state !== 'waiting_user' && state !== 'waiting_llm' && state !== 'waiting_tool' && state !== 'paused' && state !== 'idle',
        isCompleted,
        isFailed,
        isStuck: state === 'waiting_llm' || state === 'waiting_tool',
        isInterrupted: state === 'waiting_user',
        isPaused: state === 'paused'
    };

    return (
        <div className="flex items-center gap-6 px-4 py-3 bg-card/50 border-b border-border backdrop-blur-md">
            <div className="flex items-center gap-3 min-w-[200px]">
                <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-all duration-500",
                    getStatusColor(statusFlags)
                )}>
                    {getStatusIconElement(statusFlags)}
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <span className="micro-label !text-foreground">
                            {t(`council.status.${state}`)}
                        </span>
                        {statusFlags.isRunning && (
                            <span className="text-xs text-primary font-bold animate-pulse">{t('agent.live')}</span>
                        )}
                    </div>
                    <p className="status-text truncate max-w-[150px]">
                        {getStatusMessage(error, currentStep, isCompleted, t)}
                    </p>
                </div>
            </div>

            <ProgressBar progress={progress} isCompleted={isCompleted} isFailed={isFailed} isRunning={statusFlags.isRunning} />
            <MetricsSection metrics={metrics} t={t} />
        </div>
    );
};

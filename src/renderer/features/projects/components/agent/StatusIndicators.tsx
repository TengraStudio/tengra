import {
    AlertTriangle,
    CheckCircle2,
    Coins,
    Cpu,
    Loader2,
    Pause,
    Radio,
    Sparkles,
    Wrench,
    Zap,
} from 'lucide-react';
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

const getStatusStyles = (flags: AgentStatusFlags) => {
    if (flags.isRunning) {
        return {
            bg: 'bg-primary/10',
            border: 'border-primary/30',
            text: 'text-primary',
            glow: 'shadow-[0_0_15px_hsl(var(--primary)/0.2)]',
            pulse: true,
        };
    }
    if (flags.isCompleted) {
        return {
            bg: 'bg-success/10',
            border: 'border-success/30',
            text: 'text-success',
            glow: 'shadow-[0_0_15px_hsl(var(--success)/0.2)]',
            pulse: false,
        };
    }
    if (flags.isFailed) {
        return {
            bg: 'bg-destructive/10',
            border: 'border-destructive/30',
            text: 'text-destructive',
            glow: 'shadow-[0_0_15px_hsl(var(--destructive)/0.2)]',
            pulse: false,
        };
    }
    if (flags.isStuck) {
        return {
            bg: 'bg-warning/10',
            border: 'border-warning/30',
            text: 'text-warning',
            glow: 'shadow-[0_0_15px_hsl(var(--warning)/0.2)]',
            pulse: true,
        };
    }
    if (flags.isInterrupted) {
        return {
            bg: 'bg-secondary/10',
            border: 'border-secondary/30',
            text: 'text-secondary',
            glow: 'shadow-[0_0_15px_hsl(var(--secondary)/0.2)]',
            pulse: true,
        };
    }
    if (flags.isPaused) {
        return {
            bg: 'bg-muted',
            border: 'border-border',
            text: 'text-muted-foreground',
            glow: '',
            pulse: false,
        };
    }
    return {
        bg: 'bg-muted/30',
        border: 'border-border',
        text: 'text-muted-foreground',
        glow: '',
        pulse: false,
    };
};

const getStatusIcon = (flags: AgentStatusFlags) => {
    if (flags.isRunning) {
        return <Loader2 className="w-4 h-4 animate-spin" />;
    }
    if (flags.isCompleted) {
        return <CheckCircle2 className="w-4 h-4" />;
    }
    if (flags.isFailed) {
        return <AlertTriangle className="w-4 h-4" />;
    }
    if (flags.isStuck) {
        return <Radio className="w-4 h-4" />;
    }
    if (flags.isInterrupted) {
        return <AlertTriangle className="w-4 h-4" />;
    }
    if (flags.isPaused) {
        return <Pause className="w-4 h-4" />;
    }
    return <Sparkles className="w-4 h-4" />;
};

const MetricItem = ({
    icon: Icon,
    label,
    value,
    color = 'text-foreground/60',
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string | number;
    color?: string;
}) => (
    <div className="flex items-center gap-2 font-mono">
        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground uppercase tracking-wider">
            <Icon className="w-3 h-3" />
            <span>{label}</span>
        </div>
        <span className={cn('text-xs font-bold tabular-nums', color)}>{value}</span>
    </div>
);

const getStatusMessage = (
    error: string | null | undefined,
    currentStep: string | undefined,
    isCompleted: boolean,
    t: (k: string) => string
) => {
    if (error) {
        return error;
    }
    if (currentStep) {
        return currentStep;
    }
    return isCompleted ? t('agent.allStepsFinished') : t('agent.readyForInstructions');
};

const ProgressBar = ({
    progress,
    isCompleted,
    isFailed,
    isRunning,
}: {
    progress: number;
    isCompleted: boolean;
    isFailed: boolean;
    isRunning: boolean;
}) => (
    <div className="flex-1 max-w-sm h-1.5 bg-muted rounded-full overflow-hidden relative">
        <div
            className={cn(
                'absolute inset-y-0 left-0 transition-all duration-1000 ease-out rounded-full',
                isCompleted && 'bg-success',
                isFailed && 'bg-destructive',
                !isCompleted && !isFailed && 'bg-primary'
            )}
            style={{ width: `${progress}%` }}
        />
        {isRunning && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/20 to-transparent animate-shimmer" />
        )}
    </div>
);

const MetricsSection = ({
    metrics,
    t,
}: {
    metrics: StatusIndicatorsProps['metrics'];
    t: StatusIndicatorsProps['t'];
}) => (
    <div className="flex items-center gap-4 border-l border-border pl-4 ml-4">
        <MetricItem
            icon={Zap}
            label={t('agent.tokens')}
            value={`${metrics ? ((metrics.tokensUsed ?? 0) / 1000).toFixed(1) : '0.0'}K`}
            color="text-primary/80"
        />
        <MetricItem
            icon={Cpu}
            label="LLM"
            value={metrics?.llmCalls ?? 0}
            color="text-secondary/80"
        />
        <MetricItem
            icon={Wrench}
            label="TOOLS"
            value={metrics?.toolCalls ?? 0}
            color="text-warning/80"
        />
        <MetricItem
            icon={Coins}
            label={t('agent.cost')}
            value={`$${metrics ? (metrics.estimatedCost ?? 0).toFixed(4) : '0.0000'}`}
            color="text-success/80"
        />
    </div>
);

export const StatusIndicators: React.FC<StatusIndicatorsProps> = ({
    state,
    progress,
    currentStep,
    error,
    metrics,
    t,
}) => {
    const isCompleted = state === 'completed';
    const isFailed = state === 'failed' || state === 'stopped';
    const statusFlags: AgentStatusFlags = {
        isRunning:
            !isCompleted &&
            !isFailed &&
            state !== 'waiting_user' &&
            state !== 'waiting_llm' &&
            state !== 'waiting_tool' &&
            state !== 'paused' &&
            state !== 'idle',
        isCompleted,
        isFailed,
        isStuck: state === 'waiting_llm' || state === 'waiting_tool',
        isInterrupted: state === 'waiting_user',
        isPaused: state === 'paused',
    };

    const styles = getStatusStyles(statusFlags);

    return (
        <div className="flex items-center gap-4 px-4 py-3 bg-card/40 border-b border-border backdrop-blur-xl relative">
            {/* Decorative top line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

            {/* Status indicator */}
            <div className="flex items-center gap-3 min-w-[220px]">
                <div
                    className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center border transition-all duration-500',
                        styles.bg,
                        styles.border,
                        styles.text,
                        styles.glow,
                        styles.pulse && 'animate-pulse'
                    )}
                >
                    {getStatusIcon(statusFlags)}
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <span
                            className={cn(
                                'text-[10px] font-mono font-bold uppercase tracking-[0.15em]',
                                styles.text
                            )}
                        >
                            {t(`council.status.${state}`)}
                        </span>
                        {statusFlags.isRunning && (
                            <div className="flex items-center gap-1">
                                <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                                <span className="text-[9px] font-mono text-primary uppercase tracking-wider">
                                    {t('agent.live')}
                                </span>
                            </div>
                        )}
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground truncate max-w-[160px]">
                        {getStatusMessage(error, currentStep, isCompleted, t)}
                    </p>
                </div>
            </div>

            {/* Progress section */}
            <div className="flex items-center gap-3 flex-1">
                <ProgressBar
                    progress={progress}
                    isCompleted={isCompleted}
                    isFailed={isFailed}
                    isRunning={statusFlags.isRunning}
                />
                <span className="text-[10px] font-mono text-muted-foreground tabular-nums w-12 text-right">
                    {Math.round(progress)}%
                </span>
            </div>

            {/* Metrics */}
            <MetricsSection metrics={metrics} t={t} />

            {/* System time */}
            <div className="text-[9px] font-mono text-muted-foreground/50 border-l border-border pl-4 ml-2">
                <div className="text-muted-foreground">SYS.TIME</div>
                <div className="text-primary/50 tabular-nums">
                    {new Date().toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                    })}
                </div>
            </div>
        </div>
    );
};

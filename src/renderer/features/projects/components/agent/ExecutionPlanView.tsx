import type { PlanCostBreakdown, StepConfidence } from '@shared/types/project-agent';
import { CheckCircle2, Coins, GitBranch, Loader2, Target, XCircle } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

export interface ExecutionPlan {
    id: string;
    taskId: string;
    planNumber: number;
    status: 'pending' | 'awaiting_approval' | 'executing' | 'completed' | 'failed';
    steps: {
        id: string;
        description: string;
        status: 'pending' | 'executing' | 'completed' | 'failed';
        toolCalls?: string[];
        /** AGT-PLN-05: Confidence score for this step */
        confidence?: StepConfidence;
    }[];
    currentStep: number;
    createdAt: Date;
    /** AGT-TOK-02: Estimated cost before execution */
    estimatedCost?: PlanCostBreakdown;
}

interface ExecutionPlanViewProps {
    plan: ExecutionPlan;
    onApprove?: () => void;
    onReject?: () => void;
    awaitingApproval?: boolean;
    t: (key: string, options?: Record<string, string | number>) => string;
}

const StepIndicator: React.FC<{ status: string; index: number; isLast: boolean }> = ({
    status,
    index,
    isLast,
}) => {
    const getIcon = () => {
        switch (status) {
            case 'completed':
                return <CheckCircle2 className="w-3.5 h-3.5 text-success" />;
            case 'executing':
                return <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />;
            case 'failed':
                return <XCircle className="w-3.5 h-3.5 text-destructive" />;
            default:
                return (
                    <div className="w-3.5 h-3.5 rounded-full border border-border flex items-center justify-center">
                        <span className="text-[8px] font-mono text-muted-foreground">
                            {index + 1}
                        </span>
                    </div>
                );
        }
    };

    return (
        <div className="flex flex-col items-center">
            <div
                className={cn(
                    'w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-300',
                    status === 'completed' && 'bg-success/10 border border-success/30',
                    status === 'executing' &&
                        'bg-primary/10 border border-primary/30 shadow-[0_0_10px_hsl(var(--primary)/0.2)]',
                    status === 'failed' && 'bg-destructive/10 border border-destructive/30',
                    status === 'pending' && 'bg-muted/30 border border-border'
                )}
            >
                {getIcon()}
            </div>
            {!isLast && (
                <div
                    className={cn(
                        'w-px h-6 my-1 transition-colors duration-500',
                        status === 'completed' ? 'bg-success/30' : 'bg-border'
                    )}
                />
            )}
        </div>
    );
};

/**
 * AGT-TOK-02: Format cost for display
 */
function formatCost(costUsd: number): string {
    if (costUsd < 0.0001) {
        return '<$0.0001';
    }
    if (costUsd < 0.01) {
        return `$${costUsd.toFixed(4)}`;
    }
    if (costUsd < 1) {
        return `$${costUsd.toFixed(3)}`;
    }
    return `$${costUsd.toFixed(2)}`;
}

export const ExecutionPlanView: React.FC<ExecutionPlanViewProps> = ({
    plan,
    onApprove,
    onReject,
    awaitingApproval,
    t,
}) => {
    const completedCount = plan.steps.filter(s => s.status === 'completed').length;
    const progress = (completedCount / plan.steps.length) * 100;

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden rounded-xl border border-border bg-card/40 backdrop-blur-xl">
            {/* Header */}
            <div className="shrink-0 px-4 py-3 border-b border-border bg-card/30">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <GitBranch className="w-4 h-4 text-secondary" />
                            {awaitingApproval && (
                                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-warning animate-pulse" />
                            )}
                        </div>
                        <div>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground font-mono">
                                {t('agent.executionPlan')}
                            </h3>
                            <div className="text-[9px] font-mono text-secondary/50 tracking-wider">
                                PLAN #{plan.planNumber.toString().padStart(2, '0')} ::{' '}
                                {plan.status.toUpperCase().replace('_', ' ')}
                            </div>
                        </div>
                    </div>

                    {/* Progress indicator */}
                    <div className="flex items-center gap-2">
                        <div className="text-[9px] font-mono text-muted-foreground tabular-nums">
                            {completedCount}/{plan.steps.length}
                        </div>
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-secondary to-primary rounded-full transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                </div>

                {awaitingApproval && (
                    <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[9px] font-mono text-warning animate-pulse">
                            <Target className="w-3 h-3" />
                            <span className="uppercase tracking-wider">
                                {t('agent.awaitingApproval')}
                            </span>
                        </div>
                        {/* AGT-TOK-02: Cost estimation display */}
                        {plan.estimatedCost && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/10 border border-secondary/20">
                                <Coins className="w-3 h-3 text-secondary" />
                                <span className="text-[9px] font-mono text-secondary font-medium">
                                    {t('agent.estimatedCost')}: {formatCost(plan.estimatedCost.totalEstimatedCost)}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* AGT-TOK-05: Detailed cost breakdown */}
                {plan.estimatedCost && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-center justify-between text-[9px] font-mono">
                            <div className="flex items-center gap-3">
                                <span className="text-muted-foreground">
                                    {t('agent.inputCost')}: <span className="text-foreground/80">{formatCost(plan.estimatedCost.inputCost)}</span>
                                </span>
                                <span className="text-border">|</span>
                                <span className="text-muted-foreground">
                                    {t('agent.outputCost')}: <span className="text-foreground/80">{formatCost(plan.estimatedCost.outputCost)}</span>
                                </span>
                            </div>
                            <span className="text-muted-foreground/60">
                                {plan.estimatedCost.modelId}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Steps list */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 scrollbar-thin">
                <div className="space-y-0">
                    {plan.steps.map((step, idx) => (
                        <div key={step.id} className="flex gap-3">
                            <StepIndicator
                                status={step.status}
                                index={idx}
                                isLast={idx === plan.steps.length - 1}
                            />
                            <div
                                className={cn(
                                    'flex-1 pb-4 transition-all duration-300',
                                    step.status === 'pending' && 'opacity-40'
                                )}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <p
                                        className={cn(
                                            'text-xs font-mono leading-relaxed flex-1',
                                            step.status === 'completed' &&
                                                'text-muted-foreground line-through decoration-success/30',
                                            step.status === 'executing' &&
                                                'text-foreground font-medium',
                                            step.status === 'failed' && 'text-destructive',
                                            step.status === 'pending' && 'text-foreground/60'
                                        )}
                                    >
                                        {step.description}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        {/* AGT-PLN-05: Confidence score display */}
                                        {step.confidence && (
                                            <span
                                                className={cn(
                                                    'text-[8px] font-mono whitespace-nowrap px-1 rounded',
                                                    step.confidence.score >= 70 && 'text-success/80 bg-success/10',
                                                    step.confidence.score >= 40 && step.confidence.score < 70 && 'text-warning/80 bg-warning/10',
                                                    step.confidence.score < 40 && 'text-destructive/80 bg-destructive/10'
                                                )}
                                                title={step.confidence.explanation ?? `Confidence: ${step.confidence.score}%`}
                                            >
                                                {step.confidence.score}%
                                            </span>
                                        )}
                                        {/* AGT-TOK-05: Per-step cost display */}
                                        {plan.estimatedCost?.stepBreakdown?.[idx] && (
                                            <span className="text-[8px] font-mono text-muted-foreground/60 whitespace-nowrap">
                                                ~{formatCost(plan.estimatedCost.stepBreakdown[idx].estimatedCostUsd)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {step.toolCalls && step.toolCalls.length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {step.toolCalls.map((tool, i) => (
                                            <span
                                                key={i}
                                                className="px-1.5 py-0.5 text-[9px] font-mono bg-warning/10 text-warning/70 rounded border border-warning/20"
                                            >
                                                {tool}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Approval buttons */}
            {awaitingApproval && onApprove && onReject && (
                <div className="shrink-0 p-3 border-t border-border bg-card/30 flex gap-2">
                    <button
                        onClick={onReject}
                        className="flex-1 py-2.5 px-4 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all border border-destructive/20 hover:border-destructive/40 flex items-center justify-center gap-2"
                    >
                        <XCircle className="w-3.5 h-3.5" />
                        {t('agent.rejectPlan')}
                    </button>
                    <button
                        onClick={onApprove}
                        className="flex-1 py-2.5 px-4 bg-success/10 hover:bg-success/20 text-success rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all border border-success/20 hover:border-success/40 shadow-[0_0_15px_hsl(var(--success)/0.1)] hover:shadow-[0_0_20px_hsl(var(--success)/0.2)] flex items-center justify-center gap-2"
                    >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t('agent.approveExecute')}
                    </button>
                </div>
            )}
        </div>
    );
};

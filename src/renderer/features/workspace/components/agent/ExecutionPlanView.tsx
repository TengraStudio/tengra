import type { PlanCostBreakdown, StepComment, StepConfidence } from '@shared/types/project-agent';
import {
    CheckCircle2,
    Coins,
    Edit3,
    Flag,
    GitBranch,
    Loader2,
    MessageSquare,
    ShieldCheck,
    SkipForward,
    Target,
    XCircle,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

export interface ExecutionPlan {
    id: string;
    taskId: string;
    planNumber: number;
    status: 'pending' | 'awaiting_approval' | 'executing' | 'completed' | 'failed';
    steps: {
        id: string;
        description: string;
        status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped' | 'awaiting_step_approval';
        toolCalls?: string[];
        /** AGT-PLN-05: Confidence score for this step */
        confidence?: StepConfidence;
        /** AGT-HIL-01: Step requires explicit user approval */
        requiresApproval?: boolean;
        /** AGT-HIL-03: Step can be skipped */
        isSkippable?: boolean;
        /** AGT-HIL-04: Manual intervention point */
        isInterventionPoint?: boolean;
        /** AGT-HIL-05: User comments on this step */
        comments?: StepComment[];
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
    /** AGT-HIL: Callbacks for step-level human-in-the-loop actions */
    onApproveStep?: (stepId: string) => void;
    onSkipStep?: (stepId: string) => void;
    onEditStep?: (stepId: string, newText: string) => void;
    onAddComment?: (stepId: string, comment: string) => void;
    onInsertIntervention?: (afterStepId: string) => void;
}

const StepIndicator: React.FC<{ status: string; index: number; isLast: boolean }> = ({
    status,
    index,
    isLast,
}) => {
    const getIcon = useCallback(() => {
        switch (status) {
            case 'completed':
                return <CheckCircle2 className="w-3.5 h-3.5 text-success" />;
            case 'executing':
                return <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />;
            case 'failed':
                return <XCircle className="w-3.5 h-3.5 text-destructive" />;
            case 'skipped':
                return <SkipForward className="w-3.5 h-3.5 text-muted-foreground" />;
            case 'awaiting_step_approval':
                return <ShieldCheck className="w-3.5 h-3.5 text-warning animate-pulse" />;
            default:
                return (
                    <div className="w-3.5 h-3.5 rounded-full border border-border flex items-center justify-center">
                        <span className="text-[8px] font-mono text-muted-foreground">
                            {index + 1}
                        </span>
                    </div>
                );
        }
    }, [status, index]);

    return (
        <div className="flex flex-col items-center">
            <div
                className={cn(
                    'w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-300',
                    status === 'completed' && 'bg-success/10 border border-success/30',
                    status === 'executing' &&
                    'bg-primary/10 border border-primary/30 shadow-[0_0_10px_hsl(var(--primary)/0.2)]',
                    status === 'failed' && 'bg-destructive/10 border border-destructive/30',
                    status === 'skipped' && 'bg-muted/20 border border-border/50',
                    status === 'awaiting_step_approval' &&
                    'bg-warning/10 border border-warning/30 shadow-[0_0_10px_hsl(var(--warning)/0.2)]',
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
    onApproveStep,
    onSkipStep,
    onEditStep,
    onAddComment,
    onInsertIntervention,
}) => {
    const [editingStepId, setEditingStepId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');
    const [commentingStepId, setCommentingStepId] = useState<string | null>(null);
    const [commentText, setCommentText] = useState('');

    const completedCount = useMemo(
        () => plan.steps.filter(s => s.status === 'completed').length,
        [plan.steps]
    );
    const progress = useMemo(
        () => (completedCount / plan.steps.length) * 100,
        [completedCount, plan.steps.length]
    );

    const handleStartEdit = useCallback((stepId: string, currentText: string) => {
        setEditingStepId(stepId);
        setEditText(currentText);
    }, []);

    const handleSubmitEdit = useCallback(() => {
        if (editingStepId && editText.trim() && onEditStep) {
            onEditStep(editingStepId, editText.trim());
        }
        setEditingStepId(null);
        setEditText('');
    }, [editingStepId, editText, onEditStep]);

    const handleSubmitComment = useCallback(() => {
        if (commentingStepId && commentText.trim() && onAddComment) {
            onAddComment(commentingStepId, commentText.trim());
        }
        setCommentingStepId(null);
        setCommentText('');
    }, [commentingStepId, commentText, onAddComment]);

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
                                    step.status === 'pending' && 'opacity-40',
                                    step.status === 'skipped' && 'opacity-30'
                                )}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    {editingStepId === step.id ? (
                                        <div className="flex-1 flex gap-1.5">
                                            <input
                                                type="text"
                                                value={editText}
                                                onChange={e => setEditText(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') { handleSubmitEdit(); }
                                                    if (e.key === 'Escape') { setEditingStepId(null); }
                                                }}
                                                className="flex-1 text-xs font-mono bg-background/50 border border-border rounded px-2 py-1 focus:outline-none focus:border-primary"
                                                autoFocus
                                            />
                                            <button
                                                onClick={handleSubmitEdit}
                                                className="px-2 py-1 text-[9px] font-mono bg-success/10 text-success rounded border border-success/20 hover:bg-success/20"
                                            >
                                                {t('agent.hilSave')}
                                            </button>
                                        </div>
                                    ) : (
                                        <p
                                            className={cn(
                                                'text-xs font-mono leading-relaxed flex-1',
                                                step.status === 'completed' &&
                                                'text-muted-foreground line-through decoration-success/30',
                                                step.status === 'executing' &&
                                                'text-foreground font-medium',
                                                step.status === 'failed' && 'text-destructive',
                                                step.status === 'skipped' &&
                                                'text-muted-foreground line-through decoration-border',
                                                step.status === 'awaiting_step_approval' &&
                                                'text-warning font-medium',
                                                step.status === 'pending' && 'text-foreground/60'
                                            )}
                                        >
                                            {step.isInterventionPoint && (
                                                <Flag className="w-3 h-3 inline mr-1 text-warning" />
                                            )}
                                            {step.description}
                                        </p>
                                    )}
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

                                {/* AGT-HIL: Step-level action buttons */}
                                {step.status === 'awaiting_step_approval' && (
                                    <div className="mt-1.5 flex items-center gap-1.5">
                                        {onApproveStep && (
                                            <button
                                                onClick={() => onApproveStep(step.id)}
                                                className="px-2 py-1 text-[9px] font-mono font-bold uppercase tracking-wider bg-success/10 text-success rounded border border-success/20 hover:bg-success/20 transition-all flex items-center gap-1"
                                            >
                                                <ShieldCheck className="w-3 h-3" />
                                                {t('agent.hilApproveStep')}
                                            </button>
                                        )}
                                        {onSkipStep && (
                                            <button
                                                onClick={() => onSkipStep(step.id)}
                                                className="px-2 py-1 text-[9px] font-mono font-bold uppercase tracking-wider bg-muted/50 text-muted-foreground rounded border border-border hover:bg-muted transition-all flex items-center gap-1"
                                            >
                                                <SkipForward className="w-3 h-3" />
                                                {t('agent.hilSkipStep')}
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* AGT-HIL-02: Edit + Comment + Intervention buttons for pending steps */}
                                {(step.status === 'pending' || step.status === 'awaiting_step_approval') && (
                                    <div className="mt-1 flex items-center gap-1">
                                        {onEditStep && editingStepId !== step.id && (
                                            <button
                                                onClick={() => handleStartEdit(step.id, step.description)}
                                                className="p-0.5 text-muted-foreground/40 hover:text-foreground/70 transition-colors"
                                                title={t('agent.hilEditStep')}
                                            >
                                                <Edit3 className="w-3 h-3" />
                                            </button>
                                        )}
                                        {onAddComment && (
                                            <button
                                                onClick={() => setCommentingStepId(
                                                    commentingStepId === step.id ? null : step.id
                                                )}
                                                className={cn(
                                                    'p-0.5 transition-colors',
                                                    commentingStepId === step.id
                                                        ? 'text-primary'
                                                        : 'text-muted-foreground/40 hover:text-foreground/70'
                                                )}
                                                title={t('agent.hilAddComment')}
                                            >
                                                <MessageSquare className="w-3 h-3" />
                                            </button>
                                        )}
                                        {onInsertIntervention && (
                                            <button
                                                onClick={() => onInsertIntervention(step.id)}
                                                className="p-0.5 text-muted-foreground/40 hover:text-warning/70 transition-colors"
                                                title={t('agent.hilInsertIntervention')}
                                            >
                                                <Flag className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* AGT-HIL-05: Comment input */}
                                {commentingStepId === step.id && (
                                    <div className="mt-1.5 flex gap-1.5">
                                        <input
                                            type="text"
                                            value={commentText}
                                            onChange={e => setCommentText(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') { handleSubmitComment(); }
                                                if (e.key === 'Escape') { setCommentingStepId(null); }
                                            }}
                                            placeholder={t('agent.hilCommentPlaceholder')}
                                            className="flex-1 text-[10px] font-mono bg-background/50 border border-border rounded px-2 py-1 focus:outline-none focus:border-primary"
                                            autoFocus
                                        />
                                        <button
                                            onClick={handleSubmitComment}
                                            className="px-2 py-1 text-[9px] font-mono bg-primary/10 text-primary rounded border border-primary/20 hover:bg-primary/20"
                                        >
                                            {t('agent.hilAdd')}
                                        </button>
                                    </div>
                                )}

                                {/* AGT-HIL-05: Existing comments display */}
                                {step.comments && step.comments.length > 0 && (
                                    <div className="mt-1.5 space-y-1">
                                        {step.comments.map(c => (
                                            <div key={c.id} className="flex items-start gap-1.5 text-[9px] font-mono text-muted-foreground/70">
                                                <MessageSquare className="w-2.5 h-2.5 mt-0.5 shrink-0" />
                                                <span>{c.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

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

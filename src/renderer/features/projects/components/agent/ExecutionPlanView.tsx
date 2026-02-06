import { CheckCircle, XCircle } from 'lucide-react';
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
    }[];
    currentStep: number;
    createdAt: Date;
}

interface ExecutionPlanViewProps {
    plan: ExecutionPlan;
    onApprove?: () => void;
    onReject?: () => void;
    awaitingApproval?: boolean;
    t: (key: string, options?: Record<string, string | number>) => string;
}

export const ExecutionPlanView: React.FC<ExecutionPlanViewProps> = ({ plan, onApprove, onReject, awaitingApproval, t }) => {
    return (
        <div className="flex-1 bg-card rounded-xl border border-border flex flex-col min-h-0 overflow-hidden">
            <div className="p-3 border-b border-border shrink-0 flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">{t('agent.executionPlan')}</h3>
                {awaitingApproval && (
                    <span className="text-xs text-warning font-medium animate-pulse">{t('agent.awaitingApproval')}</span>
                )}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 scrollbar-thin">
                {plan.steps.map((step, idx) => (
                    <div key={step.id} className="flex gap-2">
                        <div className="flex flex-col items-center pt-1">
                            <div className={cn(
                                "w-4 h-4 rounded-full border-2 flex items-center justify-center text-xxxs font-bold",
                                step.status === 'completed' && "bg-success border-success text-white",
                                step.status === 'executing' && "border-primary text-primary animate-pulse",
                                step.status === 'pending' && "border-muted text-muted-foreground"
                            )}>
                                {idx + 1}
                            </div>
                            {idx < plan.steps.length - 1 && (
                                <div className="w-0.5 flex-1 bg-border my-1" />
                            )}
                        </div>
                        <div className="flex-1 pb-2">
                            <p className={cn(
                                "text-xs",
                                step.status === 'completed' && "text-muted-foreground line-through",
                                step.status === 'executing' && "text-foreground font-medium",
                                step.status === 'pending' && "text-muted-foreground"
                            )}>
                                {step.description}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Approval Buttons */}
            {awaitingApproval && onApprove && onReject && (
                <div className="p-3 border-t border-border flex gap-2 shrink-0 bg-muted/30">
                    <button
                        onClick={onReject}
                        className="flex-1 py-2 px-4 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <XCircle className="w-4 h-4" />
                        {t('agent.rejectPlan')}
                    </button>
                    <button
                        onClick={onApprove}
                        className="flex-1 py-2 px-4 bg-success hover:bg-success/90 text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <CheckCircle className="w-4 h-4" />
                        {t('agent.approveExecute')}
                    </button>
                </div>
            )}
        </div>
    );
};

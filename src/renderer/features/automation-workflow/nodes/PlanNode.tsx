import { Handle, Node, NodeProps, Position } from '@xyflow/react';
import { AlertCircle, CheckCircle2, Circle, GitBranch, Loader2, Merge, Milestone } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

export type PlanNodeData = {
    label?: string;
    description?: string;
    status?: 'pending' | 'running' | 'completed' | 'failed' | 'waiting';
    stepIndex?: number;
    stepId?: string;
    stepType?: 'task' | 'fork' | 'join';
    lane?: number;
    dependsOn?: string[];
    planParentId?: string;
    autoPlanNode?: boolean;
};

const PlanStepStatusIcon: React.FC<{ status: PlanNodeData['status'] }> = ({ status }) => {
    if (status === 'completed') {
        return <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />;
    }
    if (status === 'running') {
        return <Loader2 className="w-3.5 h-3.5 text-info animate-spin shrink-0" />;
    }
    if (status === 'failed') {
        return <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />;
    }
    return <Circle className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />;
};

export const PlanNode = ({ data, selected }: NodeProps<Node<PlanNodeData>>) => {
    const stepIndex = typeof data.stepIndex === 'number' ? data.stepIndex : 0;
    const stepType = data.stepType ?? 'task';
    const label = data.label ?? `Plan ${stepIndex > 0 ? stepIndex : ''}`.trim();
    const description = data.description ?? '';
    const lane = data.lane ?? 0;
    const typeIcon =
        stepType === 'fork' ? (
            <GitBranch className="w-3.5 h-3.5 text-info shrink-0" />
        ) : stepType === 'join' ? (
            <Merge className="w-3.5 h-3.5 text-warning shrink-0" />
        ) : (
            <Milestone className="w-3.5 h-3.5 text-primary shrink-0" />
        );

    return (
        <div
            className={cn(
                "w-[320px] rounded-xl border bg-card/95 backdrop-blur-xl shadow-lg transition-all",
                "border-border/60",
                stepType === 'fork' && "border-info/50 bg-info/5",
                stepType === 'join' && "border-warning/50 bg-warning/5",
                selected && "border-primary shadow-primary/20"
            )}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background transition-colors hover:!bg-primary"
            />
            <div className="px-3 py-2 border-b border-border/20 bg-muted/10 rounded-t-xl flex items-center gap-2">
                {typeIcon}
                <span className="text-xs font-semibold text-foreground">{label}</span>
                <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-wide">
                    lane {lane + 1}
                </span>
            </div>
            <div className="px-3 py-2.5 flex items-start gap-2.5">
                <PlanStepStatusIcon status={data.status} />
                <div className="flex-1">
                    <p className="text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
                        {description}
                    </p>
                    {data.dependsOn && data.dependsOn.length > 0 ? (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                            Depends on: {data.dependsOn.join(', ')}
                        </p>
                    ) : null}
                </div>
            </div>
            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background transition-colors hover:!bg-primary"
            />
        </div>
    );
};

import { Handle, Node, NodeProps, Position } from '@xyflow/react';
import { AlertCircle, CheckCircle2, Circle, ListTodo,Loader2 } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

export type PlanNodeData = {
    label?: string;
    description?: string;
    status?: 'pending' | 'running' | 'completed' | 'failed' | 'waiting';
    stepIndex?: number;
    stepId?: string;
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
    const label = data.label ?? `Plan ${stepIndex > 0 ? stepIndex : ''}`.trim();
    const description = data.description ?? '';

    return (
        <div
            className={cn(
                "w-[320px] rounded-xl border bg-card/95 backdrop-blur-xl shadow-lg transition-all",
                "border-border/60",
                selected && "border-primary shadow-primary/20"
            )}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background transition-colors hover:!bg-primary"
            />
            <div className="px-3 py-2 border-b border-border/20 bg-muted/10 rounded-t-xl flex items-center gap-2">
                <ListTodo className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-xs font-semibold text-foreground">{label}</span>
            </div>
            <div className="px-3 py-2.5 flex items-start gap-2.5">
                <PlanStepStatusIcon status={data.status} />
                <p className="text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
                    {description}
                </p>
            </div>
            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background transition-colors hover:!bg-primary"
            />
        </div>
    );
};


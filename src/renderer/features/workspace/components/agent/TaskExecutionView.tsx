import React from 'react';

import { ActivityLog, ActivityStream } from './ActivityStream';
import { ExecutionPlan, ExecutionPlanView } from './ExecutionPlanView';
import { ToolExecution, ToolTracking } from './ToolTracking';

interface TaskExecutionViewProps {
    activityLogs: ActivityLog[];
    toolExecutions: ToolExecution[];
    currentPlan: ExecutionPlan | null;
    scrollEndRef: React.RefObject<HTMLDivElement>;
    awaitingApproval?: boolean;
    onApprovePlan?: () => void;
    onRejectPlan?: () => void;
    t: (key: string, options?: Record<string, string | number>) => string;
    /** AGT-HIL: Callbacks for step-level human-in-the-loop actions */
    onApproveStep?: (stepId: string) => void;
    onSkipStep?: (stepId: string) => void;
    onEditStep?: (stepId: string, newText: string) => void;
    onAddComment?: (stepId: string, comment: string) => void;
    onInsertIntervention?: (afterStepId: string) => void;
}

export const TaskExecutionView: React.FC<TaskExecutionViewProps> = ({
    activityLogs,
    toolExecutions,
    currentPlan,
    scrollEndRef,
    awaitingApproval,
    onApprovePlan,
    onRejectPlan,
    t,
    onApproveStep,
    onSkipStep,
    onEditStep,
    onAddComment,
    onInsertIntervention,
}) => {
    return (
        <div className="h-full flex gap-4">
            {/* Activity Stream - takes remaining width */}
            <ActivityStream
                logs={activityLogs}
                scrollEndRef={scrollEndRef}
            />

            {/* Right column: Execution Plan and Tool Tracking */}
            <div className="w-80 flex flex-col gap-4 min-h-0 overflow-hidden">
                {/* Execution Plan View */}
                {currentPlan && (
                    <ExecutionPlanView
                        plan={currentPlan}
                        awaitingApproval={awaitingApproval}
                        onApprove={onApprovePlan}
                        onReject={onRejectPlan}
                        t={t}
                        onApproveStep={onApproveStep}
                        onSkipStep={onSkipStep}
                        onEditStep={onEditStep}
                        onAddComment={onAddComment}
                        onInsertIntervention={onInsertIntervention}
                    />
                )}

                {/* Tool Tracking View */}
                <ToolTracking executions={toolExecutions} t={t} />
            </div>
        </div>
    );
};

import { Clock, Play, Power, PowerOff, Trash2, Zap } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';
import { Workflow } from '@/types/workflow.types';

interface WorkflowListProps {
    workflows: Workflow[];
    selectedWorkflow: Workflow | null;
    onSelectWorkflow: (workflow: Workflow) => void;
    onToggleWorkflow: (workflow: Workflow) => void;
    onRunWorkflow: (workflowId: string) => void;
    onDeleteWorkflow: (workflowId: string) => void;
}

/**
 * Component to display list of workflows with actions
 */
export const WorkflowList: React.FC<WorkflowListProps> = ({
    workflows,
    selectedWorkflow,
    onSelectWorkflow,
    onToggleWorkflow,
    onRunWorkflow,
    onDeleteWorkflow,
}) => {
    const { t } = useTranslation();

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="space-y-3">
            {workflows.map((workflow) => {
                const isSelected = selectedWorkflow?.id === workflow.id;
                const hasRun = workflow.lastRunAt !== undefined;
                const isSuccess = workflow.lastRunStatus === 'success';

                return (
                    <div
                        key={workflow.id}
                        className={`
                            group relative rounded-lg border transition-all
                            ${isSelected
                                ? 'border-foreground/40 bg-muted/50'
                                : 'border-border/40 hover:border-border/60 hover:bg-muted/30'
                            }
                        `}
                    >
                        <div className="p-4">
                            {/* Header */}
                            <div className="flex items-start justify-between gap-4 mb-3">
                                <div className="flex-1 min-w-0">
                                    <button
                                        onClick={() => onSelectWorkflow(workflow)}
                                        className="text-left w-full group/title"
                                    >
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-lg truncate group-hover/title:text-foreground/80 transition-colors">
                                                {workflow.name}
                                            </h3>
                                            {workflow.enabled ? (
                                                <Power className="w-4 h-4 text-green-500 flex-shrink-0" />
                                            ) : (
                                                <PowerOff className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                            )}
                                        </div>
                                        {workflow.description && (
                                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                                {workflow.description}
                                            </p>
                                        )}
                                    </button>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                        onClick={() => onToggleWorkflow(workflow)}
                                        className={`
                                            p-2 rounded-md transition-colors
                                            ${workflow.enabled
                                                ? 'hover:bg-orange-500/10 text-orange-500'
                                                : 'hover:bg-green-500/10 text-green-500'
                                            }
                                        `}
                                        title={workflow.enabled ? t('workflows.disable') : t('workflows.enable')}
                                    >
                                        {workflow.enabled ? (
                                            <PowerOff className="w-4 h-4" />
                                        ) : (
                                            <Power className="w-4 h-4" />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => onRunWorkflow(workflow.id)}
                                        className="p-2 rounded-md hover:bg-blue-500/10 text-blue-500 transition-colors"
                                        title={t('workflows.run')}
                                    >
                                        <Play className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => onDeleteWorkflow(workflow.id)}
                                        className="p-2 rounded-md hover:bg-destructive/10 text-destructive transition-colors"
                                        title={t('common.delete')}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Metadata */}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                    <Zap className="w-3.5 h-3.5" />
                                    <span>
                                        {workflow.triggers.length} {t('workflows.triggers')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span>•</span>
                                    <span>
                                        {workflow.steps.length} {t('workflows.steps')}
                                    </span>
                                </div>
                                {hasRun && (
                                    <>
                                        <div className="flex items-center gap-1.5">
                                            <span>•</span>
                                            <Clock className="w-3.5 h-3.5" />
                                            <span>
                                                {t('workflows.lastRun')}: {workflow.lastRunAt ? `${formatDate(workflow.lastRunAt)} ${formatTime(workflow.lastRunAt)}` : ''}
                                            </span>
                                        </div>
                                        <div className={`
                                            px-2 py-0.5 rounded-full text-xs font-medium
                                            ${isSuccess
                                                ? 'bg-green-500/10 text-green-500'
                                                : 'bg-red-500/10 text-red-500'
                                            }
                                        `}>
                                            {isSuccess ? t('workflows.success') : t('workflows.failure')}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

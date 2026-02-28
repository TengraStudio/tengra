import { AlertTriangle, Loader2, Play, Plus, RefreshCw, Search } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/i18n';
import { pushNotification } from '@/store/notification-center.store';
import { Workflow } from '@/types/workflow.types';
import { appLogger } from '@/utils/renderer-logger';

import { WorkflowEditor } from './components/WorkflowEditor';
import { WorkflowList } from './components/WorkflowList';

/**
 * Main page for managing workflows
 * Displays list of workflows and provides CRUD operations
 */
export const WorkflowsPage: React.FC = () => {
    const { t } = useTranslation();
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [executingIds, setExecutingIds] = useState<Set<string>>(new Set());
    const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    const loadWorkflows = useCallback(async () => {
        try {
            setIsLoading(true);
            setLoadError(null);
            const result = await window.electron.workflow.getAll();
            setWorkflows(result);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            setLoadError(msg);
            appLogger.error('WorkflowsPage', 'Failed to load workflows', error as Error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Load workflows on mount
    useEffect(() => {
        void loadWorkflows();
    }, [loadWorkflows]);

    const handleCreateWorkflow = useCallback(async () => {
        try {
            const newWorkflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'> = {
                name: t('workflows.defaultName'),
                description: t('workflows.defaultDescription'),
                enabled: true,
                triggers: [],
                steps: [],
            };

            const created = await window.electron.workflow.create(newWorkflow);
            setWorkflows(prev => [...prev, created]);
            setSelectedWorkflow(created);
            setIsEditing(true);
        } catch (error) {
            appLogger.error('WorkflowsPage', 'Failed to create workflow', error as Error);
            pushNotification({ type: 'error', message: t('workflows.errors.createFailed'), source: 'workflows' });
        }
    }, [t]);

    const handleUpdateWorkflow = useCallback(async (workflow: Workflow) => {
        try {
            const updated = await window.electron.workflow.update(workflow.id, workflow);
            setWorkflows(prev => prev.map(w => w.id === workflow.id ? updated : w));
            setSelectedWorkflow(null);
            setIsEditing(false);
        } catch (error) {
            appLogger.error('WorkflowsPage', 'Failed to update workflow', error as Error);
            pushNotification({ type: 'error', message: t('workflows.errors.updateFailed'), source: 'workflows' });
        }
    }, [t]);

    const handleDeleteWorkflow = useCallback(async (workflowId: string) => {
        try {
            await window.electron.workflow.delete(workflowId);
            setWorkflows(prev => prev.filter(w => w.id !== workflowId));
            if (selectedWorkflow?.id === workflowId) {
                setSelectedWorkflow(null);
                setIsEditing(false);
            }
        } catch (error) {
            appLogger.error('WorkflowsPage', 'Failed to delete workflow', error as Error);
            pushNotification({ type: 'error', message: t('workflows.errors.deleteFailed'), source: 'workflows' });
        }
    }, [selectedWorkflow, t]);

    const handleToggleWorkflow = useCallback(async (workflow: Workflow) => {
        try {
            const updated = await window.electron.workflow.update(workflow.id, {
                ...workflow,
                enabled: !workflow.enabled,
            });
            setWorkflows(prev => prev.map(w => w.id === workflow.id ? updated : w));
        } catch (error) {
            appLogger.error('WorkflowsPage', 'Failed to toggle workflow', error as Error);
            pushNotification({ type: 'error', message: t('workflows.errors.toggleFailed'), source: 'workflows' });
        }
    }, [t]);

    const handleRunWorkflow = useCallback(async (workflowId: string) => {
        try {
            setExecutingIds(prev => new Set(prev).add(workflowId));
            const result = await window.electron.workflow.execute(workflowId, {});
            if (result.status === 'success') {
                pushNotification({ type: 'success', message: t('workflows.execution.executedSuccessfully', { workflowId }), source: 'workflows' });
            } else {
                pushNotification({ type: 'error', message: t('workflows.execution.failed'), source: 'workflows' });
            }
            void loadWorkflows();
        } catch (error) {
            appLogger.error('WorkflowsPage', 'Failed to execute workflow', error as Error);
            pushNotification({ type: 'error', message: t('workflows.errors.executeFailed'), source: 'workflows' });
        } finally {
            setExecutingIds(prev => {
                const next = new Set(prev);
                next.delete(workflowId);
                return next;
            });
        }
    }, [t, loadWorkflows]);

    const handleSelectWorkflow = (workflow: Workflow) => {
        setSelectedWorkflow(workflow);
        setIsEditing(true);
    };

    // Filter workflows based on search query
    const filteredWorkflows = React.useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) {
            return workflows;
        }
        return workflows.filter(w =>
            w.name.toLowerCase().includes(query) ||
            (w.description?.toLowerCase().includes(query) ?? false)
        );
    }, [workflows, searchQuery]);

    return (
        <div className="h-full flex flex-col bg-background p-8 overflow-y-auto">
            <div className="max-w-5xl mx-auto w-full space-y-8">
                {/* Header */}
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">
                        {t('workflows.title')}
                    </h1>
                    <p className="text-muted-foreground">
                        {t('workflows.subtitle')}
                    </p>
                </div>

                {/* Search and Actions */}
                <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder={t('workflows.searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-border/40 bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                        />
                    </div>
                    <button
                        onClick={() => void handleCreateWorkflow()}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors font-medium text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        {t('workflows.newWorkflow')}
                    </button>
                </div>

                {/* Workflows List */}
                {isLoading ? (
                    <div className="py-12 text-center">
                        <Loader2 className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3 animate-spin" />
                        <p className="text-muted-foreground">{t('common.loading')}</p>
                    </div>
                ) : loadError ? (
                    <div className="py-12 text-center border-2 border-dashed border-destructive/30 rounded-xl">
                        <AlertTriangle className="w-12 h-12 text-destructive/40 mx-auto mb-4" />
                        <p className="text-destructive font-medium">
                            {t('workflows.errors.loadFailed')}
                        </p>
                        <p className="text-xs text-muted-foreground/50 mt-1 mb-4">
                            {loadError}
                        </p>
                        <button
                            onClick={() => void loadWorkflows()}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors text-sm"
                        >
                            <RefreshCw className="w-4 h-4" />
                            {t('common.refresh')}
                        </button>
                    </div>
                ) : filteredWorkflows.length === 0 ? (
                    <div className="py-12 text-center border-2 border-dashed border-border/30 rounded-xl">
                        <Play className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                        <p className="text-muted-foreground font-medium">
                            {searchQuery ? t('workflows.noResults') : t('workflows.noWorkflows')}
                        </p>
                        <p className="text-xs text-muted-foreground/50 mt-1">
                            {t('workflows.createFirst')}
                        </p>
                    </div>
                ) : (
                    <WorkflowList
                        workflows={filteredWorkflows}
                        selectedWorkflow={selectedWorkflow}
                        executingIds={executingIds}
                        onSelectWorkflow={handleSelectWorkflow}
                        onToggleWorkflow={(w) => void handleToggleWorkflow(w)}
                        onRunWorkflow={(id) => void handleRunWorkflow(id)}
                        onDeleteWorkflow={(id) => void handleDeleteWorkflow(id)}
                    />
                )}

                {/* Editor Modal */}
                {isEditing && selectedWorkflow && (
                    <WorkflowEditor
                        workflow={selectedWorkflow}
                        onSave={handleUpdateWorkflow}
                        onCancel={() => {
                            setSelectedWorkflow(null);
                            setIsEditing(false);
                        }}
                    />
                )}
            </div>
        </div>
    );
};

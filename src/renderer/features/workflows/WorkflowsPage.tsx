import { Play, Plus, Search } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/i18n';
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
    const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    const loadWorkflows = useCallback(async () => {
        try {
            setIsLoading(true);
            const result = await window.electron.workflow.getAll();
            setWorkflows(result);
        } catch (error) {
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
                name: 'New Workflow',
                description: 'Workflow description',
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
        }
    }, []);

    const handleUpdateWorkflow = useCallback(async (workflow: Workflow) => {
        try {
            const updated = await window.electron.workflow.update(workflow.id, workflow);
            setWorkflows(prev => prev.map(w => w.id === workflow.id ? updated : w));
            setSelectedWorkflow(null);
            setIsEditing(false);
        } catch (error) {
            appLogger.error('WorkflowsPage', 'Failed to update workflow', error as Error);
        }
    }, []);

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
        }
    }, [selectedWorkflow]);

    const handleToggleWorkflow = useCallback(async (workflow: Workflow) => {
        try {
            const updated = await window.electron.workflow.update(workflow.id, {
                ...workflow,
                enabled: !workflow.enabled,
            });
            setWorkflows(prev => prev.map(w => w.id === workflow.id ? updated : w));
        } catch (error) {
            appLogger.error('WorkflowsPage', 'Failed to toggle workflow', error as Error);
        }
    }, []);

    const handleRunWorkflow = useCallback(async (workflowId: string) => {
        try {
            await window.electron.workflow.execute(workflowId, {});
            appLogger.info('WorkflowsPage', `Workflow ${workflowId} executed successfully`);
        } catch (error) {
            appLogger.error('WorkflowsPage', 'Failed to execute workflow', error as Error);
        }
    }, []);

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
                        <p className="text-muted-foreground">{t('common.loading')}</p>
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

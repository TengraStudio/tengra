import { AlertCircle, Code, Edit3, Save, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/i18n';
import { Workflow } from '@/types/workflow.types';
import { appLogger } from '@/utils/renderer-logger';

interface WorkflowEditorProps {
    workflow: Workflow;
    onSave: (workflow: Workflow) => Promise<void>;
    onCancel: () => void;
}

/**
 * Editor component for modifying workflow definitions
 */
export const WorkflowEditor: React.FC<WorkflowEditorProps> = ({
    workflow,
    onSave,
    onCancel,
}) => {
    const { t } = useTranslation();
    const [editedWorkflow, setEditedWorkflow] = useState<Workflow>({ ...workflow });
    const [jsonMode, setJsonMode] = useState(false);
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Update internal state when prop changes
    useEffect(() => {
        setEditedWorkflow({ ...workflow });
    }, [workflow]);

    const handleSave = useCallback(async () => {
        try {
            setIsSaving(true);
            await onSave(editedWorkflow);
        } catch (error) {
            appLogger.error('WorkflowEditor', 'Failed to save workflow', error as Error);
        } finally {
            setIsSaving(false);
        }
    }, [editedWorkflow, onSave]);

    const handleJsonChange = (val: string) => {
        try {
            const parsed = JSON.parse(val);
            setEditedWorkflow(parsed);
            setJsonError(null);
        } catch (e) {
            setJsonError((e as Error).message);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="bg-muted border border-border/50 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-border/50 flex items-center justify-between bg-background/20">
                    <div className="space-y-1">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Edit3 className="w-5 h-5 text-primary" />
                            {t('workflows.editWorkflow')}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            ID: {workflow.id}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setJsonMode(!jsonMode)}
                            className={`p-2 rounded-lg transition-colors ${jsonMode ? 'bg-primary/20 text-primary' : 'hover:bg-muted/50 text-muted-foreground'}`}
                            title={jsonMode ? t('workflows.switchToForm') : t('workflows.switchToJson')}
                        >
                            <Code className="w-5 h-5" />
                        </button>
                        <button
                            onClick={onCancel}
                            className="p-2 hover:bg-muted/50 rounded-lg text-muted-foreground transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {jsonMode ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{t('workflows.jsonDefinition')}</span>
                                {jsonError && (
                                    <div className="flex items-center gap-1.5 text-red-500 text-xs font-medium">
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        {jsonError}
                                    </div>
                                )}
                            </div>
                            <textarea
                                className={`w-full h-[500px] font-mono text-xs p-4 rounded-xl bg-background border ${jsonError ? 'border-red-500/50' : 'border-border/50'} focus:outline-none focus:ring-2 focus:ring-primary/20`}
                                value={JSON.stringify(editedWorkflow, null, 2)}
                                onChange={(e) => handleJsonChange(e.target.value)}
                            />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        {t('workflows.name')}
                                    </label>
                                    <input
                                        type="text"
                                        value={editedWorkflow.name}
                                        onChange={(e) => setEditedWorkflow(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full px-4 py-2 rounded-lg bg-background border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        {t('workflows.enabled')}
                                    </label>
                                    <div className="flex items-center h-[42px]">
                                        <button
                                            onClick={() => setEditedWorkflow(prev => ({ ...prev, enabled: !prev.enabled }))}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editedWorkflow.enabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editedWorkflow.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    {t('workflows.description')}
                                </label>
                                <textarea
                                    value={editedWorkflow.description}
                                    onChange={(e) => setEditedWorkflow(prev => ({ ...prev, description: e.target.value }))}
                                    rows={3}
                                    className="w-full px-4 py-2 rounded-lg bg-background border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                                />
                            </div>

                            {/* Triggers & Steps Summary */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/30">
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold">{t('workflows.triggers')} ({editedWorkflow.triggers.length})</h3>
                                    <div className="space-y-2">
                                        {editedWorkflow.triggers.map((trigger, idx) => (
                                            <div key={trigger.id || idx} className="p-3 rounded-lg bg-background/50 border border-border/30 text-xs">
                                                <span className="font-mono text-primary mr-2 uppercase">{trigger.type}</span>
                                                <span className="text-muted-foreground">{trigger.id}</span>
                                            </div>
                                        ))}
                                        {editedWorkflow.triggers.length === 0 && (
                                            <p className="text-xs text-muted-foreground italic">{t('workflows.noTriggers')}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold">{t('workflows.steps')} ({editedWorkflow.steps.length})</h3>
                                    <div className="space-y-2">
                                        {editedWorkflow.steps.map((step, idx) => (
                                            <div key={step.id || idx} className="p-3 rounded-lg bg-background/50 border border-border/30 text-xs">
                                                <span className="font-medium mr-2">{idx + 1}. {step.name}</span>
                                                <span className="font-mono text-muted-foreground uppercase">({step.action.type})</span>
                                            </div>
                                        ))}
                                        {editedWorkflow.steps.length === 0 && (
                                            <p className="text-xs text-muted-foreground italic">{t('workflows.noSteps')}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <p className="text-[10px] text-muted-foreground italic text-center pt-4">
                                {t('workflows.editorNote')}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border/50 flex items-center justify-end gap-3 bg-background/20">
                    <button
                        onClick={onCancel}
                        disabled={isSaving}
                        className="px-4 py-2 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors text-sm"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={() => void handleSave()}
                        disabled={isSaving || !!jsonError}
                        className="px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save className="w-4 h-4" />
                        {isSaving ? t('common.saving') : t('common.save')}
                    </button>
                </div>
            </div>
        </div>
    );
};

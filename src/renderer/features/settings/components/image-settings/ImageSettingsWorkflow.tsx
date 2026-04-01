import { Share2, Workflow } from 'lucide-react';
import React from 'react';

import { ImageWorkflowTemplateEntry } from '../../types';

interface ImageSettingsWorkflowProps {
    workflowTemplates: ImageWorkflowTemplateEntry[];
    workflowTemplateName: string;
    setWorkflowTemplateName: (value: string) => void;
    workflowTemplateJson: string;
    setWorkflowTemplateJson: (value: string) => void;
    workflowShareCode: string;
    setWorkflowShareCode: (value: string) => void;
    handleSaveWorkflowTemplate: () => Promise<void>;
    handleDeleteWorkflowTemplate: (id: string) => Promise<void>;
    handleExportWorkflowTemplateShare: (id: string) => Promise<void>;
    handleImportWorkflowTemplateShare: () => Promise<void>;
    t: (key: string) => string | undefined;
}

export const ImageSettingsWorkflow: React.FC<ImageSettingsWorkflowProps> = ({
    workflowTemplates,
    workflowTemplateName,
    setWorkflowTemplateName,
    workflowTemplateJson,
    setWorkflowTemplateJson,
    workflowShareCode,
    setWorkflowShareCode,
    handleSaveWorkflowTemplate,
    handleDeleteWorkflowTemplate,
    handleExportWorkflowTemplateShare,
    handleImportWorkflowTemplateShare,
    t,
}) => {
    return (
        <div className="rounded-xl border border-border/40 bg-muted/30 p-4">
            <h5 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Workflow className="h-3.5 w-3.5" />
                {t('settings.images.workflowTitle')}
            </h5>
            <input
                value={workflowTemplateName}
                onChange={event => setWorkflowTemplateName(event.target.value)}
                placeholder={t('settings.images.workflowTemplateName')}
                className="mb-2 w-full rounded-md border border-border/40 bg-background/40 px-2 py-1.5 text-xs"
            />
            <textarea
                value={workflowTemplateJson}
                onChange={event => setWorkflowTemplateJson(event.target.value)}
                placeholder={t('settings.images.workflowTemplateJson')}
                className="tw-min-h-100 w-full rounded-md border border-border/40 bg-background/40 px-2 py-1.5 font-mono tw-text-11"
            />
            <button
                onClick={() => { void handleSaveWorkflowTemplate(); }}
                className="mt-2 rounded-lg border border-primary/35 px-2.5 py-1 tw-text-10 font-bold uppercase tracking-wider text-primary"
            >
                {t('settings.images.saveWorkflowTemplate')}
            </button>

            <div className="mt-3 space-y-1.5">
                {workflowTemplates.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t('settings.images.noWorkflowTemplates')}</p>
                ) : (
                    workflowTemplates.slice(0, 6).map(template => (
                        <div key={template.id} className="flex items-center justify-between gap-2 rounded border border-border/40 bg-background/40 px-2 py-1 text-xs">
                            <button
                                onClick={() => {
                                    setWorkflowTemplateName(template.name);
                                    setWorkflowTemplateJson(JSON.stringify(template.workflow, null, 2));
                                }}
                                className="min-w-0 truncate text-left text-foreground/90 hover:text-foreground"
                            >
                                {template.name}
                            </button>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => { void handleExportWorkflowTemplateShare(template.id); }}
                                    className="rounded border border-border/50 px-1.5 py-0.5 tw-text-10 text-muted-foreground"
                                    title={t('settings.images.exportWorkflowTemplate')}
                                >
                                    <Share2 className="h-3 w-3" />
                                </button>
                                <button
                                    onClick={() => { void handleDeleteWorkflowTemplate(template.id); }}
                                    className="rounded border border-border/50 px-1.5 py-0.5 tw-text-10 text-muted-foreground"
                                >
                                    {t('common.delete')}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="mt-3 rounded-lg border border-border/40 bg-background/40 p-2">
                <div className="mb-1 tw-text-10 font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('settings.images.workflowShareCode')}
                </div>
                <textarea
                    value={workflowShareCode}
                    onChange={event => setWorkflowShareCode(event.target.value)}
                    placeholder={t('settings.images.workflowShareCodePlaceholder')}
                    className="tw-min-h-60 w-full rounded-md border border-border/40 bg-background/40 px-2 py-1.5 font-mono tw-text-10"
                />
                <button
                    onClick={() => { void handleImportWorkflowTemplateShare(); }}
                    className="mt-2 rounded-lg border border-primary/35 px-2.5 py-1 tw-text-10 font-bold uppercase tracking-wider text-primary"
                >
                    {t('settings.images.importWorkflowTemplateShare')}
                </button>
            </div>
        </div>
    );
};

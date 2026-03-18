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
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h5 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Workflow className="h-3.5 w-3.5" />
                {t('settings.images.workflowTitle')}
            </h5>
            <input
                value={workflowTemplateName}
                onChange={event => setWorkflowTemplateName(event.target.value)}
                placeholder={t('settings.images.workflowTemplateName')}
                className="mb-2 w-full rounded-md border border-white/10 bg-black/10 px-2 py-1.5 text-xs"
            />
            <textarea
                value={workflowTemplateJson}
                onChange={event => setWorkflowTemplateJson(event.target.value)}
                placeholder={t('settings.images.workflowTemplateJson')}
                className="min-h-[100px] w-full rounded-md border border-white/10 bg-black/10 px-2 py-1.5 font-mono text-[11px]"
            />
            <button
                onClick={() => { void handleSaveWorkflowTemplate(); }}
                className="mt-2 rounded-lg border border-primary/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary"
            >
                {t('settings.images.saveWorkflowTemplate')}
            </button>

            <div className="mt-3 space-y-1.5">
                {workflowTemplates.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t('settings.images.noWorkflowTemplates')}</p>
                ) : (
                    workflowTemplates.slice(0, 6).map(template => (
                        <div key={template.id} className="flex items-center justify-between gap-2 rounded border border-white/10 bg-black/10 px-2 py-1 text-xs">
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
                                    className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                                    title={t('settings.images.exportWorkflowTemplate')}
                                >
                                    <Share2 className="h-3 w-3" />
                                </button>
                                <button
                                    onClick={() => { void handleDeleteWorkflowTemplate(template.id); }}
                                    className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                                >
                                    {t('common.delete')}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="mt-3 rounded-lg border border-white/10 bg-black/10 p-2">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('settings.images.workflowShareCode')}
                </div>
                <textarea
                    value={workflowShareCode}
                    onChange={event => setWorkflowShareCode(event.target.value)}
                    placeholder={t('settings.images.workflowShareCodePlaceholder')}
                    className="min-h-[60px] w-full rounded-md border border-white/10 bg-black/10 px-2 py-1.5 font-mono text-[10px]"
                />
                <button
                    onClick={() => { void handleImportWorkflowTemplateShare(); }}
                    className="mt-2 rounded-lg border border-primary/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary"
                >
                    {t('settings.images.importWorkflowTemplateShare')}
                </button>
            </div>
        </div>
    );
};

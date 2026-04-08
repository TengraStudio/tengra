import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Download, Plus, Share2, Trash2, Workflow, Zap } from 'lucide-react';
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
        <div className="bg-card rounded-3xl border border-border/40 p-8 space-y-8 shadow-sm group/workflow hover:border-border/60 transition-all duration-500 overflow-hidden relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-primary/10 text-primary shadow-lg shadow-primary/5 group-hover/workflow:scale-110 transition-transform duration-500">
                        <Workflow className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-foreground group-hover/workflow:text-primary transition-colors">
                            {t('settings.images.workflowTitle')}
                        </h3>
                        <p className="typo-body text-muted-foreground mt-1 font-bold opacity-60">
                            {workflowTemplates.length} {t('settings.images.activeTemplates')}
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-6 relative z-10">
                <div className="space-y-2">
                    <div className="typo-body font-bold text-muted-foreground/40 px-1">Template Name</div>
                    <Input
                        value={workflowTemplateName}
                        onChange={event => setWorkflowTemplateName(event.target.value)}
                        placeholder={t('settings.images.workflowTemplateName')}
                        className="h-12 px-6 rounded-2xl bg-muted/20 border-border/40 focus-visible:ring-primary/20 text-xs font-bold placeholder:text-muted-foreground/30 shadow-inner group-hover:bg-muted/30 transition-all"
                    />
                </div>
                <div className="space-y-2">
                    <div className="typo-body font-bold text-muted-foreground/40 px-1">Workflow Definition (JSON)</div>
                    <textarea
                        value={workflowTemplateJson}
                        onChange={event => setWorkflowTemplateJson(event.target.value)}
                        placeholder={t('settings.images.workflowTemplateJson')}
                        className="tw-min-h-56 w-full rounded-2xl border border-border/40 bg-muted/20 p-6 font-mono typo-body text-muted-foreground leading-relaxed shadow-inner focus:ring-1 focus:ring-primary/20 outline-none transition-all custom-scrollbar"
                    />
                </div>
                <Button
                    onClick={() => { void handleSaveWorkflowTemplate(); }}
                    className="h-12 px-8 rounded-2xl bg-foreground text-background hover:bg-primary hover:text-primary-foreground typo-body font-bold transition-all active:scale-95 shadow-xl shadow-black/10 flex items-center gap-3 w-full sm:w-auto"
                >
                    <Plus className="w-4 h-4" />
                    {t('settings.images.saveWorkflowTemplate')}
                </Button>
            </div>

            <div className="space-y-3 relative z-10">
                {workflowTemplates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center bg-muted/5 border-2 border-dashed border-border/20 rounded-2xl opacity-40">
                        <p className="typo-body font-bold text-muted-foreground px-6">
                            {t('settings.images.noWorkflowTemplates')}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {workflowTemplates.slice(0, 6).map(template => (
                            <div key={template.id} className="group/item flex items-center justify-between gap-4 bg-background/50 border border-border/20 rounded-2xl px-5 py-4 transition-all hover:bg-muted/10 hover:border-border/40 shadow-sm">
                                <button
                                    onClick={() => {
                                        setWorkflowTemplateName(template.name);
                                        setWorkflowTemplateJson(JSON.stringify(template.workflow, null, 2));
                                    }}
                                    className="flex items-center gap-4 min-w-0"
                                >
                                    <div className="h-2 w-2 rounded-full bg-primary/40 group-hover/item:bg-primary group-hover/item:scale-125 transition-all" />
                                    <span className="typo-body font-bold text-foreground truncate group-hover/item:text-primary transition-colors text-left">{template.name}</span>
                                </button>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => { void handleExportWorkflowTemplateShare(template.id); }}
                                        className="h-8 w-8 text-muted-foreground/40 hover:text-primary hover:bg-primary/10 rounded-xl transition-all hover:scale-110"
                                    >
                                        <Share2 className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => { void handleDeleteWorkflowTemplate(template.id); }}
                                        className="h-8 w-8 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all hover:scale-110"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-muted/20 border border-border/20 rounded-3xl p-6 space-y-4 relative z-10 group/share">
                <div className="flex items-center gap-3 px-1">
                    <Zap className="w-3.5 h-3.5 text-primary" />
                    <div className="typo-body font-bold text-muted-foreground/40">{t('settings.images.workflowShareCode')}</div>
                </div>
                <textarea
                    value={workflowShareCode}
                    onChange={event => setWorkflowShareCode(event.target.value)}
                    placeholder={t('settings.images.workflowShareCodePlaceholder')}
                    className="tw-min-h-32 w-full rounded-2xl border border-border/40 bg-background/40 p-6 font-mono typo-body text-muted-foreground leading-relaxed shadow-inner focus:ring-1 focus:ring-primary/20 outline-none transition-all custom-scrollbar"
                />
                <Button
                    onClick={() => { void handleImportWorkflowTemplateShare(); }}
                    className="h-10 px-6 rounded-xl border-border/40 bg-muted/40 typo-body font-bold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all active:scale-95 shadow-sm flex items-center gap-2 w-full"
                >
                    <Download className="w-3.5 h-3.5" />
                    {t('settings.images.importWorkflowTemplateShare')}
                </Button>
            </div>

            <div className="absolute -left-20 -top-20 w-80 h-80 bg-primary/5 rounded-full blur-[100px] opacity-30 pointer-events-none" />
        </div>
    );
};

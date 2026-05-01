/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconBolt,IconDownload, IconHierarchy, IconPlus, IconShare2, IconTrash } from '@tabler/icons-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { ImageWorkflowTemplateEntry } from '../../types';

/* Batch-02: Extracted Long Classes */
const C_IMAGESETTINGSWORKFLOW_1 = "bg-card rounded-3xl border border-border/40 p-8 space-y-8 shadow-sm group/workflow hover:border-border/60 transition-all duration-500 overflow-hidden relative lg:p-10";
const C_IMAGESETTINGSWORKFLOW_2 = "p-3 rounded-2xl bg-primary/10 text-primary shadow-lg shadow-primary/5 group-hover/workflow:scale-110 transition-transform duration-500";
const C_IMAGESETTINGSWORKFLOW_3 = "h-12 px-6 rounded-2xl bg-muted/20 border-border/40 focus-visible:ring-primary/20 typo-caption font-bold placeholder:text-muted-foreground/30 shadow-inner group-hover:bg-muted/30 transition-all";
const C_IMAGESETTINGSWORKFLOW_4 = "min-h-56 w-full rounded-2xl border border-border/40 bg-muted/20 p-6 font-mono typo-body text-muted-foreground leading-relaxed shadow-inner focus:ring-1 focus:ring-primary/20 outline-none transition-all custom-scrollbar lg:p-8";
const C_IMAGESETTINGSWORKFLOW_5 = "h-12 px-8 rounded-2xl bg-foreground text-background hover:bg-primary hover:text-primary-foreground typo-body font-bold transition-all active:scale-95 shadow-xl shadow-black/10 flex items-center gap-3 w-full sm:w-auto";
const C_IMAGESETTINGSWORKFLOW_6 = "flex flex-col items-center justify-center py-10 text-center bg-muted/5 border-2 border-dashed border-border/20 rounded-2xl opacity-40 sm:flex-row";
const C_IMAGESETTINGSWORKFLOW_7 = "group/item flex items-center justify-between gap-4 bg-background/50 border border-border/20 rounded-2xl px-5 py-4 transition-all hover:bg-muted/10 hover:border-border/40 shadow-sm sm:gap-5 lg:gap-6";
const C_IMAGESETTINGSWORKFLOW_8 = "h-8 w-8 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all hover:scale-110";
const C_IMAGESETTINGSWORKFLOW_9 = "min-h-32 w-full rounded-2xl border border-border/40 bg-background/40 p-6 font-mono typo-body text-muted-foreground leading-relaxed shadow-inner focus:ring-1 focus:ring-primary/20 outline-none transition-all custom-scrollbar lg:p-8";
const C_IMAGESETTINGSWORKFLOW_10 = "h-10 px-6 rounded-xl border-border/40 bg-muted/40 typo-body font-bold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all active:scale-95 shadow-sm flex items-center gap-2 w-full";


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
        <div className={C_IMAGESETTINGSWORKFLOW_1}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1 relative z-10">
                <div className="flex items-center gap-4">
                    <div className={C_IMAGESETTINGSWORKFLOW_2}>
                        <IconHierarchy className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-foreground group-hover/workflow:text-primary transition-colors">
                            {t('frontend.settings.images.workflowTitle')}
                        </h3>
                        <p className="typo-body text-muted-foreground mt-1 font-bold opacity-60">
                            {workflowTemplates.length} {t('frontend.settings.images.activeTemplates')}
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
                        placeholder={t('frontend.settings.images.workflowTemplateName')}
                        className={C_IMAGESETTINGSWORKFLOW_3}
                    />
                </div>
                <div className="space-y-2">
                    <div className="typo-body font-bold text-muted-foreground/40 px-1">Workflow Definition (JSON)</div>
                    <textarea
                        value={workflowTemplateJson}
                        onChange={event => setWorkflowTemplateJson(event.target.value)}
                        placeholder={t('frontend.settings.images.workflowTemplateJson')}
                        className={C_IMAGESETTINGSWORKFLOW_4}
                    />
                </div>
                <Button
                    onClick={() => { void handleSaveWorkflowTemplate(); }}
                    className={C_IMAGESETTINGSWORKFLOW_5}
                >
                    <IconPlus className="w-4 h-4" />
                    {t('frontend.settings.images.saveWorkflowTemplate')}
                </Button>
            </div>

            <div className="space-y-3 relative z-10">
                {workflowTemplates.length === 0 ? (
                    <div className={C_IMAGESETTINGSWORKFLOW_6}>
                        <p className="typo-body font-bold text-muted-foreground px-6">
                            {t('frontend.settings.images.noWorkflowTemplates')}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3 max-h-300 overflow-y-auto pr-2 custom-scrollbar">
                        {workflowTemplates.slice(0, 6).map(template => (
                            <div key={template.id} className={C_IMAGESETTINGSWORKFLOW_7}>
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
                                        <IconShare2 className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => { void handleDeleteWorkflowTemplate(template.id); }}
                                        className={C_IMAGESETTINGSWORKFLOW_8}
                                    >
                                        <IconTrash className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-muted/20 border border-border/20 rounded-3xl p-6 space-y-4 relative z-10 group/share">
                <div className="flex items-center gap-3 px-1">
                    <IconBolt className="w-3.5 h-3.5 text-primary" />
                    <div className="typo-body font-bold text-muted-foreground/40">{t('frontend.settings.images.workflowShareCode')}</div>
                </div>
                <textarea
                    value={workflowShareCode}
                    onChange={event => setWorkflowShareCode(event.target.value)}
                    placeholder={t('frontend.settings.images.workflowShareCodePlaceholder')}
                    className={C_IMAGESETTINGSWORKFLOW_9}
                />
                <Button
                    onClick={() => { void handleImportWorkflowTemplateShare(); }}
                    className={C_IMAGESETTINGSWORKFLOW_10}
                >
                    <IconDownload className="w-3.5 h-3.5" />
                    {t('frontend.settings.images.importWorkflowTemplateShare')}
                </Button>
            </div>

            <div className="absolute -left-20 -top-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl opacity-30 pointer-events-none" />
        </div>
    );
};

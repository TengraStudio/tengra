import React from 'react';

import { SettingsSectionProps } from './types';

export const AdvancedSection: React.FC<SettingsSectionProps> = ({ formData, setFormData, t }) => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">{t('projects.advanced') || 'Advanced Settings'}</h3>
            <p className="text-sm text-muted-foreground">{t('projects.advancedDesc') || 'Fine-tune your project configuration.'}</p>
        </div>

        <div className="space-y-4">
            <div className="p-4 bg-muted/20 border border-border/50 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-sm font-medium text-foreground">{t('projects.fileWatching') || 'File Watching'}</div>
                        <div className="text-xs text-muted-foreground">{t('projects.fileWatchingDesc') || 'Watch for file changes and update UI automatically.'}</div>
                    </div>
                    <input
                        type="checkbox"
                        checked={formData.fileWatchEnabled}
                        onChange={e => setFormData(prev => ({ ...prev, fileWatchEnabled: e.target.checked }))}
                        className="rounded border-border/50 bg-muted/20 text-primary focus:ring-primary h-5 w-5"
                    />
                </div>
            </div>

            <div className="p-4 bg-muted/20 border border-border/50 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-sm font-medium text-foreground">{t('projects.indexing') || 'Code Indexing'}</div>
                        <div className="text-xs text-muted-foreground">{t('projects.indexingDesc') || 'Maintain a vector index of your codebase for AI features.'}</div>
                    </div>
                    <input
                        type="checkbox"
                        checked={formData.indexingEnabled}
                        onChange={e => setFormData(prev => ({ ...prev, indexingEnabled: e.target.checked }))}
                        className="rounded border-border/50 bg-muted/20 text-primary focus:ring-primary h-5 w-5"
                    />
                </div>
            </div>

            <div className="p-4 bg-muted/20 border border-border/50 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-sm font-medium text-foreground">{t('projects.autoSave') || 'Auto-Save'}</div>
                        <div className="text-xs text-muted-foreground">{t('projects.autoSaveDesc') || 'Automatically save changes to files.'}</div>
                    </div>
                    <input
                        type="checkbox"
                        checked={formData.autoSave}
                        onChange={e => setFormData(prev => ({ ...prev, autoSave: e.target.checked }))}
                        className="rounded border-border/50 bg-muted/20 text-primary focus:ring-primary h-5 w-5"
                    />
                </div>
            </div>
        </div>
    </div>
);

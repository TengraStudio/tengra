import React from 'react';

import { SettingsSectionProps } from './types';

export const AdvancedSection: React.FC<SettingsSectionProps> = ({ formData, setFormData, t }) => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">{t('workspaces.advanced')}</h3>
            <p className="text-sm text-muted-foreground">{t('workspaces.advancedDesc')}</p>
        </div>

        <div className="space-y-4">
            <div className="p-4 bg-muted/20 border border-border/50 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-sm font-medium text-foreground">{t('workspaces.fileWatching')}</div>
                        <div className="text-xs text-muted-foreground">{t('workspaces.fileWatchingDesc')}</div>
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
                        <div className="text-sm font-medium text-foreground">{t('workspaces.indexing')}</div>
                        <div className="text-xs text-muted-foreground">{t('workspaces.indexingDesc')}</div>
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
                        <div className="text-sm font-medium text-foreground">{t('workspaces.autoSave')}</div>
                        <div className="text-xs text-muted-foreground">{t('workspaces.autoSaveDesc')}</div>
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

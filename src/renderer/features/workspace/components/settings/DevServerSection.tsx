import { Play } from 'lucide-react';
import React from 'react';

import { SettingsSectionProps } from './types';

export const DevServerSection: React.FC<SettingsSectionProps> = ({ formData, setFormData, t }) => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">{t('workspaces.devServer')}</h3>
            <p className="text-sm text-muted-foreground">{t('workspaces.devServerDesc')}</p>
        </div>

        <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase">{t('workspaces.startCommand')}</label>
                <div className="relative">
                    <Play className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={formData.devCommand}
                        onChange={e => setFormData(prev => ({ ...prev, devCommand: e.target.value }))}
                        className="w-full bg-muted/30 border border-border/50 rounded-lg py-2 pl-9 pr-4 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors font-mono"
                        placeholder={t('placeholder.devCommand')}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase">{t('workspaces.port')}</label>
                    <input
                        type="number"
                        value={formData.devPort}
                        onChange={e => setFormData(prev => ({ ...prev, devPort: parseInt(e.target.value) || 3000 }))}
                        className="w-full bg-muted/30 border border-border/50 rounded-lg py-2 px-4 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors font-mono"
                        placeholder={t('placeholder.portNumber')}
                    />
                </div>
                <div className="space-y-2 flex items-center pt-8">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.devAutoStart}
                            onChange={e => setFormData(prev => ({ ...prev, devAutoStart: e.target.checked }))}
                            className="rounded border-border/50 bg-muted/20 text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-foreground">{t('workspaces.autoStart')}</span>
                    </label>
                </div>
            </div>
        </div>
    </div>
);

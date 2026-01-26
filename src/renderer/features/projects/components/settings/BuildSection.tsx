import { Code, Search,Shield } from 'lucide-react';
import React from 'react';

import { SettingsSectionProps } from './types';

export const BuildSection: React.FC<SettingsSectionProps> = ({ formData, setFormData, t }) => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">{t('projects.buildAndTest') || 'Build & Test'}</h3>
            <p className="text-sm text-muted-foreground">{t('projects.buildDesc') || 'Configure how your project is built and tested.'}</p>
        </div>

        <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase">{t('projects.buildCommand') || 'Build Command'}</label>
                <div className="relative">
                    <Code className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={formData.buildCommand}
                        onChange={e => setFormData(prev => ({ ...prev, buildCommand: e.target.value }))}
                        className="w-full bg-muted/30 border border-border/50 rounded-lg py-2 pl-9 pr-4 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors font-mono"
                        placeholder="npm run build"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase">{t('projects.testCommand') || 'Test Command'}</label>
                <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={formData.testCommand}
                        onChange={e => setFormData(prev => ({ ...prev, testCommand: e.target.value }))}
                        className="w-full bg-muted/30 border border-border/50 rounded-lg py-2 pl-9 pr-4 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors font-mono"
                        placeholder="npm run test"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase">{t('projects.lintCommand') || 'Lint Command'}</label>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={formData.lintCommand}
                        onChange={e => setFormData(prev => ({ ...prev, lintCommand: e.target.value }))}
                        className="w-full bg-muted/30 border border-border/50 rounded-lg py-2 pl-9 pr-4 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors font-mono"
                        placeholder="npm run lint"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase">{t('projects.outputDir') || 'Output Directory'}</label>
                    <input
                        type="text"
                        value={formData.outputDir}
                        onChange={e => setFormData(prev => ({ ...prev, outputDir: e.target.value }))}
                        className="w-full bg-muted/30 border border-border/50 rounded-lg py-2 px-4 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors font-mono"
                        placeholder="dist"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase">{t('projects.envFile') || 'Env File'}</label>
                    <input
                        type="text"
                        value={formData.envFile}
                        onChange={e => setFormData(prev => ({ ...prev, envFile: e.target.value }))}
                        className="w-full bg-muted/30 border border-border/50 rounded-lg py-2 px-4 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors font-mono"
                        placeholder=".env.local"
                    />
                </div>
            </div>
        </div>
    </div>
);

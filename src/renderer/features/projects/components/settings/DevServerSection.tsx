import React from 'react'
import { Play } from 'lucide-react'
import { SettingsSectionProps } from './types'

export const DevServerSection: React.FC<SettingsSectionProps> = ({ formData, setFormData, t }) => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
            <h3 className="text-lg font-semibold text-white mb-1">{t('projects.devServer') || 'Development Server'}</h3>
            <p className="text-sm text-muted-foreground">{t('projects.devServerDesc') || 'Configure your local development environment.'}</p>
        </div>

        <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase">{t('projects.startCommand') || 'Start Command'}</label>
                <div className="relative">
                    <Play className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={formData.devCommand}
                        onChange={e => setFormData(prev => ({ ...prev, devCommand: e.target.value }))}
                        className="w-full bg-black/40 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors font-mono"
                        placeholder="npm run dev"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase">{t('projects.port') || 'Port'}</label>
                    <input
                        type="number"
                        value={formData.devPort}
                        onChange={e => setFormData(prev => ({ ...prev, devPort: parseInt(e.target.value) || 3000 }))}
                        className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors font-mono"
                        placeholder="3000"
                    />
                </div>
                <div className="space-y-2 flex items-center pt-8">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.devAutoStart}
                            onChange={e => setFormData(prev => ({ ...prev, devAutoStart: e.target.checked }))}
                            className="rounded border-white/10 bg-white/5 text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-white">{t('projects.autoStart') || 'Auto-start on load'}</span>
                    </label>
                </div>
            </div>
        </div>
    </div>
)

import { Language } from '@renderer/i18n';
import { Activity, Database, Download, Globe, RefreshCw } from 'lucide-react';
import React from 'react';

import { SelectDropdown } from '@/components/ui/SelectDropdown';
import { AppSettings } from '@/types/settings';

interface GeneralTabProps {
    settings: AppSettings | null
    updateGeneral: (patch: Partial<AppSettings['general']>) => void
    handleSave: (settings: AppSettings) => Promise<void>
    t: (key: string) => string
}

export const GeneralTab: React.FC<GeneralTabProps> = ({ settings, updateGeneral, handleSave, t }) => {
    const languageOptions = [
        { value: 'tr', label: t('languages.tr') },
        { value: 'en', label: t('languages.en') },
        { value: 'de', label: t('languages.de') },
        { value: 'fr', label: t('languages.fr') },
        { value: 'es', label: t('languages.es') },
        { value: 'ja', label: t('languages.ja') },
        { value: 'zh', label: t('languages.zh') },
        { value: 'ar', label: t('languages.ar') }
    ];

    const updateAutoUpdate = (patch: Partial<AppSettings['autoUpdate']>) => {
        if (!settings) { return; }
        const current = settings.autoUpdate ?? { enabled: true, checkOnStartup: true, downloadAutomatically: false, notifyOnly: false };
        void handleSave({ ...settings, autoUpdate: { ...current, ...patch } });
    };

    const autoUpdate = settings?.autoUpdate ?? { enabled: true, checkOnStartup: true, downloadAutomatically: false, notifyOnly: false };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-card p-4 rounded-xl border border-border">
                    <label className="text-xs font-bold uppercase text-muted-foreground mr-2 flex items-center gap-1">
                        <Globe className="w-3 h-3" /> {t('settings.language')}
                    </label>
                    <SelectDropdown
                        value={settings?.general.language ?? 'en'}
                        options={languageOptions}
                        onChange={(val) => updateGeneral({ language: val as Language })}
                        className="mt-2"
                    />
                </div>
                <div className="bg-card p-4 rounded-xl border border-border">
                    <label className="text-xs font-bold uppercase text-muted-foreground mr-2">
                        <Activity className="w-3 h-3 inline mr-1" /> {t('general.contextMessageLimit')}
                    </label>
                    <input
                        type="number"
                        value={settings?.general.contextMessageLimit ?? 50}
                        onChange={e => updateGeneral({ contextMessageLimit: parseInt(e.target.value) })}
                        className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 mt-2 font-mono text-primary"
                    />
                </div>
                <div className="bg-card p-4 rounded-xl border border-border flex items-center gap-3">
                    <Database className="w-8 h-8 text-primary/40" />
                    <div>
                        <div className="text-sm font-bold text-foreground uppercase tracking-wider">{t('general.database')}</div>
                        <div className="text-xs text-muted-foreground">{t('general.databaseDesc')}</div>
                    </div>
                </div>
                <div className="bg-card p-4 rounded-xl border border-border flex items-center justify-between">
                    <div>
                        <div className="text-sm font-bold text-foreground uppercase tracking-wider">{t('general.onboardingTour')}</div>
                        <div className="text-xs text-muted-foreground">{t('general.onboardingTourDesc')}</div>
                    </div>
                    <button
                        onClick={() => updateGeneral({ onboardingCompleted: false })}
                        className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold uppercase rounded-lg border border-primary/20 transition-all"
                    >
                        {t('general.startTour')}
                    </button>
                </div>

                {/* Updates Section */}
                <div className="bg-card p-4 rounded-xl border border-border col-span-1 md:col-span-2 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Download className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-bold uppercase text-muted-foreground">Updates</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center justify-between p-3 bg-muted/10 rounded-lg">
                            <span className="text-sm font-medium">Auto-Update</span>
                            <div
                                onClick={() => updateAutoUpdate({ enabled: !autoUpdate.enabled })}
                                className={`w-10 h-5 rounded-full p-0.5 cursor-pointer transition-colors ${autoUpdate.enabled ? 'bg-primary' : 'bg-gray-600'}`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${autoUpdate.enabled ? 'translate-x-5' : ''}`} />
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-muted/10 rounded-lg">
                            <span className="text-sm font-medium">Check on Startup</span>
                            <div
                                onClick={() => updateAutoUpdate({ checkOnStartup: !autoUpdate.checkOnStartup })}
                                className={`w-10 h-5 rounded-full p-0.5 cursor-pointer transition-colors ${autoUpdate.checkOnStartup ? 'bg-primary' : 'bg-gray-600'}`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${autoUpdate.checkOnStartup ? 'translate-x-5' : ''}`} />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            onClick={() => { void window.electron.update.checkForUpdates(); }}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-foreground text-xs font-bold uppercase rounded-lg transition-all"
                        >
                            <RefreshCw className="w-3 h-3" />
                            Check for Updates
                        </button>
                    </div>
                </div>

                {/* Privacy Section */}
                <div className="bg-card p-4 rounded-xl border border-border col-span-1 md:col-span-2 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-bold uppercase text-muted-foreground">Privacy</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center justify-between p-3 bg-muted/10 rounded-lg">
                            <div>
                                <span className="text-sm font-medium">Crash Reporting</span>
                                <p className="text-xs text-muted-foreground mt-1">Send anonymous crash reports to help us improve Orbit.</p>
                            </div>
                            <div
                                onClick={() => {
                                    if (!settings) { return; }
                                    const current = settings.crashReporting ?? { enabled: false };
                                    void handleSave({ ...settings, crashReporting: { enabled: !current.enabled } });
                                }}
                                className={`w-10 h-5 rounded-full p-0.5 cursor-pointer transition-colors ${settings?.crashReporting?.enabled ? 'bg-primary' : 'bg-gray-600'}`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings?.crashReporting?.enabled ? 'translate-x-5' : ''}`} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

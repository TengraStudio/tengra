import { Language } from '@renderer/i18n';
import { Activity, Database, Download, Globe, RefreshCw } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { SelectDropdown } from '@/components/ui/SelectDropdown';
import { AppSettings } from '@/types/settings';

interface GeneralTabProps {
    settings: AppSettings | null;
    updateGeneral: (patch: Partial<AppSettings['general']>) => void;
    handleSave: (settings: AppSettings) => Promise<void>;
    t: (key: string) => string;
}

type TerminalBackendOption = {
    id: string;
    name: string;
    available: boolean;
};

const ToggleSwitch: React.FC<{
    enabled: boolean;
    onToggle: () => void;
    title?: string;
    description?: string;
}> = ({ enabled, onToggle, title, description }) => (
    <div className="flex items-center justify-between p-5 rounded-2xl border border-border/40 bg-muted/5 hover:bg-muted/10 transition-colors group">
        {(title || description) && (
            <div>
                {title && (
                    <div className="text-sm font-black text-foreground uppercase tracking-tight">
                        {title}
                    </div>
                )}
                {description && (
                    <div className="text-xs font-medium text-muted-foreground/70">
                        {description}
                    </div>
                )}
            </div>
        )}
        <label className="relative inline-flex items-center cursor-pointer scale-110 ml-auto">
            <input type="checkbox" checked={enabled} onChange={onToggle} className="sr-only peer" />
            <div className="w-12 h-6.5 bg-muted/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:shadow-lg after:transition-all peer-checked:bg-primary border border-border/20"></div>
        </label>
    </div>
);

export const GeneralTab: React.FC<GeneralTabProps> = ({
    settings,
    updateGeneral,
    handleSave,
    t,
}) => {
    const [isLoadingTerminalBackends, setIsLoadingTerminalBackends] = useState(false);
    const [terminalBackends, setTerminalBackends] = useState<TerminalBackendOption[]>([]);

    const languageOptions = [
        { value: 'tr', label: t('languages.tr') },
        { value: 'en', label: t('languages.en') },
        { value: 'de', label: t('languages.de') },
        { value: 'fr', label: t('languages.fr') },
        { value: 'es', label: t('languages.es') },
        { value: 'ja', label: t('languages.ja') },
        { value: 'zh', label: t('languages.zh') },
        { value: 'ar', label: t('languages.ar') },
    ];

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                setIsLoadingTerminalBackends(true);
                const backends = await window.electron.terminal.getBackends();
                if (!cancelled && Array.isArray(backends)) {
                    setTerminalBackends(backends);
                }
            } catch {
                if (!cancelled) {
                    setTerminalBackends([]);
                }
            } finally {
                if (!cancelled) {
                    setIsLoadingTerminalBackends(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    const terminalBackendOptions = useMemo(() => {
        const options =
            terminalBackends.length > 0
                ? terminalBackends
                : [
                      { id: 'node-pty', name: 'Integrated Terminal', available: true },
                      { id: 'windows-terminal', name: 'Windows Terminal', available: true },
                      { id: 'kitty', name: 'Kitty', available: true },
                      { id: 'ghostty', name: 'Ghostty', available: true },
                      { id: 'alacritty', name: 'Alacritty', available: true },
                      { id: 'warp', name: 'Warp', available: true },
                  ];

        return options.map(backend => ({
            value: backend.id,
            label: backend.available ? backend.name : `${backend.name} (Unavailable)`,
        }));
    }, [terminalBackends]);

    const updateAutoUpdate = (patch: Partial<AppSettings['autoUpdate']>) => {
        if (!settings) {
            return;
        }
        const current = settings.autoUpdate ?? {
            enabled: true,
            checkOnStartup: true,
            downloadAutomatically: false,
            notifyOnly: false,
        };
        void handleSave({ ...settings, autoUpdate: { ...current, ...patch } });
    };

    const autoUpdate = settings?.autoUpdate ?? {
        enabled: true,
        checkOnStartup: true,
        downloadAutomatically: false,
        notifyOnly: false,
    };

    return (
        <div className="space-y-6">
            {/* Project Basics Card */}
            <div className="premium-glass p-8 space-y-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-lg shadow-primary/10">
                        <Globe className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-base font-black text-foreground uppercase tracking-tight">
                            {t('general.projectBasics')}
                        </div>
                        <div className="text-xs font-medium text-muted-foreground/70">
                            {t('general.projectBasicsDesc')}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 px-1">
                            {t('settings.language')}
                        </label>
                        <SelectDropdown
                            value={settings?.general.language ?? 'en'}
                            options={languageOptions}
                            onChange={val => updateGeneral({ language: val as Language })}
                            className="w-full"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 px-1">
                            {t('general.contextMessageLimit')}
                        </label>
                        <input
                            type="number"
                            value={settings?.general.contextMessageLimit ?? 50}
                            onChange={e =>
                                updateGeneral({ contextMessageLimit: parseInt(e.target.value) })
                            }
                            className="w-full bg-muted/5 border border-border/40 rounded-xl px-4 py-3 text-sm font-mono text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 px-1">
                            {t('projectDashboard.terminal')} Backend
                        </label>
                        <SelectDropdown
                            value={settings?.general.defaultTerminalBackend ?? 'node-pty'}
                            options={terminalBackendOptions}
                            onChange={value => updateGeneral({ defaultTerminalBackend: value })}
                            className="w-full"
                        />
                        <div className="text-[11px] text-muted-foreground/70 px-1">
                            {isLoadingTerminalBackends
                                ? t('common.loading')
                                : 'Select the default backend used when creating new terminal sessions.'}
                        </div>
                    </div>
                </div>
            </div>

            {/* App Intelligence Card */}
            <div className="premium-glass p-8 space-y-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-success/10 text-success border border-success/20 shadow-lg shadow-success/10">
                        <Database className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-base font-black text-foreground uppercase tracking-tight">
                            {t('general.appIntelligence')}
                        </div>
                        <div className="text-xs font-medium text-muted-foreground/70">
                            {t('general.appIntelligenceDesc')}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-4 p-5 rounded-2xl border border-border/40 bg-muted/5 group">
                        <Database className="w-10 h-10 text-primary/30 group-hover:text-primary/50 transition-colors" />
                        <div>
                            <div className="text-sm font-black text-foreground uppercase tracking-tight">
                                {t('general.database')}
                            </div>
                            <div className="text-xs font-medium text-muted-foreground/70">
                                {t('general.databaseDesc')}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between p-5 rounded-2xl border border-border/40 bg-muted/5 group transition-all hover:bg-muted/10">
                        <div>
                            <div className="text-sm font-black text-foreground uppercase tracking-tight">
                                {t('general.onboardingTour')}
                            </div>
                            <div className="text-xs font-medium text-muted-foreground/70">
                                {t('general.onboardingTourDesc')}
                            </div>
                        </div>
                        <button
                            onClick={() => updateGeneral({ onboardingCompleted: false })}
                            className="px-5 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black uppercase rounded-xl border border-primary/20 transition-all shadow-sm"
                        >
                            {t('general.startTour')}
                        </button>
                    </div>
                </div>
            </div>

            {/* App Lifecycle & Updates */}
            <div className="premium-glass p-8 space-y-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-info/10 text-info border border-info/20 shadow-lg shadow-blue-500/10">
                        <Download className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-base font-black text-foreground uppercase tracking-tight">
                            {t('general.lifecycle')}
                        </div>
                        <div className="text-xs font-medium text-muted-foreground/70">
                            {t('general.lifecycleDesc')}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ToggleSwitch
                        enabled={autoUpdate.enabled}
                        onToggle={() => updateAutoUpdate({ enabled: !autoUpdate.enabled })}
                        title={t('general.autoUpdate')}
                        description={t('general.autoUpdateDesc')}
                    />
                    <ToggleSwitch
                        enabled={autoUpdate.checkOnStartup}
                        onToggle={() =>
                            updateAutoUpdate({ checkOnStartup: !autoUpdate.checkOnStartup })
                        }
                        title={t('general.checkOnStartup')}
                        description={t('general.checkOnStartupDesc')}
                    />
                    <ToggleSwitch
                        enabled={settings?.window?.startOnStartup ?? false}
                        onToggle={() => {
                            if (!settings) {
                                return;
                            }
                            const currentWindow = settings.window ?? {
                                width: 1280,
                                height: 800,
                                x: 0,
                                y: 0,
                            };
                            void handleSave({
                                ...settings,
                                window: {
                                    ...currentWindow,
                                    startOnStartup: !currentWindow.startOnStartup,
                                },
                            });
                        }}
                        title={t('general.startOnStartup')}
                        description={t('general.startOnStartupDesc')}
                    />
                    <ToggleSwitch
                        enabled={settings?.window?.workAtBackground ?? false}
                        onToggle={() => {
                            if (!settings) {
                                return;
                            }
                            const currentWindow = settings.window ?? {
                                width: 1280,
                                height: 800,
                                x: 0,
                                y: 0,
                            };
                            void handleSave({
                                ...settings,
                                window: {
                                    ...currentWindow,
                                    workAtBackground: !currentWindow.workAtBackground,
                                },
                            });
                        }}
                        title={t('general.workAtBackground')}
                        description={t('general.workAtBackgroundDesc')}
                    />
                </div>

                <div className="flex justify-end pt-4 border-t border-border/20">
                    <button
                        onClick={() => {
                            void window.electron.update.checkForUpdates();
                        }}
                        className="flex items-center gap-2.5 px-6 py-3 bg-primary text-primary-foreground text-xs font-black uppercase rounded-xl transition-all shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95"
                    >
                        <RefreshCw className="w-4 h-4" />
                        {t('general.checkForUpdates')}
                    </button>
                </div>
            </div>

            {/* Privacy & Safety */}
            <div className="premium-glass p-8 space-y-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 shadow-lg shadow-rose-500/10">
                        <Activity className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-base font-black text-foreground uppercase tracking-tight">
                            {t('general.privacySafety')}
                        </div>
                        <div className="text-xs font-medium text-muted-foreground/70">
                            {t('general.privacySafetyDesc')}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ToggleSwitch
                        enabled={settings?.crashReporting?.enabled ?? false}
                        onToggle={() => {
                            if (!settings) {
                                return;
                            }
                            const current = settings.crashReporting ?? { enabled: false };
                            void handleSave({
                                ...settings,
                                crashReporting: { enabled: !current.enabled },
                            });
                        }}
                        title={t('general.crashReporting')}
                        description={t('general.crashReportingDesc')}
                    />
                </div>
            </div>
        </div>
    );
};

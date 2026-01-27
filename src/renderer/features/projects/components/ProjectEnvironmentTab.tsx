import { Eye, EyeOff, Plus, Save, Settings, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface EnvVar {
    key: string
    value: string
    visible: boolean
}

interface ProjectEnvironmentTabProps {
    projectPath: string
    language: Language
}

export const ProjectEnvironmentTab: React.FC<ProjectEnvironmentTabProps> = ({ projectPath, language }) => {
    const { t } = useTranslation(language);
    const [envVars, setEnvVars] = useState<EnvVar[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const loadEnvVars = useCallback(async () => {
        setLoading(true);
        try {
            const result = await window.electron.ipcRenderer.invoke('project:getEnv', projectPath);
            if (result?.success && result.data) {
                const vars = Object.entries(result.data as Record<string, string>).map(([key, value]) => ({
                    key,
                    value,
                    visible: false
                }));
                setEnvVars(vars);
            }
        } catch (error) {
            console.error('Failed to load env vars:', error);
        } finally {
            setLoading(false);
        }
    }, [projectPath]);

    useEffect(() => {
        void loadEnvVars();
    }, [loadEnvVars]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const varsObj: Record<string, string> = {};
            for (const v of envVars) {
                if (v.key.trim()) {
                    varsObj[v.key.trim()] = v.value;
                }
            }
            await window.electron.ipcRenderer.invoke('project:saveEnv', projectPath, varsObj);
            setHasChanges(false);
        } catch (error) {
            console.error('Failed to save env vars:', error);
        } finally {
            setSaving(false);
        }
    };

    const updateVar = (index: number, field: 'key' | 'value', newValue: string) => {
        setEnvVars(prev => prev.map((v, i) => i === index ? { ...v, [field]: newValue } : v));
        setHasChanges(true);
    };

    const toggleVisibility = (index: number) => {
        setEnvVars(prev => prev.map((v, i) => i === index ? { ...v, visible: !v.visible } : v));
    };

    const addVar = () => {
        setEnvVars(prev => [...prev, { key: '', value: '', visible: true }]);
        setHasChanges(true);
    };

    const removeVar = (index: number) => {
        setEnvVars(prev => prev.filter((_, i) => i !== index));
        setHasChanges(true);
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <Settings className="w-6 h-6 animate-spin mr-2" />
                {t('common.loading')}
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col gap-6 p-4 overflow-y-auto min-h-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-2">
                    <h2 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
                        <Settings className="w-8 h-8 text-primary" />
                        {t('projectDashboard.environment')}
                    </h2>
                    <p className="text-muted-foreground text-sm max-w-xl">
                        {t('projectDashboard.envDescription')}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={addVar}
                        className="flex items-center gap-2 px-4 py-2 bg-muted/20 hover:bg-muted/30 border border-border/50 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        {t('projectDashboard.envAddVar')}
                    </button>
                    <button
                        onClick={() => void handleSave()}
                        disabled={!hasChanges || saving}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                            hasChanges ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted/20 text-muted-foreground cursor-not-allowed"
                        )}
                    >
                        <Save className="w-4 h-4" />
                        {saving ? t('common.loading') : t('projectDashboard.envSave')}
                    </button>
                </div>
            </div>

            {/* Variables Table */}
            <div className="flex-1 min-h-0 bg-card/40 backdrop-blur-sm rounded-3xl border border-border/50 overflow-hidden flex flex-col shadow-2xl">
                <div className="p-6 border-b border-border/50 bg-muted/20">
                    <div className="grid grid-cols-12 gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        <div className="col-span-4">{t('projectDashboard.envKey')}</div>
                        <div className="col-span-6">{t('projectDashboard.envValue')}</div>
                        <div className="col-span-2 text-right">{t('projectDashboard.envActions')}</div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin scrollbar-thumb-muted-foreground/20">
                    {envVars.length > 0 ? (
                        envVars.map((envVar, idx) => (
                            <div
                                key={idx}
                                className="grid grid-cols-12 gap-4 p-4 rounded-2xl bg-muted/10 hover:bg-muted/20 border border-border/50 transition-all group"
                            >
                                <div className="col-span-4">
                                    <input
                                        type="text"
                                        value={envVar.key}
                                        onChange={(e) => updateVar(idx, 'key', e.target.value)}
                                        className="w-full bg-transparent border-b border-border/50 focus:border-primary/50 outline-none text-sm font-mono text-foreground py-1"
                                        placeholder={t('projectDashboard.envNamePlaceholder')}
                                    />
                                </div>
                                <div className="col-span-6 flex items-center gap-2">
                                    <input
                                        type={envVar.visible ? 'text' : 'password'}
                                        value={envVar.value}
                                        onChange={(e) => updateVar(idx, 'value', e.target.value)}
                                        className="flex-1 bg-transparent border-b border-white/10 focus:border-primary/50 outline-none text-sm font-mono text-foreground py-1"
                                        placeholder="value"
                                    />
                                    <button
                                        onClick={() => toggleVisibility(idx)}
                                        className="p-1.5 hover:bg-muted/30 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                                        title={envVar.visible ? t('projectDashboard.envHideValue') : t('projectDashboard.envShowValue')}
                                    >
                                        {envVar.visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <div className="col-span-2 flex items-center justify-end">
                                    <button
                                        onClick={() => removeVar(idx)}
                                        className="p-1.5 hover:bg-destructive/10 rounded-md text-muted-foreground hover:text-destructive transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full py-20 text-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                                <Settings className="w-8 h-8 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-foreground">{t('projectDashboard.envNoVars')}</h3>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

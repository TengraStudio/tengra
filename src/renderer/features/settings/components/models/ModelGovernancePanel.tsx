import { Button } from '@renderer/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@renderer/components/ui/select';
import { Switch } from '@renderer/components/ui/switch';
import { cn } from '@renderer/lib/utils';
import { Shield, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { AppSettings, ModelGovernanceSettings } from '@/types/settings';

const DEFAULT_GOVERNANCE: ModelGovernanceSettings = {
    mode: 'blocklist',
    allowedModels: [],
    blockedModels: [],
};

interface ModelGovernancePanelProps {
    settings: AppSettings;
    allModelIds: string[];
    setSettings: (s: AppSettings) => void;
    handleSave: (s?: AppSettings) => void;
    t: (key: string) => string;
}

/**
 * Panel for managing model governance policies (allowlist/blocklist).
 */
export const ModelGovernancePanel: React.FC<ModelGovernancePanelProps> = ({
    settings,
    allModelIds,
    setSettings,
    handleSave,
    t,
}) => {
    const [selectedModel, setSelectedModel] = useState('');

    const governance: ModelGovernanceSettings = useMemo(
        () => settings.modelGovernance ?? DEFAULT_GOVERNANCE,
        [settings.modelGovernance]
    );

    const isAllowlistMode = governance.mode === 'allowlist';

    const updateGovernance = (patch: Partial<ModelGovernanceSettings>) => {
        const next: ModelGovernanceSettings = { ...governance, ...patch };
        const updated: AppSettings = { ...settings, modelGovernance: next };
        setSettings(updated);
        handleSave(updated);
    };

    const toggleMode = () => {
        updateGovernance({ mode: isAllowlistMode ? 'blocklist' : 'allowlist' });
    };

    const addToAllowlist = () => {
        if (!selectedModel || governance.allowedModels.includes(selectedModel)) {
            return;
        }
        updateGovernance({
            allowedModels: [...governance.allowedModels, selectedModel],
            blockedModels: governance.blockedModels.filter(m => m !== selectedModel),
        });
        setSelectedModel('');
    };

    const addToBlocklist = () => {
        if (!selectedModel || governance.blockedModels.includes(selectedModel)) {
            return;
        }
        updateGovernance({
            blockedModels: [...governance.blockedModels, selectedModel],
            allowedModels: governance.allowedModels.filter(m => m !== selectedModel),
        });
        setSelectedModel('');
    };

    const removeFromAllowlist = (modelId: string) => {
        updateGovernance({
            allowedModels: governance.allowedModels.filter(m => m !== modelId),
        });
    };

    const removeFromBlocklist = (modelId: string) => {
        updateGovernance({
            blockedModels: governance.blockedModels.filter(m => m !== modelId),
        });
    };

    const availableForSelect = useMemo(() => {
        const inList = new Set([...governance.allowedModels, ...governance.blockedModels]);
        return allModelIds.filter(id => !inList.has(id));
    }, [allModelIds, governance.allowedModels, governance.blockedModels]);

    return (
        <div className="overflow-hidden rounded-3xl border border-border/30 bg-card p-6 transition-colors hover:border-border/50 sm:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                        <Shield className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">
                            {t('workspaces.modelGovernance')}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground/70">
                            {t('workspaces.modelGovernanceDesc')}
                        </p>
                    </div>
                </div>

                <div className={cn(
                    'flex items-center justify-between gap-6 rounded-2xl border px-5 py-4 md:min-w-[260px]',
                    isAllowlistMode
                        ? 'border-success/20 bg-success/5'
                        : 'border-destructive/20 bg-destructive/5'
                )}>
                    <div className="flex items-center gap-4">
                        <div
                            className={`rounded-xl border p-2 ${isAllowlistMode
                                ? 'bg-success/10 border-success/30 text-success'
                                : 'bg-destructive/10 border-destructive/30 text-destructive'
                                }`}
                        >
                            {isAllowlistMode ? (
                                <ShieldCheck className="w-4 h-4" />
                            ) : (
                                <ShieldAlert className="w-4 h-4" />
                            )}
                        </div>
                        <div>
                            <div className="typo-body font-medium text-foreground">
                                {t('workspaces.governanceMode')}
                            </div>
                            <div className="mt-0.5 typo-body text-muted-foreground/70">
                                {isAllowlistMode ? 'Allowlist' : 'Blocklist'}
                            </div>
                        </div>
                    </div>
                    <Switch checked={isAllowlistMode} onCheckedChange={toggleMode} />
                </div>
            </div>

            <div className="mt-8 animate-in fade-in slide-in-from-top-4 rounded-2xl border border-border/20 bg-muted/10 p-4 duration-500">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex-1 min-w-0">
                        <Select value={selectedModel} onValueChange={setSelectedModel}>
                            <SelectTrigger className="h-11 rounded-xl border-border/30 bg-background text-xs font-medium">
                                <SelectValue placeholder={t('workspaces.selectModelPlaceholder')} />
                            </SelectTrigger>
                            <SelectContent className="max-h-80 overflow-y-auto rounded-xl border-border/30 bg-popover">
                                {availableForSelect.map(id => (
                                    <SelectItem key={id} value={id} className="m-1 rounded-lg typo-body font-medium">
                                        {id}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={addToAllowlist}
                            disabled={!selectedModel}
                            className="h-11 rounded-xl border-success/20 bg-success/5 px-5 typo-body font-medium text-success hover:bg-success hover:text-success-foreground disabled:opacity-40"
                        >
                            <ShieldCheck className="w-3.5 h-3.5 mr-2" />
                            {t('workspaces.addToAllowlist')}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={addToBlocklist}
                            disabled={!selectedModel}
                            className="h-11 rounded-xl border-destructive/20 bg-destructive/5 px-5 typo-body font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-40"
                        >
                            <ShieldAlert className="w-3.5 h-3.5 mr-2" />
                            {t('workspaces.addToBlocklist')}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 pt-8 xl:grid-cols-2">
                <div className="space-y-4 group/list">
                    <div className="flex items-center gap-3 px-1">
                        <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                        <div className="typo-body font-medium text-success">
                            {t('workspaces.allowedModels')}
                        </div>
                    </div>
                    <div className="space-y-3 min-h-[120px] max-h-[400px] overflow-y-auto pr-3 custom-scrollbar">
                        {governance.allowedModels.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/20 bg-muted/5 py-10 text-center opacity-50 transition-colors group-hover/list:border-success/20">
                                <ShieldCheck className="w-6 h-6 mb-3 text-muted-foreground" />
                                <p className="px-6 typo-body font-medium text-muted-foreground">
                                    {t('workspaces.noAllowedModels')}
                                </p>
                            </div>
                        ) : (
                            governance.allowedModels.map(modelId => (
                                <div
                                    key={modelId}
                                    className="group/item flex items-center justify-between gap-4 rounded-2xl border border-success/10 bg-background px-4 py-3.5 transition-colors hover:border-success/25 hover:bg-success/5"
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="h-2 w-2 rounded-full bg-success/40 group-hover/item:bg-success" />
                                        <span className="truncate typo-body font-medium text-foreground">
                                            {modelId}
                                        </span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeFromAllowlist(modelId)}
                                        className="h-8 w-8 rounded-xl text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="space-y-4 group/list-block">
                    <div className="flex items-center gap-3 px-1">
                        <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                        <div className="typo-body font-medium text-destructive">
                            {t('workspaces.blockedModels')}
                        </div>
                    </div>
                    <div className="space-y-3 min-h-[120px] max-h-[400px] overflow-y-auto pr-3 custom-scrollbar">
                        {governance.blockedModels.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/20 bg-muted/5 py-10 text-center opacity-50 transition-colors group-hover/list-block:border-destructive/20">
                                <ShieldAlert className="w-6 h-6 mb-3 text-muted-foreground" />
                                <p className="px-6 typo-body font-medium text-muted-foreground">
                                    {t('workspaces.noBlockedModels')}
                                </p>
                            </div>
                        ) : (
                            governance.blockedModels.map(modelId => (
                                <div
                                    key={modelId}
                                    className="group/item flex items-center justify-between gap-4 rounded-2xl border border-destructive/10 bg-background px-4 py-3.5 transition-colors hover:border-destructive/25 hover:bg-destructive/5"
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="h-2 w-2 rounded-full bg-destructive/40 group-hover/item:bg-destructive" />
                                        <span className="truncate typo-body font-medium text-foreground">
                                            {modelId}
                                        </span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeFromBlocklist(modelId)}
                                        className="h-8 w-8 rounded-xl text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

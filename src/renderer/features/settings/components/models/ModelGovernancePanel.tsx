import React, { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
        if (!selectedModel || governance.allowedModels.includes(selectedModel)) { return; }
        updateGovernance({
            allowedModels: [...governance.allowedModels, selectedModel],
            blockedModels: governance.blockedModels.filter(m => m !== selectedModel),
        });
        setSelectedModel('');
    };

    const addToBlocklist = () => {
        if (!selectedModel || governance.blockedModels.includes(selectedModel)) { return; }
        updateGovernance({
            blockedModels: [...governance.blockedModels, selectedModel],
            allowedModels: governance.allowedModels.filter(m => m !== selectedModel),
        });
        setSelectedModel('');
    };

    const removeFromAllowlist = (modelId: string) => {
        updateGovernance({ allowedModels: governance.allowedModels.filter(m => m !== modelId) });
    };

    const removeFromBlocklist = (modelId: string) => {
        updateGovernance({ blockedModels: governance.blockedModels.filter(m => m !== modelId) });
    };

    const availableForSelect = useMemo(() => {
        const inList = new Set([...governance.allowedModels, ...governance.blockedModels]);
        return allModelIds.filter(id => !inList.has(id));
    }, [allModelIds, governance.allowedModels, governance.blockedModels]);

    return (
        <div className="bg-card rounded-xl border border-border p-5 space-y-5">
            <div>
                <h3 className="text-sm font-bold text-foreground">{t('workspaces.modelGovernance')}</h3>
                <p className="text-xs text-muted-foreground mt-1">{t('workspaces.modelGovernanceDesc')}</p>
            </div>

            {/* Mode toggle */}
            <div className="flex items-center justify-between gap-4 bg-muted/20 rounded-lg p-3 border border-border/50">
                <div>
                    <div className="text-xs font-bold text-foreground">{t('workspaces.governanceMode')}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                        {isAllowlistMode
                            ? t('workspaces.blockAllExceptAllowed')
                            : t('workspaces.allowAllExceptBlocked')}
                    </div>
                </div>
                <Switch checked={isAllowlistMode} onCheckedChange={toggleMode} />
            </div>

            {/* Model selector */}
            <div className="flex items-center gap-2">
                <select
                    value={selectedModel}
                    onChange={e => setSelectedModel(e.target.value)}
                    className="h-9 flex-1 bg-muted/20 border border-border/50 rounded-lg px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                    <option value="">{t('workspaces.selectModelPlaceholder')}</option>
                    {availableForSelect.map(id => (
                        <option key={id} value={id}>{id}</option>
                    ))}
                </select>
                <button
                    onClick={addToAllowlist}
                    disabled={!selectedModel}
                    className="px-3 py-2 rounded-lg text-xs font-bold bg-success/20 text-success border border-success/30 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-success/30 transition-colors"
                >
                    {t('workspaces.addToAllowlist')}
                </button>
                <button
                    onClick={addToBlocklist}
                    disabled={!selectedModel}
                    className="px-3 py-2 rounded-lg text-xs font-bold bg-destructive/20 text-destructive border border-destructive/30 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-destructive/30 transition-colors"
                >
                    {t('workspaces.addToBlocklist')}
                </button>
            </div>

            {/* Lists */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Allowed models */}
                <div className="space-y-2">
                    <div className="text-xs font-bold text-success uppercase tracking-wider">
                        {t('workspaces.allowedModels')}
                    </div>
                    {governance.allowedModels.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">{t('workspaces.noAllowedModels')}</p>
                    ) : (
                        <div className="space-y-1.5">
                            {governance.allowedModels.map(modelId => (
                                <div key={modelId} className="flex items-center justify-between gap-2 bg-success/5 border border-success/20 rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Badge variant="outline" className="border-success/40 text-success text-xxxs shrink-0">✓</Badge>
                                        <span className="text-xs text-foreground truncate">{modelId}</span>
                                    </div>
                                    <button
                                        onClick={() => removeFromAllowlist(modelId)}
                                        className="text-xs text-destructive hover:text-destructive/80 font-bold shrink-0"
                                    >
                                        {t('workspaces.removeFromList')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Blocked models */}
                <div className="space-y-2">
                    <div className="text-xs font-bold text-destructive uppercase tracking-wider">
                        {t('workspaces.blockedModels')}
                    </div>
                    {governance.blockedModels.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">{t('workspaces.noBlockedModels')}</p>
                    ) : (
                        <div className="space-y-1.5">
                            {governance.blockedModels.map(modelId => (
                                <div key={modelId} className="flex items-center justify-between gap-2 bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Badge variant="outline" className="border-destructive/40 text-destructive text-xxxs shrink-0">✕</Badge>
                                        <span className="text-xs text-foreground truncate">{modelId}</span>
                                    </div>
                                    <button
                                        onClick={() => removeFromBlocklist(modelId)}
                                        className="text-xs text-destructive hover:text-destructive/80 font-bold shrink-0"
                                    >
                                        {t('workspaces.removeFromList')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

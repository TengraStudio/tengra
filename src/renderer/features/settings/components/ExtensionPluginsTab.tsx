import { Badge } from '@renderer/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@renderer/components/ui/select';
import { Switch } from '@renderer/components/ui/switch';
import type { IpcValue } from '@shared/types/common';
import type { ConfigurationProperty, ExtensionManifest } from '@shared/types/extension';
import { Package, RefreshCw, Settings2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useExtensionStore } from '@/store/extension.store';
import { pushNotification } from '@/store/notification-center.store';
import { appLogger } from '@/utils/renderer-logger';

interface ExtensionPluginsTabProps {
    t: (key: string, options?: Record<string, string | number>) => string;
}

function getConfigProperties(manifest: ExtensionManifest | undefined): Record<string, ConfigurationProperty> {
    return manifest?.configuration?.properties ?? {};
}

function resolveFieldValue(
    draft: Record<string, IpcValue>,
    key: string,
    property: ConfigurationProperty
): IpcValue {
    if (Object.prototype.hasOwnProperty.call(draft, key)) {
        return draft[key];
    }
    return property.default;
}

export const ExtensionPluginsTab: React.FC<ExtensionPluginsTabProps> = ({ t }) => {
    const { extensions, isLoading, error, fetchExtensions, activateExtension, deactivateExtension } = useExtensionStore();
    const [selectedExtensionId, setSelectedExtensionId] = useState<string | null>(null);
    const [draftByExtensionId, setDraftByExtensionId] = useState<Record<string, Record<string, IpcValue>>>({});
    const [loadingConfigId, setLoadingConfigId] = useState<string | null>(null);
    const [savingConfig, setSavingConfig] = useState(false);

    const selectedExtension = useMemo(
        () => extensions.find(extension => extension.manifest.id === selectedExtensionId) ?? null,
        [extensions, selectedExtensionId]
    );

    const configProperties = useMemo(
        () => getConfigProperties(selectedExtension?.manifest),
        [selectedExtension?.manifest]
    );

    useEffect(() => {
        void fetchExtensions();
    }, [fetchExtensions]);

    useEffect(() => {
        if (extensions.length === 0) {
            setSelectedExtensionId(null);
            return;
        }
        if (!selectedExtensionId || !extensions.some(extension => extension.manifest.id === selectedExtensionId)) {
            setSelectedExtensionId(extensions[0]?.manifest.id ?? null);
        }
    }, [extensions, selectedExtensionId]);

    useEffect(() => {
        if (!selectedExtensionId || draftByExtensionId[selectedExtensionId]) {
            return;
        }
        let active = true;
        setLoadingConfigId(selectedExtensionId);
        void window.electron.extension.getConfig(selectedExtensionId)
            .then(result => {
                if (!active) {
                    return;
                }
                if (!result.success) {
                    throw new Error(result.error ?? 'Failed to load extension config');
                }
                setDraftByExtensionId(prev => ({
                    ...prev,
                    [selectedExtensionId]: result.config ?? {},
                }));
            })
            .catch(error => {
                appLogger.error('ExtensionPluginsTab', `Failed to load extension config for ${selectedExtensionId}`, error as Error);
                pushNotification({ type: 'error', message: t('settings.extensions.plugins.configLoadError') });
            })
            .finally(() => {
                if (active) {
                    setLoadingConfigId(current => (current === selectedExtensionId ? null : current));
                }
            });

        return () => {
            active = false;
        };
    }, [draftByExtensionId, selectedExtensionId, t]);

    const handleToggleExtension = useCallback(async (extensionId: string, status: string): Promise<void> => {
        if (status === 'active') {
            await deactivateExtension(extensionId);
            return;
        }
        await activateExtension(extensionId);
    }, [activateExtension, deactivateExtension]);

    const handleFieldChange = useCallback((key: string, value: IpcValue): void => {
        if (!selectedExtensionId) {
            return;
        }
        setDraftByExtensionId(prev => ({
            ...prev,
            [selectedExtensionId]: {
                ...(prev[selectedExtensionId] ?? {}),
                [key]: value,
            },
        }));
    }, [selectedExtensionId]);

    const handleSaveConfig = useCallback(async (): Promise<void> => {
        if (!selectedExtensionId) {
            return;
        }
        setSavingConfig(true);
        try {
            const patch = draftByExtensionId[selectedExtensionId] ?? {};
            const result = await window.electron.extension.updateConfig(
                selectedExtensionId,
                patch
            );
            if (!result.success) {
                throw new Error(result.error ?? 'Failed to save extension config');
            }
            setDraftByExtensionId(prev => ({
                ...prev,
                [selectedExtensionId]: result.config ?? patch,
            }));
            pushNotification({ type: 'success', message: t('settings.extensions.plugins.configSaved') });
        } catch (error) {
            appLogger.error('ExtensionPluginsTab', `Failed to save extension config for ${selectedExtensionId}`, error as Error);
            pushNotification({ type: 'error', message: t('settings.extensions.plugins.configSaveError') });
        } finally {
            setSavingConfig(false);
        }
    }, [draftByExtensionId, selectedExtensionId, t]);

    const selectedDraft = selectedExtensionId ? (draftByExtensionId[selectedExtensionId] ?? {}) : {};

    return (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
            <section className="rounded-xl border border-border/30 bg-card/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{t('settings.extensions.plugins.title')}</h3>
                    <Button variant="ghost" size="sm" onClick={() => void fetchExtensions()}>
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
                {error && (
                    <p className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 typo-caption text-destructive">
                        {error}
                    </p>
                )}
                {isLoading && extensions.length === 0 ? (
                    <p className="typo-caption text-muted-foreground">{t('common.loading')}</p>
                ) : extensions.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/40 px-3 py-6 text-center typo-caption text-muted-foreground">
                        {t('settings.extensions.plugins.empty')}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {extensions.map(extension => {
                            const isSelected = extension.manifest.id === selectedExtensionId;
                            return (
                                <button
                                    key={extension.manifest.id}
                                    type="button"
                                    onClick={() => setSelectedExtensionId(extension.manifest.id)}
                                    className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                                        isSelected
                                            ? 'border-primary/40 bg-primary/10'
                                            : 'border-border/30 bg-background/60 hover:border-border/60'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="truncate text-sm font-semibold">{extension.manifest.name}</p>
                                        <Badge variant="outline" className="typo-caption uppercase">
                                            {extension.status}
                                        </Badge>
                                    </div>
                                    <p className="mt-1 truncate typo-caption text-muted-foreground">{extension.manifest.id}</p>
                                </button>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className="rounded-xl border border-border/30 bg-card/60 p-4">
                {!selectedExtension ? (
                    <div className="flex min-h-[220px] items-center justify-center rounded-md border border-dashed border-border/30 text-sm text-muted-foreground">
                        {t('settings.extensions.plugins.select')}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                                <h3 className="text-lg font-semibold">{selectedExtension.manifest.name}</h3>
                                <p className="typo-caption text-muted-foreground">{selectedExtension.manifest.description}</p>
                                <p className="typo-caption text-muted-foreground">{selectedExtension.extensionPath}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Badge variant="outline">v{selectedExtension.manifest.version}</Badge>
                                <Switch
                                    checked={selectedExtension.status === 'active'}
                                    onCheckedChange={() => {
                                        void handleToggleExtension(selectedExtension.manifest.id, selectedExtension.status);
                                    }}
                                />
                            </div>
                        </div>

                        <div className="rounded-lg border border-border/30 bg-background/40 p-3">
                            <div className="mb-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Settings2 className="h-4 w-4 text-primary" />
                                    <h4 className="text-sm font-semibold">{t('settings.extensions.plugins.configTitle')}</h4>
                                </div>
                                <Button
                                    size="sm"
                                    onClick={() => void handleSaveConfig()}
                                    disabled={savingConfig || loadingConfigId === selectedExtension.manifest.id || Object.keys(configProperties).length === 0}
                                >
                                    {savingConfig ? t('common.saving') : t('common.save')}
                                </Button>
                            </div>

                            {loadingConfigId === selectedExtension.manifest.id ? (
                                <p className="typo-caption text-muted-foreground">{t('common.loading')}</p>
                            ) : Object.keys(configProperties).length === 0 ? (
                                <p className="typo-caption text-muted-foreground">{t('settings.extensions.plugins.noConfig')}</p>
                            ) : (
                                <div className="space-y-3">
                                    {Object.entries(configProperties).map(([key, property]) => {
                                        const fieldValue = resolveFieldValue(selectedDraft, key, property);
                                        const fieldLabel = property.title.trim().length > 0 ? property.title : key;
                                        return (
                                            <div key={key} className="grid gap-2 rounded-md border border-border/20 bg-background/50 p-3">
                                                <Label className="typo-caption text-muted-foreground">{fieldLabel}</Label>
                                                <p className="typo-caption text-muted-foreground/80">{property.description}</p>
                                                {property.type === 'boolean' ? (
                                                    <Switch
                                                        checked={Boolean(fieldValue)}
                                                        onCheckedChange={checked => handleFieldChange(key, checked)}
                                                    />
                                                ) : property.type === 'number' ? (
                                                    <Input
                                                        type="number"
                                                        value={typeof fieldValue === 'number' ? String(fieldValue) : ''}
                                                        onChange={event => {
                                                            const parsed = Number(event.target.value);
                                                            if (Number.isFinite(parsed)) {
                                                                handleFieldChange(key, parsed);
                                                            }
                                                        }}
                                                    />
                                                ) : property.enum && property.enum.length > 0 ? (
                                                    <Select
                                                        value={typeof fieldValue === 'string' ? fieldValue : ''}
                                                        onValueChange={value => handleFieldChange(key, value)}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={key} />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {property.enum.map(option => (
                                                                <SelectItem key={option} value={option}>{option}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                ) : property.type === 'string' ? (
                                                    <Input
                                                        value={typeof fieldValue === 'string' ? fieldValue : ''}
                                                        onChange={event => handleFieldChange(key, event.target.value)}
                                                    />
                                                ) : (
                                                    <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 typo-caption text-warning">
                                                        <Package className="h-3.5 w-3.5" />
                                                        {t('settings.extensions.plugins.complexConfigHint')}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
};


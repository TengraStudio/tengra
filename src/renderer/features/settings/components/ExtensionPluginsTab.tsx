/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { IpcValue } from '@shared/types/common';
import type { ConfigurationProperty, ExtensionManifest } from '@shared/types/extension';
import { MarketplaceExtension } from '@shared/types/marketplace';
import { IconAlertTriangle,IconInfoCircle, IconPackage, IconRefresh, IconSettings2, IconTrash } from '@tabler/icons-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useExtensionStore } from '@/store/extension.store';
import { marketplaceStore, useMarketplaceStore } from '@/store/marketplace.store';
import { pushNotification } from '@/store/notification-center.store';
import { appLogger } from '@/utils/renderer-logger';

/* Batch-02: Extracted Long Classes */
const C_EXTENSIONPLUGINSTAB_1 = "m-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-in fade-in duration-300";
const C_EXTENSIONPLUGINSTAB_2 = "absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-success border-2 border-background shadow-glow-success-strong";
const C_EXTENSIONPLUGINSTAB_3 = "bg-muted px-4 py-1.5 rounded-xl border border-border/20 flex items-center gap-4 shadow-sm ring-1 ring-inset ring-border/20 sm:gap-5 lg:gap-6";
const C_EXTENSIONPLUGINSTAB_4 = "h-9 w-9 rounded-xl border-destructive/20 text-destructive/60 hover:text-destructive hover:bg-destructive/10 hover:border-destructive/40 transition-all active:scale-90 shadow-sm";
const C_EXTENSIONPLUGINSTAB_5 = "flex items-center justify-between gap-4 sticky top-0 z-10 bg-card/60 backdrop-blur-md pb-4 pt-1 border-b border-border/5 mb-2 sm:gap-5 lg:gap-6";
const C_EXTENSIONPLUGINSTAB_6 = "py-12 px-6 rounded-2xl border border-dashed border-border/40 bg-muted/5 flex flex-col items-center justify-center text-center space-y-3 sm:flex-row";
const C_EXTENSIONPLUGINSTAB_7 = "group relative grid gap-2 rounded-2xl border border-border/20 bg-muted/5 p-4 transition-all duration-200 hover:bg-muted/10 hover:border-border/40 sm:p-5 lg:p-6";
const C_EXTENSIONPLUGINSTAB_8 = "h-10 rounded-xl border-border/30 bg-background/50 px-4 font-bold shadow-inner focus:ring-primary/20 transition-all font-mono";


const ICON_WRAPPER_BASE = "p-5 rounded-2xl bg-primary/10 text-primary shadow-inner ring-1 ring-inset ring-primary/20 transition-all";
const ICON_WRAPPER_HOVER = "group-hover:scale-105 group-hover:shadow-glow-primary-lg";

const SIDEBAR_ITEM_BASE = "group relative flex items-center gap-4 w-full cursor-pointer rounded-xl border p-3.5 transition-all duration-300";
const SIDEBAR_ITEM_SELECTED = "border-primary/40 bg-primary/10 shadow-glow-primary-ring ring-1 ring-primary/20";

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
    const { 
        extensions, 
        isLoading, 
        error, 
        fetchExtensions, 
        activateExtension, 
        deactivateExtension,
        uninstallExtension 
    } = useExtensionStore();
    
    const [selectedExtensionId, setSelectedExtensionId] = useState<string | null>(null);
    const [draftByExtensionId, setDraftByExtensionId] = useState<Record<string, Record<string, IpcValue>>>({});
    const [loadingConfigId, setLoadingConfigId] = useState<string | null>(null);
    const [savingConfig, setSavingConfig] = useState(false);
    const [isUninstalling, setIsUninstalling] = useState<string | null>(null);
    const [isUninstallConfirmOpen, setIsUninstallConfirmOpen] = useState(false);

    const registry = useMarketplaceStore(s => s.registry);
    const [isUpdating, setIsUpdating] = useState<string | null>(null);

    const extensionsWithUpdates = useMemo(() => {
        return extensions.map(ext => {
            const mItem = (registry?.extensions || []).find((m: MarketplaceExtension) => m.id === ext.manifest.id);
            return {
                ...ext,
                updateAvailable: mItem?.updateAvailable ?? false,
                latestVersion: mItem?.version
            };
        });
    }, [extensions, registry]);

    const selectedExtension = useMemo(
        () => extensionsWithUpdates.find(extension => extension.manifest.id === selectedExtensionId) ?? null,
        [extensionsWithUpdates, selectedExtensionId]
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
            void Promise.resolve().then(() => setSelectedExtensionId(null));
            return;
        }
        if (!selectedExtensionId || !extensions.some(extension => extension.manifest.id === selectedExtensionId)) {
            void Promise.resolve().then(() => setSelectedExtensionId(extensions[0]?.manifest.id ?? null));
        }
    }, [extensions, selectedExtensionId]);

    useEffect(() => {
        if (!selectedExtensionId || draftByExtensionId[selectedExtensionId]) {
            return;
        }
        let active = true;
        void Promise.resolve().then(() => setLoadingConfigId(selectedExtensionId));
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
                pushNotification({ type: 'error', message: t('frontend.settings.extensions.plugins.configLoadError') });
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

    const handleUninstallExtension = useCallback(async (extensionId: string): Promise<void> => {
        if (isUninstalling) {return;}
        
        setIsUninstalling(extensionId);
        try {
            await uninstallExtension(extensionId);
            pushNotification({ type: 'success', message: t('frontend.settings.extensions.plugins.uninstallSuccess') });
            setSelectedExtensionId(null);
        } catch (err) {
            appLogger.error('ExtensionPluginsTab', `Failed to uninstall extension ${extensionId}`, err as Error);
            pushNotification({ type: 'error', message: t('frontend.settings.extensions.plugins.uninstallError') });
        } finally {
            setIsUninstalling(null);
        }
    }, [isUninstalling, uninstallExtension, t]);

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
            pushNotification({ type: 'success', message: t('frontend.settings.extensions.plugins.configSaved') });
        } catch (error) {
            appLogger.error('ExtensionPluginsTab', `Failed to save extension config for ${selectedExtensionId}`, error as Error);
            pushNotification({ type: 'error', message: t('frontend.settings.extensions.plugins.configSaveError') });
        } finally {
            setSavingConfig(false);
        }
    }, [draftByExtensionId, selectedExtensionId, t]);

    const handleUpdate = useCallback(async (extensionId: string): Promise<void> => {
        setIsUpdating(extensionId);
        try {
            const mItem = (registry?.extensions || []).find((m: MarketplaceExtension) => m.id === extensionId);
            if (!mItem) {
                throw new Error('Extension not found in registry');
            }

            const result = await window.electron.marketplace.install({
                type: 'extension',
                id: extensionId,
                downloadUrl: mItem.downloadUrl,
                name: mItem.name,
                description: mItem.description,
                author: mItem.author,
                version: mItem.version,
            });
            if (result.success) {
                pushNotification({ type: 'success', message: t('frontend.settings.extensions.plugins.updateSuccess') });
                await Promise.all([
                    fetchExtensions(),
                    marketplaceStore.checkLiveUpdates()
                ]);
            } else {
                throw new Error(result.message ?? 'Update failed');
            }
        } catch (error) {
            appLogger.error('ExtensionPluginsTab', `Failed to update extension ${extensionId}`, error as Error);
            pushNotification({ type: 'error', message: t('frontend.settings.extensions.plugins.updateError') });
        } finally {
            setIsUpdating(null);
        }
    }, [fetchExtensions, registry, t]);

    const selectedDraft = selectedExtensionId ? (draftByExtensionId[selectedExtensionId] ?? {}) : {};

    return (
        <div className="grid gap-6 xl:grid-cols-380-main h-screen-minus-200">
            {/* Left Sidebar: Extension List */}
            <section className="flex flex-col rounded-2xl border border-border/40 bg-card/30 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border/20 bg-muted/20 flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase text-muted-foreground/70">
                        {t('frontend.settings.extensions.plugins.title')}
                    </h3>
                    <Badge variant="secondary" className="font-mono">{extensions.length}</Badge>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {error && (
                        <div className={C_EXTENSIONPLUGINSTAB_1}>
                             <p className="font-bold flex items-center gap-2"><IconInfoCircle className="w-3 h-3" /> Error</p>
                             <p className="mt-1 opacity-80">{error}</p>
                        </div>
                    )}
                    
                    {isLoading && extensions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-3 opacity-50">
                            <IconRefresh className="w-6 h-6 animate-spin text-primary" />
                            <p className="text-sm font-bold text-muted-foreground">{t('common.loading')}</p>
                        </div>
                    ) : extensions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 space-y-4 opacity-40 grayscale">
                            <IconPackage className="w-12 h-12" />
                            <p className="text-sm font-bold text-muted-foreground text-center px-8">
                                {t('frontend.settings.extensions.plugins.empty')}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {extensionsWithUpdates.map(extension => {
                                const isSelected = extension.manifest.id === selectedExtensionId;
                                const isActive = extension.status === 'active';
                                
                                return (
                                    <div
                                        key={extension.manifest.id}
                                        onClick={() => setSelectedExtensionId(extension.manifest.id)}
                                        className={cn(
                                            SIDEBAR_ITEM_BASE,
                                            isSelected
                                                ? SIDEBAR_ITEM_SELECTED
                                                : 'border-transparent bg-transparent hover:bg-muted/40 hover:border-border/40 hover:shadow-sm'
                                        )}
                                    >
                                        <div className={cn(
                                            'p-2.5 rounded-xl shrink-0 transition-all duration-300 shadow-inner',
                                            isActive
                                                ? 'bg-primary/20 text-primary ring-1 ring-inset ring-primary/30 group-hover:scale-110'
                                                : 'bg-muted/50 text-muted-foreground/40 grayscale opacity-60'
                                        )}>
                                            <IconPackage className="w-6 h-6" />
                                        </div>
                                        
                                        <div className="min-w-0 flex-1 space-y-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <p className={cn(
                                                        'truncate text-sm font-bold leading-none',
                                                        isActive ? 'text-foreground' : 'text-muted-foreground/60'
                                                    )}>
                                                        {extension.manifest.name}
                                                    </p>
                                                    {isActive && (
                                                        <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-success shadow-glow-success" />
                                                    )}
                                                </div>
                                                {extension.updateAvailable && (
                                                    <div className="h-2 w-2 shrink-0 rounded-full bg-destructive shadow-glow-destructive-rgb animate-pulse" />
                                                )}
                                            </div>
                                            
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        'text-sm h-4 leading-none font-bold uppercase px-1.5',
                                                        isActive ? 'border-primary/30 text-primary bg-primary/5' : 'opacity-30'
                                                    )}
                                                >
                                                    V{extension.manifest.version}
                                                </Badge>
                                                {!isActive && (
                                                    <span className="text-sm font-bold uppercase text-muted-foreground/30">{t('common.disabled')}</span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {isSelected && (
                                            <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-primary rounded-r-full shadow-edge-primary" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* Right Panel: Extension Details & Config */}
            <section className="flex flex-col rounded-2xl border border-border/40 bg-card/30 overflow-hidden shadow-sm">
                {!selectedExtension ? (
                    <div className="flex flex-col items-center justify-center p-12 flex-1 text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center animate-in zoom-in-50 duration-500">
                             <IconSettings2 className="w-10 h-10 text-muted-foreground/30" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-base font-bold text-muted-foreground/50">{t('frontend.settings.extensions.plugins.select')}</h3>
                            <p className="text-sm text-muted-foreground/30 max-w-280">Select an extension from the list to manage its configuration and lifecycle.</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col h-full overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
                        {/* Header Section */}
                        <div className="p-8 border-b border-border/20 bg-muted/10">
                            <div className="flex flex-col gap-6">
                                <div className="flex items-start justify-between gap-6">
                                    <div className="flex gap-6">
                                        <div className="relative group">
                                            <div className={cn(ICON_WRAPPER_BASE, ICON_WRAPPER_HOVER)}>
                                                <IconPackage className="w-10 h-10" />
                                            </div>
                                            {selectedExtension.status === 'active' && (
                                                <div className={C_EXTENSIONPLUGINSTAB_2} />
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-bold text-foreground leading-none mb-2">
                                                {selectedExtension.manifest.name}
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-3">
                                                <span className="text-sm font-bold text-muted-foreground/40 uppercase ">
                                                    {selectedExtension.manifest.author.name}
                                                </span>
                                                <span className="h-1 w-1 rounded-full bg-border/40" />
                                                <Badge variant="outline" className="font-bold text-sm border-primary/20 text-primary bg-primary/5 uppercase px-2 h-5">
                                                    V{selectedExtension.manifest.version}
                                                </Badge>
                                                {selectedExtension.updateAvailable && (
                                                    <Badge variant="destructive" className="h-5 px-2 text-sm font-bold uppercase animate-pulse shadow-lg shadow-destructive/20">
                                                        Update Available: v{selectedExtension.latestVersion}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {selectedExtension.updateAvailable && (
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                className="h-9 px-4 gap-2 font-bold uppercase text-sm shadow-lg shadow-destructive/20 active:scale-95"
                                                onClick={() => { void handleUpdate(selectedExtension.manifest.id); }}
                                                disabled={isUpdating === selectedExtension.manifest.id}
                                            >
                                                <IconRefresh className={cn(
                                                    'h-3.5 w-3.5',
                                                    isUpdating === selectedExtension.manifest.id && 'animate-spin'
                                                )} />
                                                {t('common.update')}
                                            </Button>
                                        )}
                                        
                                        <div className={C_EXTENSIONPLUGINSTAB_3}>
                                            <span className={cn(
                                                'text-sm font-bold uppercase ',
                                                selectedExtension.status === 'active' ? 'text-primary' : 'text-muted-foreground/50'
                                            )}>
                                                {selectedExtension.status === 'active' ? t('common.active') : t('common.disabled')}
                                            </span>
                                            <Switch
                                                checked={selectedExtension.status === 'active'}
                                                onCheckedChange={() => {
                                                    void handleToggleExtension(selectedExtension.manifest.id, selectedExtension.status);
                                                }}
                                            />
                                        </div>
                                        
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className={C_EXTENSIONPLUGINSTAB_4}
                                            title={t('frontend.marketplace.uninstall')}
                                            onClick={() => {
                                                setIsUninstallConfirmOpen(true);
                                            }}
                                            disabled={isUninstalling === selectedExtension.manifest.id}
                                        >
                                            <IconTrash className={cn('w-4 h-4', isUninstalling === selectedExtension.manifest.id && 'animate-pulse')} />
                                        </Button>
                                    </div>
                                </div>
                                
                                <p className="text-sm font-medium text-muted-foreground/80 leading-relaxed max-w-2xl border-l-2 border-primary/20 pl-4 py-1 ">
                                    {selectedExtension.manifest.description}
                                </p>
                            </div>
                        </div>

                        {/* Configuration & Scroll Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-8 CustomScrollbar">
                            <div className="space-y-6 max-w-3xl">
                                <div className={C_EXTENSIONPLUGINSTAB_5}>
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                            <IconSettings2 className="w-4 h-4" />
                                        </div>
                                        <h4 className="text-sm font-bold uppercase text-foreground/80">
                                            {t('frontend.settings.extensions.plugins.configTitle')}
                                        </h4>
                                    </div>
                                    <Button
                                        size="sm"
                                        className="h-8 rounded-lg font-bold px-4 shadow-md shadow-primary/10"
                                        onClick={() => void handleSaveConfig()}
                                        disabled={savingConfig || loadingConfigId === selectedExtension.manifest.id || Object.keys(configProperties).length === 0}
                                    >
                                        {savingConfig ? (
                                            <IconRefresh className="w-3.5 h-3.5 mr-2 animate-spin" />
                                        ) : null}
                                        {savingConfig ? t('common.saving') : t('common.save')}
                                    </Button>
                                </div>

                                {loadingConfigId === selectedExtension.manifest.id ? (
                                    <div className="py-12 flex flex-col items-center justify-center space-y-4 opacity-50">
                                        <IconRefresh className="w-8 h-8 animate-spin text-primary" />
                                        <p className="text-sm font-bold uppercase ">{t('common.loading')}</p>
                                    </div>
                                ) : Object.keys(configProperties).length === 0 ? (
                                    <div className={C_EXTENSIONPLUGINSTAB_6}>
                                        <div className="p-3 rounded-full bg-muted/20">
                                            <IconInfoCircle className="w-6 h-6 text-muted-foreground/30" />
                                        </div>
                                        <p className="text-sm font-bold text-muted-foreground/60">{t('frontend.settings.extensions.plugins.noConfig')}</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-4">
                                        {Object.entries(configProperties).map(([key, property]) => {
                                            const fieldValue = resolveFieldValue(selectedDraft, key, property);
                                            const fieldLabel = property.title.trim().length > 0 ? property.title : key;
                                            
                                            return (
                                                <div key={key} className={C_EXTENSIONPLUGINSTAB_7}>
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div className="space-y-1">
                                                            <Label className="text-sm font-bold text-foreground/90 uppercase ">
                                                                {fieldLabel}
                                                            </Label>
                                                            <p className="text-sm font-medium text-muted-foreground/60 leading-relaxed max-w-xl">
                                                                {property.description}
                                                            </p>
                                                        </div>
                                                        
                                                        <div className="shrink-0 flex items-center justify-end min-w-100">
                                                            {property.type === 'boolean' ? (
                                                                <Switch
                                                                    checked={Boolean(fieldValue)}
                                                                    onCheckedChange={checked => handleFieldChange(key, checked)}
                                                                />
                                                            ) : property.enum && property.enum.length > 0 ? (
                                                                <Select
                                                                    value={typeof fieldValue === 'string' ? fieldValue : ''}
                                                                    onValueChange={value => handleFieldChange(key, value)}
                                                                >
                                                                    <SelectTrigger className="w-180 h-9 rounded-xl border-border/30 bg-background/50 font-bold overflow-hidden">
                                                                        <SelectValue className="truncate" placeholder={key} />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="rounded-xl border-border/40 bg-card shadow-2xl">
                                                                        {property.enum.map(option => (
                                                                            <SelectItem key={option} value={option} className="px-3 py-2 font-medium">
                                                                                {option}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            ) : null}
                                                        </div>
                                                    </div>

                                                    {property.type !== 'boolean' && !(property.enum && property.enum.length > 0) && (
                                                        <div className="mt-2 animate-in slide-in-from-top-1 duration-200">
                                                            {property.type === 'number' ? (
                                                                <Input
                                                                    type="number"
                                                                    value={typeof fieldValue === 'number' ? String(fieldValue) : ''}
                                                                    className={C_EXTENSIONPLUGINSTAB_8}
                                                                    onChange={event => {
                                                                        const parsed = Number(event.target.value);
                                                                        if (Number.isFinite(parsed)) {
                                                                            handleFieldChange(key, parsed);
                                                                        }
                                                                    }}
                                                                />
                                                            ) : property.type === 'string' ? (
                                                                <Input
                                                                    value={typeof fieldValue === 'string' ? fieldValue : ''}
                                                                    className="h-10 rounded-xl border-border/30 bg-background/50 px-4 font-bold shadow-inner focus:ring-primary/20 transition-all"
                                                                    onChange={event => handleFieldChange(key, event.target.value)}
                                                                />
                                                            ) : (
                                                                <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-warning">
                                                                    <IconAlertTriangle className="h-4 w-4 shrink-0" />
                                                                    <p className="text-sm font-bold uppercase ">
                                                                        {t('frontend.settings.extensions.plugins.complexConfigHint')}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        <ConfirmationModal
                            isOpen={isUninstallConfirmOpen}
                            onClose={() => setIsUninstallConfirmOpen(false)}
                            onConfirm={() => {
                                setIsUninstallConfirmOpen(false);
                                void handleUninstallExtension(selectedExtension.manifest.id);
                            }}
                            title="Uninstall Extension"
                            message={`Are you sure you want to uninstall ${selectedExtension.manifest.name}? This action cannot be undone.`}
                            variant="danger"
                        />
                    </div>
                )}
            </section>
        </div>
    );
};


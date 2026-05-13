/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Label } from '@radix-ui/react-label';
import type {
    WorkspaceAgentCommandPolicy,
    WorkspaceAgentPathPolicy,
} from '@shared/types/workspace-agent-session';
import { IconBolt, IconBrain, IconSearch, IconStar } from '@tabler/icons-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { ProviderIcon } from '@/components/shared/ProviderIcon';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { WorkspaceAgentPermissionEditor } from '@/features/workspace/workspace-agent/WorkspaceAgentPermissionEditor';
import { cn } from '@/lib/utils';

import { ModelCategory } from '../types';

import {
    SelectorChatMode,
} from './model-selector/ModelSelectorSections';
import { ModelSelectorItem } from './ModelSelectorItem';

/* Minimum padding from viewport edges in pixels */
const VIEWPORT_PADDING = 16;

export type ChatMode = 'instant' | 'thinking' | 'agent';
export type ThinkingLevel =
    | 'none'
    | 'minimal'
    | 'low'
    | 'medium'
    | 'high'
    | 'xhigh'
    | 'max'
    | string;

const COMMAND_POLICY_OPTIONS: ReadonlyArray<WorkspaceAgentCommandPolicy> = [
    'blocked',
    'ask-every-time',
    'allowlist',
    'full-access',
];
const PATH_POLICY_OPTIONS: ReadonlyArray<WorkspaceAgentPathPolicy> = [
    'workspace-root-only',
    'allowlist',
    'restricted-off-dangerous',
    'full-access'
];

function isCommandPolicy(value: string): value is WorkspaceAgentCommandPolicy {
    return COMMAND_POLICY_OPTIONS.includes(value as WorkspaceAgentCommandPolicy);
}

function isPathPolicy(value: string): value is WorkspaceAgentPathPolicy {
    return PATH_POLICY_OPTIONS.includes(value as WorkspaceAgentPathPolicy);
}

const ModelSelectorQuotaBanner: React.FC<{
    activeCategory: ModelCategory;
    activeCopilotQuota?: import('@shared/types/quota').CopilotQuota | null;
    activeClaudeQuota?: import('@shared/types/quota').ClaudeQuota | null;
    activeCodexUsage?: { usage: import('@shared/types/quota').CodexUsage } | null;
    activeCursorQuota?: import('@shared/types/quota').CursorQuota | null;
    t: (key: string) => string;
}> = ({ activeCategory, activeCopilotQuota, activeClaudeQuota, activeCodexUsage, activeCursorQuota, t }) => {
    const items = useMemo(() => {
        const isCopilot = activeCategory.id === 'copilot';
        const isCodex = activeCategory.id === 'codex';
        const isClaude = activeCategory.id === 'claude';
        const isCursor = activeCategory.id === 'cursor';
        const result: Array<{ label: string; percent: number; sublabel?: string; value?: string }> = [];

        if (isCopilot && activeCopilotQuota) {
            const limit = activeCopilotQuota.seat_breakdown?.total_seats ?? activeCopilotQuota.limit ?? 0;
            const remaining = activeCopilotQuota.seat_breakdown
                ? (limit - activeCopilotQuota.seat_breakdown.active_seats)
                : activeCopilotQuota.remaining;
            const percent = limit > 0 ? Math.round((remaining / limit) * 100) : 0;

            const isSeatBased = !!activeCopilotQuota.seat_breakdown;
            const labelText = isSeatBased ? t('frontend.statistics.seatsStatus') : '';

            result.push({
                label: labelText,
                percent,
                value: `${remaining} / ${limit}`
            });
        }

        if (isCodex && activeCodexUsage?.usage) {
            const usage = activeCodexUsage.usage;
            if (typeof usage.dailyUsedPercent === 'number') {
                result.push({
                    label: t('frontend.statistics.dailyStatus'),
                    percent: Math.max(0, Math.min(100, 100 - usage.dailyUsedPercent)),
                    sublabel: '24h window'
                });
            }
            if (typeof usage.weeklyUsedPercent === 'number') {
                result.push({
                    label: t('frontend.statistics.weeklyStatus'),
                    percent: Math.max(0, Math.min(100, 100 - usage.weeklyUsedPercent)),
                    sublabel: '7d window'
                });
            }
        }

        if (isClaude && activeClaudeQuota?.fiveHour) {
            result.push({
                label: t('frontend.statistics.usageStatus'),
                percent: 100 - activeClaudeQuota.fiveHour.utilization,
                sublabel: '5h window'
            });
        }

        if (isCursor && activeCursorQuota) {
            if (activeCursorQuota.fiveHour) {
                result.push({
                    label: t('frontend.statistics.usageStatus'),
                    percent: 100 - activeCursorQuota.fiveHour.utilization,
                    sublabel: '5h window'
                });
            }
            if (activeCursorQuota.weekly) {
                result.push({
                    label: t('frontend.statistics.weeklyStatus'),
                    percent: 100 - activeCursorQuota.weekly.utilization,
                    sublabel: '7d window'
                });
            }
        }

        return result;
    }, [activeCategory.id, activeCopilotQuota, activeCodexUsage, activeClaudeQuota, activeCursorQuota, t]);

    const isVisible = ['antigravity', 'copilot', 'codex', 'claude', 'cursor'].includes(activeCategory.id);

    // Persistent cache to prevent flickering when data is temporarily null/loading
    const [quotaCache, setQuotaCache] = useState<Record<string, typeof items>>({});

    useEffect(() => {
        if (items.length === 0) { return; }
        const timer = window.setTimeout(() => {
            setQuotaCache(prev => ({ ...prev, [activeCategory.id]: items }));
        }, 0);
        return () => window.clearTimeout(timer);
    }, [items, activeCategory.id]);

    const effectiveItems = items.length > 0 ? items : (quotaCache[activeCategory.id] || []);

    if (!isVisible || effectiveItems.length === 0) { return null; }

    return (
        <div className="mx-2 mb-4 mt-1 rounded-xl border border-primary/10 bg-primary/02 px-4 py-2.5 shadow-primary-medium backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-2">
                <IconBrain className="w-3 h-3 text-primary/50" />
                <span className="typo-overline font-bold text-primary/40 uppercase ">{t('frontend.statistics.quotaStatus')}</span>
            </div>
            <div className="space-y-3">
                {effectiveItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-4 group">
                        {(item.label || item.value) && (
                            <div className="flex min-w-60 flex-col">
                                {item.label && (
                                    <span className="typo-overline font-bold text-muted-foreground/50 uppercase leading-none mb-0.5">
                                        {item.label}
                                    </span>
                                )}
                                {item.value && (
                                    <span className="typo-overline font-bold text-foreground/80 tabular-nums leading-none">
                                        {item.value}
                                    </span>
                                )}
                            </div>
                        )}

                        <div className="flex-1 flex items-center gap-3 w-full">
                             <div className="relative h-2 w-full flex-1 overflow-hidden rounded-full border border-border/10 bg-muted/30">
                                 <div
                                     className={cn(
                                         "h-full min-w-1 rounded-full shadow-sm transition-all duration-700 ease-out",
                                         item.percent <= 10 ? 'bg-red-500' : item.percent <= 30 ? 'bg-amber-500' : 'bg-emerald-500'
                                     )}
                                     style={{ width: `${item.percent}%` }}
                                 />
                             </div>

                            <div className={cn(
                                "flex items-baseline gap-1.5 min-w-36 justify-end",
                                item.percent <= 10 ? 'text-destructive' : item.percent <= 30 ? 'text-warning' : 'text-primary'
                            )}>
                                <span className="typo-overline font-bold tabular-nums ">
                                    {item.percent}%
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface ModelSelectorPopoverProps {
    isOpen: boolean;
    initialTab?: 'models' | 'permissions';
    onClose: () => void;
    categories: ModelCategory[];
    selectedModels: Array<{ provider: string; model: string }>;
    selectedModel: string;
    selectedProvider: string;
    onSelect: (provider: string, id: string, isMultiSelect: boolean, keepOpen?: boolean) => void;
    onRemoveModel?: (provider: string, model: string) => void;
    isFavorite?: (modelId: string) => boolean;
    toggleFavorite?: (modelId: string) => void;
    recentModels?: string[];
    t: (key: string) => string;
    chatMode?: SelectorChatMode;
    onChatModeChange?: (mode: SelectorChatMode) => void;
    showChatModeControls?: boolean;
    thinkingLevel?: ThinkingLevel;
    onThinkingLevelChange?: (modelId: string, level: string) => void;

    copilotQuota?: { accounts: Array<import('@shared/types/quota').CopilotQuota & { accountId?: string; email?: string; isActive?: boolean }> } | null;
    activeCopilotAccountId?: string | null;
    activeCopilotAccountEmail?: string | null;
    activeCopilotQuota?: (import('@shared/types/quota').CopilotQuota & { accountId?: string; email?: string; isActive?: boolean }) | null;
    activeClaudeQuota?: import('@shared/types/quota').ClaudeQuota | null;
    activeCodexUsage?: ({ usage: import('@shared/types/quota').CodexUsage; accountId?: string; email?: string } & { isActive?: boolean }) | null;
    activeAntigravityQuota?: import('@shared/types/quota').QuotaResponse | null;
    activeCursorQuota?: import('@shared/types/quota').CursorQuota | null;
    permissionPolicy?: import('@shared/types/workspace-agent-session').WorkspaceAgentPermissionPolicy;
    onUpdatePermissionPolicy?: (policy: import('@shared/types/workspace-agent-session').WorkspaceAgentPermissionPolicy) => void;
    triggerRef?: React.RefObject<HTMLElement>;
}

interface ModelSelectorPermissionsPanelProps {
    onUpdatePermissionPolicy?: (policy: import('@shared/types/workspace-agent-session').WorkspaceAgentPermissionPolicy) => void;
    permissionPolicy: import('@shared/types/workspace-agent-session').WorkspaceAgentPermissionPolicy;
    t: (key: string) => string;
    updatePermissionPolicy: (
        key: 'commandPolicy' | 'pathPolicy',
        value: string
    ) => void;
}

const ModelSelectorPermissionsPanel: React.FC<ModelSelectorPermissionsPanelProps> = ({
    onUpdatePermissionPolicy,
    permissionPolicy,
    t,
    updatePermissionPolicy,
}) => (
    <div className="space-y-6 p-6">
        <div className="space-y-4">
            <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground/90">
                    {t('frontend.workspaceAgent.permissions.commands')}
                </label>
                <Select
                    value={permissionPolicy.commandPolicy}
                    onValueChange={value => updatePermissionPolicy('commandPolicy', value)}
                >
                    <SelectTrigger className="w-full rounded-xl border border-border/50 bg-muted/30 p-2.5 text-sm text-foreground/90 transition-colors focus:ring-1 focus:ring-primary/50">
                        <SelectValue placeholder={t('frontend.workspaceAgent.permissions.policy.blocked')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="blocked">{t('frontend.workspaceAgent.permissions.policy.blocked')}</SelectItem>
                        <SelectItem value="ask-every-time">{t('frontend.workspaceAgent.permissions.policy.ask-every-time')}</SelectItem>
                        <SelectItem value="allowlist">{t('frontend.workspaceAgent.permissions.policy.allowlist')}</SelectItem>
                        <SelectItem value="full-access">{t('frontend.workspaceAgent.permissions.policy.full-access')}</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground/90">
                    {t('frontend.workspaceAgent.permissions.files')}
                </label>
                <Select
                    value={permissionPolicy.pathPolicy}
                    onValueChange={value => updatePermissionPolicy('pathPolicy', value)}
                >
                    <SelectTrigger className="w-full rounded-xl border border-border/50 bg-muted/30 p-2.5 text-sm text-foreground/90 transition-colors focus:ring-1 focus:ring-primary/50">
                        <SelectValue placeholder={t('frontend.workspaceAgent.permissions.policy.workspace-root-only')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="workspace-root-only">{t('frontend.workspaceAgent.permissions.policy.workspace-root-only')}</SelectItem>
                        <SelectItem value="allowlist">{t('frontend.workspaceAgent.permissions.policy.allowlist')}</SelectItem>
                        <SelectItem value="restricted-off-dangerous">{t('frontend.workspaceAgent.permissions.policy.restricted-off-dangerous')}</SelectItem>
                        <SelectItem value="full-access">{t('frontend.workspaceAgent.permissions.policy.full-access')}</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>

        {onUpdatePermissionPolicy && (
            <WorkspaceAgentPermissionEditor
                permissionPolicy={permissionPolicy}
                onUpdatePermissions={onUpdatePermissionPolicy}
                t={t}
            />
        )}
    </div>
);

export const ModelSelectorPopover: React.FC<ModelSelectorPopoverProps> = ({
    isOpen,
    initialTab,
    onClose,
    categories,
    selectedModels,
    selectedModel,
    selectedProvider,
    onSelect,
    toggleFavorite,
    t,
    chatMode = 'instant',
    onChatModeChange,
    showChatModeControls = true,
    thinkingLevel = 'low',
    onThinkingLevelChange,

    activeCopilotQuota,
    activeClaudeQuota,
    activeCodexUsage,
    activeAntigravityQuota,
    activeCursorQuota,
    permissionPolicy,
    onUpdatePermissionPolicy: _onUpdatePermissionPolicy,
    triggerRef
}) => {
    const popoverRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [activeProviderId, setActiveProviderId] = useState<string>('favorites');
    const [activeTab, setActiveTab] = useState<'models' | 'permissions'>(initialTab === 'permissions' ? 'permissions' : 'models');
    const [popoverPosition, setPopoverPosition] = useState<React.CSSProperties>({ visibility: 'hidden' });
    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

    // Synchronize state when modal opens using the render-phase adjustment pattern
    if (isOpen !== prevIsOpen) {
        setPrevIsOpen(isOpen);
        if (isOpen) {
            if (initialTab && activeTab !== initialTab) {
                setActiveTab(initialTab);
            }
            const currentCat = categories.find(c => c.models.some(m => m.id === selectedModel)) ?? categories[0];
            if (currentCat && activeProviderId !== currentCat.id) {
                setActiveProviderId(currentCat.id);
            }
        }
    }

    useEffect(() => {
        if (!isOpen || !triggerRef?.current || !popoverRef.current) {
            return;
        }

        const updatePosition = () => {
            const trigger = triggerRef.current;
            const popover = popoverRef.current;
            if (!trigger || !popover) {
                return;
            }

            const triggerRect = trigger.getBoundingClientRect();
            const popoverRect = popover.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let top = triggerRect.bottom + 8;
            let left = triggerRect.left;

            if (top + popoverRect.height > viewportHeight - VIEWPORT_PADDING) {
                top = triggerRect.top - popoverRect.height - 8;
            }

            if (left + popoverRect.width > viewportWidth - VIEWPORT_PADDING) {
                left = viewportWidth - popoverRect.width - VIEWPORT_PADDING;
            }

            if (left < VIEWPORT_PADDING) {
                left = VIEWPORT_PADDING;
            }

            setPopoverPosition({
                top: `${top}px`,
                left: `${left}px`,
                visibility: 'visible'
            });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen, triggerRef, activeTab, activeProviderId]);

    const handleClose = useCallback(() => {
        setSearchQuery('');
        setActiveTab('models');
        onClose();
    }, [onClose]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            handleClose();
        }
    }, [handleClose]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        document?.addEventListener('keydown', handleKeyDown);
        return () => {
            document?.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, handleKeyDown]);

    const filteredCategories = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        return categories.map(cat => ({
            ...cat,
            models: cat.models.filter(m => {
                if (m.lifecycle === 'deprecated' || m.lifecycle === 'retired') {
                    return false;
                }
                return query === '' || m.label.toLowerCase().includes(query) || m.id.toLowerCase().includes(query);
            })
        })).filter(cat => cat.models.length > 0);
    }, [categories, searchQuery]);

    const activeCategory = useMemo(() => {
        const found = filteredCategories.find(c => c.id === activeProviderId);
        if (found) {
            return found;
        }
        // If not found in filtered, try to find in raw categories to keep the tab stable
        return categories.find(c => c.id === activeProviderId) ?? filteredCategories[0];
    }, [filteredCategories, activeProviderId, categories]);

    const handleSelect = useCallback((provider: string, id: string, isM: boolean, explicitThinkingLevel?: string) => {
        if (isM) {
            onSelect(provider, id, isM, true);
            return;
        }

        if (explicitThinkingLevel) {
            onThinkingLevelChange?.(id, explicitThinkingLevel);

            const isAlreadySelected = selectedModels.some(m => m.model === id && m.provider === provider);
            if (!isAlreadySelected) {
                onSelect(provider, id, isM, false);
                handleClose();
            }
            return;
        }

        onSelect(provider, id, isM, false);
        handleClose();
    }, [handleClose, onSelect, onThinkingLevelChange, selectedModels]);

    if (!isOpen) {
        return null;
    }

    return createPortal(
        <>
            {/* Backdrop for closing */}
            <div
                className="fixed inset-0 z-95 bg-transparent"
                onMouseDown={(e) => {
                    // Only close if we're not clicking on the trigger that handles its own toggle
                    if (triggerRef?.current?.contains(e.target as Node)) {
                        return;
                    }
                    handleClose();
                }}
            />
            <div
                ref={popoverRef}
                style={popoverPosition}
                className={cn(
                    'fixed z-100 w-450 h-580 flex flex-col',
                    'bg-popover/98 backdrop-blur-2xl rounded-2xl shadow-popover-heavy border border-border/40',
                    'animate-in fade-in-0 zoom-in-95 duration-200 ease-out origin-top'
                )}
            >
                <div className="flex flex-col h-full overflow-hidden bg-background border rounded-2xl">
                    {/* Search Bar - Shadcn Input Style */}
                    <div className="p-3 border-b border-border/40">
                        <div className="relative">
                            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                            <Input
                                ref={searchInputRef}
                                placeholder={t('frontend.modelSelector.searchPlaceholder')}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="bg-muted/30 pl-9 border-none h-9 text-sm focus-visible:ring-1 focus-visible:ring-primary/30"
                            />
                        </div>
                    </div>

                    {/* Provider Tabs - Real Logos, Horizontal only, Theme Supportive */}
                    <div className="px-2 border-b border-border/40 flex items-center gap-2 overflow-x-auto overflow-y-hidden no-scrollbar bg-muted/10 h-60 shrink-0 whitespace-nowrap">
                        {filteredCategories.map(cat => {
                            const isActive = activeProviderId === cat.id;
                            const Icon = cat.id === 'favorites' ? IconStar : (cat.icon || IconBolt);

                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveProviderId(cat.id)}
                                    className={cn(
                                        'inline-flex flex-col items-center justify-center min-w-48 h-48 p-2 rounded-xl transition-all duration-300',
                                        isActive
                                            ? 'bg-primary/10 text-foreground shadow-sm ring-1 ring-primary/50'
                                            : 'text-muted-foreground/40 hover:bg-muted/10 hover:text-muted-foreground/60'
                                    )}
                                    title={cat.name}
                                >
                                    <div className={cn(
                                        'flex items-center justify-center transition-all duration-300 h-6 w-6',
                                        isActive ? 'scale-110' : 'scale-95'
                                    )}>
                                        {cat.id === 'favorites' ? (
                                            <Icon className={cn(
                                                'w-5 h-5 transition-all duration-300',
                                                isActive ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'
                                            )} />
                                        ) : (
                                        <ProviderIcon 
                                            provider={cat.id} 
                                            variant="minimal"
                                            size="100%"
                                            className={cn(
                                                'transition-all duration-300',
                                                isActive ? 'opacity-100' : 'opacity-30'
                                            )}
                                            containerClassName="bg-transparent border-none p-0 h-6 w-6"
                                        />
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {/* Shared Provider Quotas Header */}
                        {activeCategory && (
                            <ModelSelectorQuotaBanner
                                activeCategory={activeCategory}
                                activeCopilotQuota={activeCopilotQuota}
                                activeClaudeQuota={activeClaudeQuota}
                                activeCodexUsage={activeCodexUsage}
                                activeCursorQuota={activeCursorQuota}
                                t={t}
                            />
                        )}

                        {activeCategory?.models?.map?.(model => (
                            <ModelSelectorItem
                                key={`${activeCategory.id}-${model.provider}-${model.id}`}
                                model={model}
                                isSelected={selectedModels.some(m => m.provider === model.provider && m.model === model.id)}
                                isPrimary={selectedModel === model.id && selectedProvider === model.provider}
                                onSelect={(p, mid, isM, level) => handleSelect(p, mid, isM, level as string)}
                                toggleFavorite={toggleFavorite}
                                t={t}
                                activeAntigravityQuota={activeAntigravityQuota}
                                thinkingLevel={thinkingLevel}
                                onThinkingLevelChange={onThinkingLevelChange}
                            />
                        ))}
                        {!activeCategory?.models?.length && (
                            <div className="py-12 px-6 text-center space-y-2">
                                <div className="text-muted-foreground/30 text-sm font-semibold uppercase ">
                                    {searchQuery ? 'No models match your search' : `No models available for ${activeCategory?.name || 'this provider'}`}
                                </div>
                                {!searchQuery && (
                                    <p className="typo-overline text-muted-foreground/40 leading-relaxed max-w-200 mx-auto">
                                        This might be because the account is not linked or the models are still loading.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                    {/* Advanced Logic & Safety Configuration Footer */}
                    {((showChatModeControls && onChatModeChange) || permissionPolicy) && (
                        <div className="px-4 py-4 border-t border-border/20 bg-background/95 backdrop-blur-xl shrink-0">
                            <div className="flex items-center justify-center gap-6">
                                {showChatModeControls && onChatModeChange && (
                                    <div className="space-y-1.5 flex flex-col items-center">
                                        <Label className="typo-overline font-semibold uppercase text-muted-foreground/50 px-0.5">
                                            {t('frontend.workspaceAgent.permissions.mode')}
                                        </Label>
                                        <Select
                                            value={chatMode}
                                            onValueChange={(value) => onChatModeChange(value as SelectorChatMode)}
                                        >
                                            <SelectTrigger className="w-110 h-9 rounded-xl border-border/10 bg-muted/20 hover:bg-muted/30 hover:border-primary/20 transition-all shadow-sm ring-offset-background focus:ring-1 focus:ring-primary/20">
                                                <SelectValue className="text-sm" placeholder="Mode" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-2xl border-border/10 shadow-2xl backdrop-blur-xl z-150">
                                                {(['instant', 'thinking', 'agent'] as SelectorChatMode[]).map(mode => (
                                                    <SelectItem
                                                        key={mode}
                                                        value={mode}
                                                        className="text-sm font-medium py-2.5 focus:bg-primary/5 focus:text-primary transition-colors cursor-pointer"
                                                    >
                                                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {permissionPolicy && (
                                    <>
                                        <div className="space-y-1.5">
                                            <Label className="typo-overline font-semibold uppercase text-muted-foreground/50 px-0.5 flex items-center justify-center gap-1.5">
                                                <IconBolt className="w-3 h-3 opacity-40 shrink-0" />
                                                <span className="truncate">{t('frontend.workspaceAgent.permissions.shell')}</span>
                                            </Label>
                                            <Select
                                                value={permissionPolicy.commandPolicy}
                                                onValueChange={value => {
                                                    if (isCommandPolicy(value) && _onUpdatePermissionPolicy) {
                                                        _onUpdatePermissionPolicy({ ...permissionPolicy, commandPolicy: value });
                                                    }
                                                }}
                                            >
                                                <SelectTrigger className="w-110 h-9 rounded-xl border-border/10 bg-muted/20 hover:bg-muted/30 hover:border-primary/20 transition-all shadow-sm ring-offset-background focus:ring-1 focus:ring-primary/20">
                                                    <SelectValue className="text-sm" placeholder="Shell" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-2xl border-border/10 shadow-2xl backdrop-blur-xl z-150">
                                                    <SelectItem value="blocked" className="text-sm font-medium py-2.5">{t('frontend.workspaceAgent.permissions.policy.blocked')}</SelectItem>
                                                    <SelectItem value="ask-every-time" className="text-sm font-medium py-2.5">{t('frontend.workspaceAgent.permissions.policy.ask-every-time')}</SelectItem>
                                                    <SelectItem value="allowlist" className="text-sm font-medium py-2.5">{t('frontend.workspaceAgent.permissions.policy.allowlist')}</SelectItem>
                                                    <SelectItem value="full-access" className="text-sm font-medium py-2.5">{t('frontend.workspaceAgent.permissions.policy.full-access')}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1.5 flex flex-col items-center">
                                            <Label className="typo-overline font-semibold uppercase text-muted-foreground/50 px-0.5 flex items-center justify-center gap-1.5">
                                                <IconBrain className="w-3 h-3 opacity-40 shrink-0" />
                                                <span className="truncate">{t('frontend.workspaceAgent.permissions.filesystem')}</span>
                                            </Label>
                                            <Select
                                                value={permissionPolicy.pathPolicy}
                                                onValueChange={value => {
                                                    if (isPathPolicy(value) && _onUpdatePermissionPolicy) {
                                                        _onUpdatePermissionPolicy({ ...permissionPolicy, pathPolicy: value });
                                                    }
                                                }}
                                            >
                                                <SelectTrigger className="w-110 h-9 rounded-xl border-border/10 bg-muted/20 hover:bg-muted/30 hover:border-primary/20 transition-all shadow-sm ring-offset-background focus:ring-1 focus:ring-primary/20">
                                                    <SelectValue className="text-sm" placeholder="Files" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-2xl border-border/10 shadow-2xl backdrop-blur-xl z-150">
                                                    <SelectItem value="workspace-root-only" className="text-sm font-medium py-2.5">{t('frontend.workspaceAgent.permissions.policy.workspace-root-only')}</SelectItem>
                                                    <SelectItem value="allowlist" className="text-sm font-medium py-2.5">{t('frontend.workspaceAgent.permissions.policy.allowlist')}</SelectItem>
                                                    <SelectItem value="restricted-off-dangerous" className="text-sm font-medium py-2.5">{t('frontend.workspaceAgent.permissions.policy.restricted-off-dangerous')}</SelectItem>
                                                    <SelectItem value="full-access" className="text-sm font-medium py-2.5">{t('frontend.workspaceAgent.permissions.policy.full-access')}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>


                {activeTab === 'permissions' && permissionPolicy && _onUpdatePermissionPolicy && (
                    <div className="absolute inset-0 bg-popover rounded-2xl z-20 flex flex-col p-4 animate-in slide-in-from-right-4 duration-300">
                        <button onClick={() => setActiveTab('models')} className="mb-4 text-sm font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                            ← Back to models
                        </button>
                        <div className="overflow-y-auto flex-1">
                            <ModelSelectorPermissionsPanel
                                onUpdatePermissionPolicy={_onUpdatePermissionPolicy}
                                permissionPolicy={permissionPolicy}
                                t={t}
                                updatePermissionPolicy={(key, value) => {
                                    if (key === 'commandPolicy' && isCommandPolicy(value)) {
                                        _onUpdatePermissionPolicy({ ...permissionPolicy, commandPolicy: value });
                                    } else if (key === 'pathPolicy' && isPathPolicy(value)) {
                                        _onUpdatePermissionPolicy({ ...permissionPolicy, pathPolicy: value });
                                    }
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </>,
        document.body
    );
};

ModelSelectorPopover.displayName = 'ModelSelectorPopover';

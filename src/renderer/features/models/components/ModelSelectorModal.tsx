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
import { Brain, Search, Star, Zap } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// import { Button } from '@/components/ui/button';
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

import LogoAntigravity from '../../../assets/antigravity.svg?url';
import LogoChatgpt from '../../../assets/chatgpt.svg?url';
import LogoClaude from '../../../assets/claude.svg?url';
import LogoCopilot from '../../../assets/copilot.svg?url';
import LogoGemini from '../../../assets/gemini.png';
import LogoHuggingFace from '../../../assets/huggingface.svg?url';
import LogoNvidia from '../../../assets/nvidia.svg?url';
import LogoOllama from '../../../assets/ollama.svg?url';
import LogoOpenCode from '../../../assets/opencode.svg?url';
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
    t: (key: string) => string;
}> = ({ activeCategory, activeCopilotQuota, activeClaudeQuota, activeCodexUsage, t }) => {
    const isCopilot = activeCategory.id === 'copilot';
    const isCodex = activeCategory.id === 'codex';
    const isClaude = activeCategory.id === 'claude';

    if (!['antigravity', 'copilot', 'codex', 'claude'].includes(activeCategory.id)) { return null; }

    const items: Array<{ label: string; percent: number; sublabel?: string; value?: string }> = [];

    if (isCopilot && activeCopilotQuota) {
        const limit = activeCopilotQuota.seat_breakdown?.total_seats ?? activeCopilotQuota.limit ?? 0;
        const remaining = activeCopilotQuota.seat_breakdown
            ? (limit - activeCopilotQuota.seat_breakdown.active_seats)
            : activeCopilotQuota.remaining;
        const percent = limit > 0 ? Math.round((remaining / limit) * 100) : 0;

        const isSeatBased = !!activeCopilotQuota.seat_breakdown;
        const labelText = isSeatBased ? t('statistics.seatsStatus') : ''; // Remove label if not seat based

        items.push({
            label: labelText,
            percent,
            value: `${remaining} / ${limit}`
        });
    }

    if (isCodex && activeCodexUsage?.usage) {
        const usage = activeCodexUsage.usage;
        if (typeof usage.dailyUsedPercent === 'number') {
            items.push({
                label: t('statistics.dailyStatus'),
                percent: Math.max(0, Math.min(100, 100 - usage.dailyUsedPercent)),
                sublabel: '24h window'
            });
        }
        if (typeof usage.weeklyUsedPercent === 'number') {
            items.push({
                label: t('statistics.weeklyStatus'),
                percent: Math.max(0, Math.min(100, 100 - usage.weeklyUsedPercent)),
                sublabel: '7d window'
            });
        }
    }

    if (isClaude && activeClaudeQuota?.fiveHour) {
        items.push({
            label: t('statistics.usageStatus'),
            percent: 100 - activeClaudeQuota.fiveHour.utilization,
            sublabel: '5h window'
        });
    }

    if (items.length === 0) { return null; }

    return (
        <div className="mx-2 mb-4 mt-1 px-4 py-2.5 rounded-xl border border-primary/10 bg-primary/[0.02] backdrop-blur-sm shadow-quota-banner">
            <div className="flex items-center gap-3 mb-2">
                <Brain className="w-3 h-3 text-primary/50" />
                <span className="text-9 font-black text-primary/40 uppercase tracking-widest">{t('statistics.quotaStatus')}</span>
            </div>
            <div className="space-y-3">
                {items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-4 group">
                        {(item.label || item.value) && (
                            <div className="flex flex-col min-w-80">
                                {item.label && (
                                    <span className="text-9 font-bold text-muted-foreground/50 uppercase tracking-tight italic leading-none mb-0.5">
                                        {item.label}
                                    </span>
                                )}
                                {item.value && (
                                    <span className="text-10 font-black text-foreground/80 tabular-nums leading-none">
                                        {item.value}
                                    </span>
                                )}
                            </div>
                        )}

                        <div className="flex-1 flex items-center gap-3">
                            <div className="relative flex-1 h-1.5 rounded-full bg-muted/20 overflow-hidden border border-border/5 shadow-inner">
                                <div
                                    className={cn(
                                        "h-full transition-all duration-1000 ease-out relative z-10",
                                        item.percent <= 10 ? 'bg-destructive' : item.percent <= 30 ? 'bg-warning' : 'bg-primary'
                                    )}
                                    style={{ width: `${item.percent}%` }}
                                />
                                <div
                                    className={cn(
                                        "absolute inset-0 opacity-20 blur-2px",
                                        item.percent <= 10 ? 'bg-destructive' : item.percent <= 30 ? 'bg-warning' : 'bg-primary'
                                    )}
                                    style={{ width: `${item.percent}%` }}
                                />
                            </div>

                            <div className={cn(
                                "flex items-baseline gap-1.5 min-w-36 justify-end",
                                item.percent <= 10 ? 'text-destructive' : item.percent <= 30 ? 'text-warning' : 'text-primary'
                            )}>
                                <span className="text-11 font-black tabular-nums italic">
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

interface ModelSelectorModalProps {
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
    thinkingLevel?: ThinkingLevel;
    onThinkingLevelChange?: (modelId: string, level: string) => void;

    copilotQuota?: { accounts: Array<import('@shared/types/quota').CopilotQuota & { accountId?: string; email?: string; isActive?: boolean }> } | null;
    activeCopilotAccountId?: string | null;
    activeCopilotAccountEmail?: string | null;
    activeCopilotQuota?: (import('@shared/types/quota').CopilotQuota & { accountId?: string; email?: string; isActive?: boolean }) | null;
    activeClaudeQuota?: import('@shared/types/quota').ClaudeQuota | null;
    activeCodexUsage?: ({ usage: import('@shared/types/quota').CodexUsage; accountId?: string; email?: string } & { isActive?: boolean }) | null;
    activeAntigravityQuota?: import('@shared/types/quota').QuotaResponse | null;
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
                    {t('workspaceAgent.permissions.commands')}
                </label>
                <Select
                    value={permissionPolicy.commandPolicy}
                    onValueChange={value => updatePermissionPolicy('commandPolicy', value)}
                >
                    <SelectTrigger className="w-full rounded-xl border border-border/50 bg-muted/30 p-2.5 text-sm text-foreground/90 transition-colors focus:ring-1 focus:ring-primary/50">
                        <SelectValue placeholder={t('workspaceAgent.permissions.policy.blocked')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="blocked">{t('workspaceAgent.permissions.policy.blocked')}</SelectItem>
                        <SelectItem value="ask-every-time">{t('workspaceAgent.permissions.policy.ask-every-time')}</SelectItem>
                        <SelectItem value="allowlist">{t('workspaceAgent.permissions.policy.allowlist')}</SelectItem>
                        <SelectItem value="full-access">{t('workspaceAgent.permissions.policy.full-access')}</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground/90">
                    {t('workspaceAgent.permissions.files')}
                </label>
                <Select
                    value={permissionPolicy.pathPolicy}
                    onValueChange={value => updatePermissionPolicy('pathPolicy', value)}
                >
                    <SelectTrigger className="w-full rounded-xl border border-border/50 bg-muted/30 p-2.5 text-sm text-foreground/90 transition-colors focus:ring-1 focus:ring-primary/50">
                        <SelectValue placeholder={t('workspaceAgent.permissions.policy.workspace-root-only')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="workspace-root-only">{t('workspaceAgent.permissions.policy.workspace-root-only')}</SelectItem>
                        <SelectItem value="allowlist">{t('workspaceAgent.permissions.policy.allowlist')}</SelectItem>
                        <SelectItem value="restricted-off-dangerous">{t('workspaceAgent.permissions.policy.restricted-off-dangerous')}</SelectItem>
                        <SelectItem value="full-access">{t('workspaceAgent.permissions.policy.full-access')}</SelectItem>
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



export const ModelSelectorModal: React.FC<ModelSelectorModalProps> = ({
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
    thinkingLevel = 'low',
    onThinkingLevelChange,

    activeCopilotQuota,
    activeClaudeQuota,
    activeCodexUsage,
    activeAntigravityQuota,
    permissionPolicy,
    onUpdatePermissionPolicy: _onUpdatePermissionPolicy,
    triggerRef
}) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [activeProviderId, setActiveProviderId] = useState<string>('favorites');
    const [activeTab, setActiveTab] = useState<'models' | 'permissions'>(initialTab === 'permissions' ? 'permissions' : 'models');
    const [modalPosition, setModalPosition] = useState<React.CSSProperties>({ visibility: 'hidden' });
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
        if (!isOpen || !triggerRef?.current || !modalRef.current) {
            return;
        }

        const updatePosition = () => {
            const trigger = triggerRef.current;
            const modal = modalRef.current;
            if (!trigger || !modal) {
                return;
            }

            const triggerRect = trigger.getBoundingClientRect();
            const modalRect = modal.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let top = triggerRect.bottom + 8;
            let left = triggerRect.left;

            if (top + modalRect.height > viewportHeight - VIEWPORT_PADDING) {
                top = triggerRect.top - modalRect.height - 8;
            }

            if (left + modalRect.width > viewportWidth - VIEWPORT_PADDING) {
                left = viewportWidth - modalRect.width - VIEWPORT_PADDING;
            }

            if (left < VIEWPORT_PADDING) {
                left = VIEWPORT_PADDING;
            }

            setModalPosition({
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

    const handleSelect = useCallback((provider: string, id: string, isMulti: boolean, explicitThinkingLevel?: string) => {
        if (isMulti) {
            onSelect(provider, id, isMulti, true);
            return;
        }

        if (explicitThinkingLevel) {
            onThinkingLevelChange?.(id, explicitThinkingLevel);
            
            const isAlreadySelected = selectedModels.some(m => m.model === id && m.provider === provider);
            if (!isAlreadySelected) {
                onSelect(provider, id, isMulti, false);
                handleClose();
            }
            return;
        }

        onSelect(provider, id, isMulti, false);
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
                ref={modalRef}
                style={modalPosition}
                className={cn(
                    'fixed z-100 w-450 h-580 flex flex-col',
                    'bg-popover/98 backdrop-blur-2xl rounded-2xl shadow-modal-heavy border border-border/40',
                    'animate-in fade-in-0 zoom-in-95 duration-200 ease-out origin-top'
                )}
            >
                <div className="flex flex-col h-full overflow-hidden bg-background border rounded-2xl">
                    {/* Search Bar - Shadcn Input Style */}
                    <div className="p-3 border-b border-border/40">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                            <Input
                                ref={searchInputRef}
                                placeholder={t('modelSelector.searchPlaceholder')}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="bg-muted/30 pl-9 border-none h-9 text-xs focus-visible:ring-1 focus-visible:ring-primary/30"
                            />
                        </div>
                    </div>

                    {/* Provider Tabs - Real Logos, Horizontal only, Theme Supportive */}
                    <div className="px-2 border-b border-border/40 flex items-center gap-2 overflow-x-auto overflow-y-hidden no-scrollbar bg-muted/10 h-60 shrink-0 whitespace-nowrap">
                        {filteredCategories.map(cat => {
                            const isActive = activeProviderId === cat.id;

                            const logoMap: Record<string, string> = {
                                openai: LogoChatgpt,
                                anthropic: LogoClaude,
                                claude: LogoClaude,
                                google: LogoGemini,
                                gemini: LogoGemini,
                                antigravity: LogoAntigravity,
                                copilot: LogoCopilot,
                                ollama: LogoOllama,
                                codex: LogoChatgpt,
                                opencode: LogoOpenCode,
                                huggingface: LogoHuggingFace,
                                nvidia: LogoNvidia,
                            };

                            const logoAsset = logoMap[cat.id.toLowerCase()];
                            const Icon = cat.id === 'favorites' ? Star : (cat.icon || Zap);

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
                                        'flex items-center justify-center transition-all duration-300',
                                        isActive ? 'scale-110' : 'scale-95'
                                    )}>
                                        {logoAsset ? (
                                            (() => {
                                                const providerId = cat.id.toLowerCase();
                                                const isBrandColored = ['gemini', 'huggingface', 'nvidia', 'antigravity'].includes(providerId);

                                                return (
                                                    <img
                                                        src={logoAsset}
                                                        alt={cat.name}
                                                        className={cn(
                                                            'w-6 h-6 object-contain transition-all duration-300',
                                                            !isBrandColored && 'theme-logo-invert'
                                                        )}
                                                    />
                                                );
                                            })()
                                        ) : (
                                            <Icon className={cn(
                                                'w-5 h-5 transition-all duration-300',
                                                isActive
                                                    ? (cat.id === 'favorites' ? 'text-amber-400 fill-amber-400' : (cat.color || 'text-primary'))
                                                    : 'text-muted-foreground/30'
                                            )} />
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
                                <div className="text-muted-foreground/30 text-xs font-semibold uppercase tracking-widest">
                                    {searchQuery ? 'No models match your search' : `No models available for ${activeCategory?.name || 'this provider'}`}
                                </div>
                                {!searchQuery && (
                                    <p className="text-10 text-muted-foreground/40 leading-relaxed max-w-200 mx-auto">
                                        This might be because the account is not linked or the models are still loading.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                    {/* Advanced Logic & Safety Configuration Footer */}
                    <div className="px-4 py-4 border-t border-border/20 bg-background/95 backdrop-blur-xl shrink-0">
                        <div className="flex items-center justify-center gap-6">
                            {/* Mode Selection */}
                            <div className="space-y-1.5 flex flex-col items-center">
                                <Label className="text-10 font-semibold uppercase tracking-50 text-muted-foreground/50 px-0.5">
                                    {t('workspaceAgent.permissions.mode')}
                                </Label>
                                <Select
                                    value={chatMode}
                                    onValueChange={(value) => onChatModeChange?.(value as SelectorChatMode)}
                                >
                                    <SelectTrigger className="w-110 h-9 rounded-xl border-border/10 bg-muted/20 hover:bg-muted/30 hover:border-primary/20 transition-all shadow-sm ring-offset-background focus:ring-1 focus:ring-primary/20">
                                        <SelectValue className="text-xs" placeholder="Mode" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-border/10 shadow-2xl backdrop-blur-xl z-150">
                                        {(['instant', 'thinking', 'agent'] as SelectorChatMode[]).map(mode => (
                                            <SelectItem
                                                key={mode}
                                                value={mode}
                                                className="text-xs font-medium py-2.5 focus:bg-primary/5 focus:text-primary transition-colors cursor-pointer"
                                            >
                                                {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {permissionPolicy && (
                                <>
                                    {/* Shell Protection */}
                                    <div className="space-y-1.5">
                                        <Label className="text-10 font-semibold uppercase tracking-50 text-muted-foreground/50 px-0.5 flex items-center justify-center gap-1.5">
                                            <Zap className="w-3 h-3 opacity-40 shrink-0" />
                                            <span className="truncate">{t('workspaceAgent.permissions.shell')}</span>
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
                                                <SelectValue className="text-xs" placeholder="Shell" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-2xl border-border/10 shadow-2xl backdrop-blur-xl z-150">
                                                <SelectItem value="blocked" className="text-xs font-medium py-2.5">{t('workspaceAgent.permissions.policy.blocked')}</SelectItem>
                                                <SelectItem value="ask-every-time" className="text-xs font-medium py-2.5">{t('workspaceAgent.permissions.policy.ask-every-time')}</SelectItem>
                                                <SelectItem value="allowlist" className="text-xs font-medium py-2.5">{t('workspaceAgent.permissions.policy.allowlist')}</SelectItem>
                                                <SelectItem value="full-access" className="text-xs font-medium py-2.5">{t('workspaceAgent.permissions.policy.full-access')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Filesystem Protection */}
                                    <div className="space-y-1.5 flex flex-col items-center">
                                        <Label className="text-10 font-semibold uppercase tracking-50 text-muted-foreground/50 px-0.5 flex items-center justify-center gap-1.5">
                                            <Brain className="w-3 h-3 opacity-40 shrink-0" />
                                            <span className="truncate">{t('workspaceAgent.permissions.filesystem')}</span>
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
                                                <SelectValue className="text-xs" placeholder="Files" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-2xl border-border/10 shadow-2xl backdrop-blur-xl z-150">
                                                <SelectItem value="workspace-root-only" className="text-xs font-medium py-2.5">{t('workspaceAgent.permissions.policy.workspace-root-only')}</SelectItem>
                                                <SelectItem value="allowlist" className="text-xs font-medium py-2.5">{t('workspaceAgent.permissions.policy.allowlist')}</SelectItem>
                                                <SelectItem value="restricted-off-dangerous" className="text-xs font-medium py-2.5">{t('workspaceAgent.permissions.policy.restricted-off-dangerous')}</SelectItem>
                                                <SelectItem value="full-access" className="text-xs font-medium py-2.5">{t('workspaceAgent.permissions.policy.full-access')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>


                {activeTab === 'permissions' && permissionPolicy && _onUpdatePermissionPolicy && (
                    <div className="absolute inset-0 bg-popover rounded-2xl z-20 flex flex-col p-4 animate-in slide-in-from-right-4 duration-300">
                        <button onClick={() => setActiveTab('models')} className="mb-4 text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
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

ModelSelectorModal.displayName = 'ModelSelectorModal';

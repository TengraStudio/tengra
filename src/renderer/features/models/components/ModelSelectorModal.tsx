import type {
    WorkspaceAgentCommandPolicy,
    WorkspaceAgentPathPolicy,
} from '@shared/types/workspace-agent-session';
import { Brain } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { WorkspaceAgentPermissionEditor } from '@/features/workspace/workspace-agent/WorkspaceAgentPermissionEditor';
import { cn } from '@/lib/utils';

import { ModelCategory, ModelListItem } from '../types';

import {
    ModelSelectorCategoryList,
    ModelSelectorHeader,
    ModelSelectorModeTabs,
    ModelSelectorSearch,
    SelectorChatMode,
} from './model-selector/ModelSelectorSections';

/** Minimum padding from viewport edges in pixels */
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
type ModelFilter = 'local' | 'cloud' | 'free' | 'reasoning' | 'deprecated';
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

interface ModelSelectorModalProps {
    isOpen: boolean;
    initialTab?: 'models' | 'reasoning' | 'permissions';
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
    thinkingLevel?: string;
    onThinkingLevelChange?: (modelId: string, level: string) => void;
    onConfirmSelection?: () => void;
    copilotQuota?: { accounts: Array<import('@shared/types/quota').CopilotQuota & { accountId?: string; email?: string; isActive?: boolean }> } | null;
    activeCopilotAccountId?: string | null;
    activeCopilotAccountEmail?: string | null;
    activeClaudeQuota?: import('@shared/types/quota').ClaudeQuota | null;
    activeCodexUsage?: ({ usage: import('@shared/types/quota').CodexUsage; accountId?: string; email?: string } & { isActive?: boolean }) | null;
    activeAntigravityQuota?: import('@shared/types/quota').QuotaResponse | null;
    permissionPolicy?: import('@shared/types/workspace-agent-session').WorkspaceAgentPermissionPolicy;
    onUpdatePermissionPolicy?: (policy: import('@shared/types/workspace-agent-session').WorkspaceAgentPermissionPolicy) => void;
}

const THINKING_LEVEL_LABEL_KEYS: Record<ThinkingLevel, string> = {
    none: 'modelSelector.reasoningLevels.none',
    minimal: 'modelSelector.reasoningLevels.minimal',
    low: 'modelSelector.reasoningLevels.low',
    medium: 'modelSelector.reasoningLevels.medium',
    high: 'modelSelector.reasoningLevels.high',
    xhigh: 'modelSelector.reasoningLevels.max',
};

const MODEL_FILTER_OPTIONS: ReadonlyArray<readonly [ModelFilter, string]> = [
    ['local', 'modelSelector.local'],
    ['cloud', 'modelSelector.cloud'],
    ['free', 'modelSelector.free'],
    ['reasoning', 'modelSelector.reasoning'],
    ['deprecated', 'modelSelector.deprecated']
];

interface ModelSelectorReasoningPanelProps {
    canConfirm: boolean;
    categories: ModelCategory[];
    currentModelInfo: ModelListItem | null;
    currentModelThinkingLevels: string[] | null;
    handleCancelPending: () => void;
    handleConfirmSelection: () => void;
    handlePendingThinkingLevelChange: (level: string) => void;
    onThinkingLevelChange?: (modelId: string, level: string) => void;
    pendingModel: { provider: string; id: string } | null;
    pendingModelThinkingLevels: string[] | null;
    pendingThinkingLevel: string | null;
    selectedModel: string;
    t: (key: string) => string;
    thinkingLevel: string;
}

const ModelSelectorReasoningPanel: React.FC<ModelSelectorReasoningPanelProps> = ({
    canConfirm,
    categories,
    currentModelInfo,
    currentModelThinkingLevels,
    handleCancelPending,
    handleConfirmSelection,
    handlePendingThinkingLevelChange,
    onThinkingLevelChange,
    pendingModel,
    pendingModelThinkingLevels,
    pendingThinkingLevel,
    selectedModel,
    t,
    thinkingLevel,
}) => {
    if (pendingModel && pendingModelThinkingLevels && pendingModelThinkingLevels.length > 0) {
        return (
            <div className="p-4">
                <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <div className="mb-1 flex items-center gap-2">
                        <Brain className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-foreground">
                            {t('modelSelector.selectReasoningLevel')}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {t('modelSelector.reasoningRequired')}
                    </p>
                </div>
                <div className="mb-3 text-xs font-medium text-muted-foreground">
                    {categories
                        .flatMap(category => (Array.isArray(category.models) ? category.models : []))
                        .find(model => model.id === pendingModel.id)?.label ?? pendingModel.id}
                </div>
                <div className="mb-4 flex flex-wrap gap-2">
                    {pendingModelThinkingLevels.map(level => {
                        const isActive = pendingThinkingLevel === level;
                        return (
                            <button
                                key={level}
                                onClick={() => handlePendingThinkingLevelChange(level)}
                                className={cn(
                                    'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                                    isActive
                                        ? 'border-primary bg-primary text-primary-foreground shadow-none'
                                        : 'border-border/50 text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground'
                                )}
                            >
                                {t(THINKING_LEVEL_LABEL_KEYS[level as ThinkingLevel] ?? '') || level}
                            </button>
                        );
                    })}
                </div>
                <div className="flex items-center gap-2 border-t border-border/50 pt-3">
                    <button
                        onClick={handleCancelPending}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={handleConfirmSelection}
                        disabled={!canConfirm}
                        className={cn(
                            'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                            canConfirm
                                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                : 'cursor-not-allowed bg-muted text-muted-foreground'
                        )}
                    >
                        {canConfirm
                            ? t('modelSelector.confirmModel')
                            : t('modelSelector.selectLevelFirst')}
                    </button>
                </div>
            </div>
        );
    }

    if (!currentModelThinkingLevels || currentModelThinkingLevels.length === 0) {
        return null;
    }

    return (
        <div className="p-6">
            <div className="mb-3 text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider flex items-center gap-2">
                <Brain className="w-3.5 h-3.5" />
                {t('modelSelector.reasoning')} {'•'} {currentModelInfo?.label ?? selectedModel}
            </div>
            <div className="flex flex-wrap gap-2.5">
                {currentModelThinkingLevels.map(level => {
                    const isActive = thinkingLevel === level;
                    return (
                        <button
                            key={level}
                            onClick={() =>
                                onThinkingLevelChange?.(currentModelInfo?.id ?? selectedModel, level)
                            }
                            className={cn(
                                'rounded-xl border px-4 py-2 text-xs font-bold transition-all duration-200',
                                isActive
                                    ? 'bg-primary/10 text-primary border-primary/40 shadow-sm scale-105'
                                    : 'border-border/40 text-muted-foreground/70 hover:bg-muted/50 hover:text-foreground'
                            )}
                        >
                            {t(THINKING_LEVEL_LABEL_KEYS[level as ThinkingLevel] ?? '') || level}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

interface ModelSelectorPermissionsPanelProps {
    onUpdatePermissionPolicy: (policy: import('@shared/types/workspace-agent-session').WorkspaceAgentPermissionPolicy) => void;
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

        <WorkspaceAgentPermissionEditor
            permissionPolicy={permissionPolicy}
            onUpdatePermissions={onUpdatePermissionPolicy}
            t={t}
        />
    </div>
);

function resolvePreferredThinkingLevel(levels: string[], currentLevel?: string): string | null {
    if (levels.length === 0) {
        return null;
    }
    if (currentLevel && levels.includes(currentLevel)) {
        return currentLevel;
    }
    if (levels.includes('low')) {
        return 'low';
    }
    return levels[0] ?? null;
}

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
    recentModels = [],
    t,
    chatMode = 'instant',
    onChatModeChange,
    thinkingLevel = 'low',
    onThinkingLevelChange,
    onConfirmSelection,
    copilotQuota,
    activeCopilotAccountId,
    activeCopilotAccountEmail,
    activeClaudeQuota,
    activeCodexUsage,
    activeAntigravityQuota,
    permissionPolicy,
    onUpdatePermissionPolicy: _onUpdatePermissionPolicy,
}) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilters, setActiveFilters] = useState<ModelFilter[]>([]);
    const [internalChatMode, setInternalChatMode] = useState<SelectorChatMode>(chatMode);
    const [activeTab, setActiveTab] = useState<'models' | 'reasoning' | 'permissions'>(initialTab || 'models');
    const [pendingModel, setPendingModel] = useState<{ provider: string; id: string } | null>(null);

    useEffect(() => {
        if (isOpen && initialTab) {
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);
    const [modalStyle, setModalStyle] = useState<React.CSSProperties>({});

    // Calculate modal position to ensure it stays within viewport
    useEffect(() => {
        if (!isOpen || !modalRef.current) {
            return;
        }

        const updatePosition = () => {
            const modal = modalRef.current;
            if (!modal) {
                return;
            }

            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const modalRect = modal.getBoundingClientRect();

            const style: React.CSSProperties = {};

            // Check if modal is too wide for viewport
            if (modalRect.width > viewportWidth - 2 * VIEWPORT_PADDING) {
                style.width = `${viewportWidth - 2 * VIEWPORT_PADDING}px`;
                style.maxWidth = `${viewportWidth - 2 * VIEWPORT_PADDING}px`;
            }

            // Check if modal is too tall for viewport
            if (modalRect.height > viewportHeight - 2 * VIEWPORT_PADDING) {
                style.maxHeight = `${viewportHeight - 2 * VIEWPORT_PADDING}px`;
            }

            setModalStyle(style);
        };

        // Run after modal has rendered
        const timer = setTimeout(updatePosition, 0);
        window.addEventListener('resize', updatePosition);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updatePosition);
        };
    }, [isOpen]);
    const [pendingThinkingLevel, setPendingThinkingLevel] = useState<string | null>(null);

    useEffect(() => {
        setInternalChatMode(chatMode);
    }, [chatMode]);

    // Check if pending model requires reasoning level selection
    const pendingModelThinkingLevels = useMemo(() => {
        if (!pendingModel) {
            return null;
        }
        for (const cat of categories) {
            if (!Array.isArray(cat.models)) { continue; }
            const found = cat.models.find(
                m => m.id === pendingModel.id && m.provider === pendingModel.provider
            );
            if (found?.thinkingLevels && Array.isArray(found.thinkingLevels) && found.thinkingLevels.length > 0) {
                return found.thinkingLevels;
            }
        }
        return null;
    }, [categories, pendingModel]);

    const requiresReasoningSelection =
        pendingModel !== null &&
        pendingModelThinkingLevels !== null &&
        pendingModelThinkingLevels.length > 0;
    const canConfirm = !requiresReasoningSelection || pendingThinkingLevel !== null;

    const handleClose = useCallback(() => {
        if (searchQuery) {
            setSearchQuery('');
        }
        setActiveTab('models');
        setPendingModel(null);
        setPendingThinkingLevel(null);
        onClose();
    }, [onClose, searchQuery]);

    const handleCancelPending = useCallback(() => {
        setPendingModel(null);
        setPendingThinkingLevel(null);
        setActiveTab('models');
    }, []);

    // ESC key handler
    useEffect(() => {
        if (!isOpen) {
            return;
        }
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (requiresReasoningSelection && !canConfirm) {
                    handleCancelPending();
                    return;
                }
                handleClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [handleClose, handleCancelPending, isOpen, requiresReasoningSelection, canConfirm]);

    // Body scroll lock
    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : '';
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Auto focus search input
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // Get favorite models from categories
    const favoriteModels = useMemo(() => {
        const favCat = categories.find(c => c.id === 'favorites');
        return favCat?.models ?? [];
    }, [categories]);

    // Get recent models from all categories
    const recentModelItems = useMemo(() => {
        if (recentModels.length === 0) {
            return [];
        }
        const items: ModelListItem[] = [];
        for (const recentId of recentModels.slice(0, 5)) {
            for (const cat of categories) {
                const found = cat.models.find(m => m.id === recentId);
                if (found && !items.some(i => i.id === found.id)) {
                    items.push(found);
                    break;
                }
            }
        }
        return items;
    }, [categories, recentModels]);

    // Get current model's thinking levels
    const currentModelThinkingLevels = useMemo(() => {
        for (const cat of categories) {
            if (!Array.isArray(cat.models)) { continue; }
            const found = cat.models.find(m =>
                m.id === selectedModel && (selectedProvider === '' || m.provider === selectedProvider)
            );
            if (found?.thinkingLevels) {
                return found.thinkingLevels;
            }
        }
        return null;
    }, [categories, selectedModel, selectedProvider]);

    const currentModelInfo = useMemo(() => {
        for (const cat of categories) {
            if (!Array.isArray(cat.models)) { continue; }
            const found = cat.models.find(m =>
                m.id === selectedModel && (selectedProvider === '' || m.provider === selectedProvider)
            );
            if (found) {
                return found;
            }
        }
        return null;
    }, [categories, selectedModel, selectedProvider]);

    useEffect(() => {
        let timer: NodeJS.Timeout | undefined;
        if (
            activeTab === 'reasoning' &&
            (!pendingModelThinkingLevels || pendingModelThinkingLevels.length === 0) &&
            (!currentModelThinkingLevels || currentModelThinkingLevels.length === 0)
        ) {
            // Use setTimeout to avoid synchronous setState in effect body
            timer = setTimeout(() => setActiveTab('models'), 0);
        }
        return () => {
            if (timer) {
                clearTimeout(timer);
            }
        };
    }, [activeTab, currentModelThinkingLevels, pendingModelThinkingLevels]);

    const getThinkingLevels = useCallback(
        (provider: string, id: string) => {
            for (const cat of categories) {
                const found = cat.models.find(m => m.id === id && m.provider === provider);
                if (found?.thinkingLevels && found.thinkingLevels.length > 0) {
                    return found.thinkingLevels;
                }
            }
            return [];
        },
        [categories]
    );

    // Filter categories based on search
    const filteredCategories = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        const applyFilters = (model: ModelListItem) => {
            if (activeFilters.includes('local') && !model.isLocal) { return false; }
            if (activeFilters.includes('cloud') && model.isLocal) { return false; }
            if (activeFilters.includes('free') && !model.isFree) { return false; }
            if (activeFilters.includes('reasoning') && !model.supportsReasoning) { return false; }
            if (!activeFilters.includes('deprecated') && (model.lifecycle === 'deprecated' || model.lifecycle === 'retired')) { return false; }
            return true;
        };
        return categories
            .filter(c => c.id !== 'favorites')
            .map(cat => ({
                ...cat,
                models: Array.isArray(cat.models)
                    ? cat.models.filter(m =>
                        (query === '' || m.label.toLowerCase().includes(query) || m.id.toLowerCase().includes(query)) &&
                        applyFilters(m)
                    )
                    : [],
            }))
            .filter(cat => cat.models.length > 0);
    }, [categories, searchQuery, activeFilters]);

    const handleSelect = useCallback(
        (provider: string, id: string, isMulti: boolean) => {
            if (isMulti) {
                onSelect(provider, id, isMulti, true);
                return;
            }

            const thinkingLevels = getThinkingLevels(provider, id);
            if (thinkingLevels.length > 0) {
                setPendingModel({ provider, id });
                setPendingThinkingLevel(resolvePreferredThinkingLevel(thinkingLevels));
                setActiveTab('reasoning');
                return;
            }

            onSelect(provider, id, isMulti, false);
            handleClose();
        },
        [getThinkingLevels, handleClose, onSelect]
    );

    const handlePendingThinkingLevelChange = useCallback(
        (level: string) => {
            setPendingThinkingLevel(level);
            if (pendingModel) {
                onThinkingLevelChange?.(pendingModel.id, level);
            }
        },
        [onThinkingLevelChange, pendingModel]
    );

    const handleConfirmSelection = useCallback(() => {
        if (!pendingModel || !canConfirm) {
            return;
        }
        if (pendingThinkingLevel) {
            onThinkingLevelChange?.(pendingModel.id, pendingThinkingLevel);
        }
        onSelect(pendingModel.provider, pendingModel.id, false, false);
        onConfirmSelection?.();
        handleClose();
    }, [pendingModel, canConfirm, pendingThinkingLevel, onThinkingLevelChange, onSelect, onConfirmSelection, handleClose]);

    const handleBackdropClick = useCallback(
        (e: React.MouseEvent) => {
            if (e.target === e.currentTarget) {
                if (requiresReasoningSelection && !canConfirm) {
                    return;
                }
                handleClose();
            }
        },
        [handleClose, requiresReasoningSelection, canConfirm]
    );

    const updatePermissionPolicy = useCallback(
        (
            key: 'commandPolicy' | 'pathPolicy',
            value: string
        ) => {
            if (!permissionPolicy || !_onUpdatePermissionPolicy) {
                return;
            }

            if (key === 'commandPolicy') {
                if (!isCommandPolicy(value)) {
                    return;
                }
                _onUpdatePermissionPolicy({ ...permissionPolicy, commandPolicy: value });
                return;
            }

            if (!isPathPolicy(value)) {
                return;
            }
            _onUpdatePermissionPolicy({ ...permissionPolicy, pathPolicy: value });
        },
        [_onUpdatePermissionPolicy, permissionPolicy]
    );

    if (!isOpen) {
        return null;
    }

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="model-selector-title"
            onClick={handleBackdropClick}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-background/85 backdrop-blur-sm animate-in fade-in-0 duration-200"
                aria-hidden="true"
            />

            {/* Modal */}
            <div
                ref={modalRef}
                style={modalStyle}
                className={cn(
                    'relative w-full max-w-3xl max-h-[85vh] flex flex-col',
                    'bg-popover/95 backdrop-blur-[20px] rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)]',
                    'border border-border/40',
                    'animate-in fade-in-0 zoom-in-95 duration-300 ease-out'
                )}
                onClick={e => e.stopPropagation()}
            >
                <ModelSelectorHeader
                    title={t('modelSelector.selectModel')}
                    closeLabel={t('common.close')}
                    onClose={handleClose}
                />

                <ModelSelectorModeTabs
                    modeLabel={t('modelSelector.mode')}
                    chatMode={internalChatMode}
                    onChatModeChange={(mode) => {
                        setInternalChatMode(mode);
                        onChatModeChange?.(mode);
                    }}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    t={t}
                    showReasoningTab={
                        !!pendingModelThinkingLevels?.length ||
                        (!!currentModelThinkingLevels && currentModelThinkingLevels.length > 0)
                    }
                    showPermissionsTab={!!permissionPolicy}
                />

                {activeTab === 'models' && (
                    <>
                        <ModelSelectorSearch
                            searchQuery={searchQuery}
                            onSearchQueryChange={setSearchQuery}
                            searchInputRef={searchInputRef}
                            placeholder={t('modelSelector.searchModels')}
                        />
                        <div className="px-5 pb-3 flex flex-wrap gap-2 border-b border-border/40 bg-muted/5">
                            {MODEL_FILTER_OPTIONS.map(([key, labelKey]) => {
                                const active = activeFilters.includes(key);
                                return (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            setActiveFilters(prev =>
                                                prev.includes(key)
                                                    ? prev.filter(f => f !== key)
                                                    : [...prev, key]
                                            );
                                        }}
                                        className={cn(
                                            'px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all duration-200',
                                            active
                                                ? 'bg-primary/20 text-primary border-primary/30 shadow-sm scale-105'
                                                : 'bg-background/40 text-muted-foreground/60 border-border/40 hover:text-foreground hover:bg-background/60 shadow-sm'
                                        )}
                                    >
                                        {t(labelKey)}
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* Pending Model Reasoning Selection */}
                    {activeTab === 'reasoning' && (
                        <ModelSelectorReasoningPanel
                            canConfirm={canConfirm}
                            categories={categories}
                            currentModelInfo={currentModelInfo}
                            currentModelThinkingLevels={currentModelThinkingLevels}
                            handleCancelPending={handleCancelPending}
                            handleConfirmSelection={handleConfirmSelection}
                            handlePendingThinkingLevelChange={
                                handlePendingThinkingLevelChange
                            }
                            onThinkingLevelChange={onThinkingLevelChange}
                            pendingModel={pendingModel}
                            pendingModelThinkingLevels={pendingModelThinkingLevels}
                            pendingThinkingLevel={pendingThinkingLevel}
                            selectedModel={selectedModel}
                            t={t}
                            thinkingLevel={thinkingLevel}
                        />
                    )}

                    {activeTab === 'permissions' && permissionPolicy && _onUpdatePermissionPolicy && (
                        <ModelSelectorPermissionsPanel
                            onUpdatePermissionPolicy={_onUpdatePermissionPolicy}
                            permissionPolicy={permissionPolicy}
                            t={t}
                            updatePermissionPolicy={updatePermissionPolicy}
                        />
                    )}

                    {activeTab === 'models' ? (
                        <ModelSelectorCategoryList
                            filteredCategories={filteredCategories}
                            favoriteModels={favoriteModels}
                            recentModelItems={recentModelItems}
                            searchQuery={searchQuery}
                            selectedModels={selectedModels}
                            selectedModel={selectedModel}
                            selectedProvider={selectedProvider}
                            chatMode={internalChatMode}
                            onSelect={handleSelect}
                            toggleFavorite={toggleFavorite}
                            copilotQuota={copilotQuota}
                            activeCopilotAccountId={activeCopilotAccountId}
                            activeCopilotAccountEmail={activeCopilotAccountEmail}
                            activeClaudeQuota={activeClaudeQuota}
                            activeCodexUsage={activeCodexUsage}
                            activeAntigravityQuota={activeAntigravityQuota}
                            t={t}
                        />
                    ) : null}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-border/50 bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
                    {requiresReasoningSelection && !canConfirm ? (
                        <span className="text-warning">
                            {t('modelSelector.mustSelectReasoning')}
                        </span>
                    ) : (
                        <span>{t('modelSelector.shiftClickMulti')}</span>
                    )}
                    <span className="text-muted-foreground/50">
                        {t('common.escKey')} {requiresReasoningSelection ? t('common.cancel') : t('common.toClose')}
                    </span>
                </div>
            </div>
        </div>,
        document.body
    );
};

ModelSelectorModal.displayName = 'ModelSelectorModal';

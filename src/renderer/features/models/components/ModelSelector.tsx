/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useDebounce } from '@/hooks/useDebounce';
import type { Language } from '@/i18n';
import { useTranslation } from '@/i18n';
import type { GroupedModels } from '@/types';
import { AppSettings, ClaudeQuota, CodexUsage, CopilotQuota, QuotaResponse } from '@/types';

import { useModelCategories } from '../hooks/useModelCategories';
import { useModelSelectorLogic } from '../hooks/useModelSelectorLogic';

import { ModelSelectorModal } from './ModelSelectorModal';
import { ModelSelectorTrigger } from './ModelSelectorTrigger';

interface ModelSelectorProps {
    selectedProvider: string;
    selectedModel: string;
    selectedModels?: Array<{ provider: string; model: string }>;
    onSelect: (provider: string, model: string, isMultiSelect?: boolean) => void;
    settings?: AppSettings;
    groupedModels?: GroupedModels;
    quotas?: { accounts: QuotaResponse[] } | null;
    codexUsage?: { accounts: { usage: CodexUsage }[] } | null;
    claudeQuota?: { accounts: ClaudeQuota[] } | null;
    copilotQuota?: { accounts: Array<CopilotQuota & { accountId?: string; email?: string; isActive?: boolean }> } | null;
    onOpenChange?: (isOpen: boolean) => void;
    contextTokens?: number;
    language?: Language;
    onRemoveModel?: (provider: string, model: string) => void;
    isFavorite?: (modelId: string) => boolean;
    toggleFavorite?: (modelId: string) => void;
    isIconOnly?: boolean;
    thinkingLevel?: string;
    onThinkingLevelChange?: (modelId: string, level: string) => void;
    chatMode?: 'instant' | 'thinking' | 'agent';
    onChatModeChange?: (mode: 'instant' | 'thinking' | 'agent') => void;
    permissionPolicy?: import('@shared/types/workspace-agent-session').WorkspaceAgentPermissionPolicy;
    onUpdatePermissionPolicy?: (policy: import('@shared/types/workspace-agent-session').WorkspaceAgentPermissionPolicy) => void;
}

export const ModelSelector = memo(({
    selectedProvider,
    selectedModel,
    selectedModels = [],
    onSelect,
    settings,
    groupedModels,
    quotas = null,
    codexUsage = null,
    claudeQuota = null,
    copilotQuota = null,
    onOpenChange,
    contextTokens = 0,
    language = 'en',
    onRemoveModel,
    isFavorite,
    toggleFavorite,
    isIconOnly,
    thinkingLevel,
    onThinkingLevelChange,
    chatMode = 'instant',
    onChatModeChange,
    permissionPolicy,
    onUpdatePermissionPolicy
}: ModelSelectorProps) => {
    const { t } = useTranslation(language);
    const [isOpen, setIsOpen] = useState(false);
    const [initialTab, setInitialTab] = useState<'models' | 'reasoning' | 'permissions'>('models');
    const [activeCopilotAccountId, setActiveCopilotAccountId] = useState<string | null>(null);
    const [activeCopilotAccountEmail, setActiveCopilotAccountEmail] = useState<string | null>(null);
    const [resolvedCopilotQuota, setResolvedCopilotQuota] = useState(copilotQuota);
    const [resolvedClaudeQuota, setResolvedClaudeQuota] = useState(claudeQuota);
    const [resolvedCodexUsage, setResolvedCodexUsage] = useState(codexUsage);
    const [resolvedAntigravityQuota, setResolvedAntigravityQuota] = useState(quotas);
    const [activeClaudeAccountId, setActiveClaudeAccountId] = useState<string | null>(null);
    const [activeClaudeAccountEmail, setActiveClaudeAccountEmail] = useState<string | null>(null);
    const [activeCodexAccountId, setActiveCodexAccountId] = useState<string | null>(null);
    const [activeCodexAccountEmail, setActiveCodexAccountEmail] = useState<string | null>(null);
    const [activeAntigravityAccountId, setActiveAntigravityAccountId] = useState<string | null>(null);
    const [activeAntigravityAccountEmail, setActiveAntigravityAccountEmail] = useState<string | null>(null);
    const [searchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 300);
    const onOpenChangeRef = useRef(onOpenChange);
    const lastReportedOpenStateRef = useRef(isOpen);

    useEffect(() => {
        onOpenChangeRef.current = onOpenChange;
    }, [onOpenChange]);

    useEffect(() => {
        if (lastReportedOpenStateRef.current === isOpen) {
            return;
        }
        lastReportedOpenStateRef.current = isOpen;
        onOpenChangeRef.current?.(isOpen);
    }, [isOpen]);

    const normalizeProvider = useCallback((provider?: string) => {
        const p = (provider ?? '').toLowerCase();
        if (p === 'github') { return 'copilot'; }
        if (p === 'anthropic') { return 'claude'; }
        return p;
    }, []);

    const normalizedSelectedProvider = useMemo(() => {
        return normalizeProvider(selectedProvider);
    }, [selectedProvider, normalizeProvider]);

    const handleModelSelect = useCallback((p: string, id: string, m?: boolean, keepOpen?: boolean) => {
        onSelect(p, id, m);
        if (!m && !keepOpen) { setIsOpen(false); }
    }, [onSelect]);


    const handleClose = useCallback(() => {
        setIsOpen(false);
        setInitialTab('models');
    }, []);

    useEffect(() => {
        const handleOpenEvent = (e: Event) => {
            const customEvent = e as CustomEvent<{ tab?: 'models' | 'reasoning' | 'permissions' }>;
            if (customEvent.detail?.tab) {
                setInitialTab(customEvent.detail.tab);
            }
            setIsOpen(true);
        };
        window.addEventListener('tengra:open-model-selector', handleOpenEvent as EventListener);
        return () => window.removeEventListener('tengra:open-model-selector', handleOpenEvent as EventListener);
    }, []);

    useEffect(() => {
        setResolvedCopilotQuota(copilotQuota);
    }, [copilotQuota]);

    useEffect(() => {
        setResolvedClaudeQuota(claudeQuota);
    }, [claudeQuota]);

    useEffect(() => {
        setResolvedCodexUsage(codexUsage);
    }, [codexUsage]);

    useEffect(() => {
        setResolvedAntigravityQuota(quotas);
    }, [quotas]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        void (async () => {
            const [
                copilotQuotaResult,
                claudeQuotaResult,
                codexUsageResult,
                antigravityQuotaResult,
                copilotAccount,
                githubAccount,
                claudeAccount,
                anthropicAccount,
                codexAccount,
                openaiAccount,
                antigravityAccount,
                googleAccount
            ] = await Promise.all([
                window.electron.getCopilotQuota().catch(() => ({ accounts: [] })),
                window.electron.getClaudeQuota().catch(() => ({ accounts: [] })),
                window.electron.getCodexUsage().catch(() => ({ accounts: [] })),
                window.electron.getQuota().catch(() => null),
                window.electron.getActiveLinkedAccount('copilot').catch(() => null),
                window.electron.getActiveLinkedAccount('github').catch(() => null),
                window.electron.getActiveLinkedAccount('claude').catch(() => null),
                window.electron.getActiveLinkedAccount('anthropic').catch(() => null),
                window.electron.getActiveLinkedAccount('codex').catch(() => null),
                window.electron.getActiveLinkedAccount('openai').catch(() => null),
                window.electron.getActiveLinkedAccount('antigravity').catch(() => null),
                window.electron.getActiveLinkedAccount('google').catch(() => null)
            ]);

            const activeCopilotAccount = copilotAccount ?? githubAccount;
            const activeClaudeAccount = claudeAccount ?? anthropicAccount;
            const activeCodexAccount = codexAccount ?? openaiAccount;
            const activeAntigravityAccount = antigravityAccount ?? googleAccount;

            setResolvedCopilotQuota(copilotQuotaResult);
            setResolvedClaudeQuota(claudeQuotaResult);
            setResolvedCodexUsage(codexUsageResult);
            setResolvedAntigravityQuota(antigravityQuotaResult);
            setActiveCopilotAccountId(activeCopilotAccount?.id ?? null);
            setActiveCopilotAccountEmail(activeCopilotAccount?.email?.toLowerCase() ?? null);
            setActiveClaudeAccountId(activeClaudeAccount?.id ?? null);
            setActiveClaudeAccountEmail(activeClaudeAccount?.email?.toLowerCase() ?? null);
            setActiveCodexAccountId(activeCodexAccount?.id ?? null);
            setActiveCodexAccountEmail(activeCodexAccount?.email?.toLowerCase() ?? null);
            setActiveAntigravityAccountId(activeAntigravityAccount?.id ?? null);
            setActiveAntigravityAccountEmail(activeAntigravityAccount?.email?.toLowerCase() ?? null);
        })().catch(() => {
            setResolvedCopilotQuota(copilotQuota);
            setResolvedClaudeQuota(claudeQuota);
            setResolvedCodexUsage(codexUsage);
            setResolvedAntigravityQuota(quotas);
        });
    }, [isOpen, copilotQuota, claudeQuota, codexUsage, quotas]);

    const activeClaudeQuota = useMemo(() => {
        if (!resolvedClaudeQuota?.accounts || resolvedClaudeQuota.accounts.length === 0) {
            return null;
        }
        return resolvedClaudeQuota.accounts.find(account => account.accountId === activeClaudeAccountId)
            ?? resolvedClaudeQuota.accounts.find(account => account.email?.toLowerCase() === activeClaudeAccountEmail)
            ?? resolvedClaudeQuota.accounts.find(account => account.isActive === true)
            ?? (resolvedClaudeQuota.accounts.length === 1 ? resolvedClaudeQuota.accounts[0] : null);
    }, [resolvedClaudeQuota, activeClaudeAccountId, activeClaudeAccountEmail]);

    const activeCodexUsage = useMemo(() => {
        if (!resolvedCodexUsage?.accounts || resolvedCodexUsage.accounts.length === 0) {
            return null;
        }
        return resolvedCodexUsage.accounts.find(account => 'accountId' in account && account.accountId === activeCodexAccountId)
            ?? resolvedCodexUsage.accounts.find(account =>
                'email' in account &&
                typeof account.email === 'string' &&
                account.email.toLowerCase() === activeCodexAccountEmail
            )
            ?? resolvedCodexUsage.accounts.find(account => 'isActive' in account && account.isActive === true)
            ?? (resolvedCodexUsage.accounts.length === 1 ? resolvedCodexUsage.accounts[0] : null);
    }, [resolvedCodexUsage, activeCodexAccountId, activeCodexAccountEmail]);

    const activeAntigravityQuota = useMemo(() => {
        if (!resolvedAntigravityQuota?.accounts || resolvedAntigravityQuota.accounts.length === 0) {
            return null;
        }
        return resolvedAntigravityQuota.accounts.find(account => account.accountId === activeAntigravityAccountId)
            ?? resolvedAntigravityQuota.accounts.find(account => account.email?.toLowerCase() === activeAntigravityAccountEmail)
            ?? resolvedAntigravityQuota.accounts.find(account => account.isActive === true)
            ?? (resolvedAntigravityQuota.accounts.length === 1 ? resolvedAntigravityQuota.accounts[0] : null);
    }, [resolvedAntigravityQuota, activeAntigravityAccountId, activeAntigravityAccountEmail]);

    const activeCopilotQuota = useMemo(() => {
        if (!resolvedCopilotQuota?.accounts || resolvedCopilotQuota.accounts.length === 0) {
            return null;
        }
        return resolvedCopilotQuota.accounts.find(account => account.accountId === activeCopilotAccountId)
            ?? resolvedCopilotQuota.accounts.find(account => account.email?.toLowerCase() === activeCopilotAccountEmail)
            ?? resolvedCopilotQuota.accounts.find(account => account.isActive === true)
            ?? (resolvedCopilotQuota.accounts.length === 1 ? resolvedCopilotQuota.accounts[0] : null);
    }, [resolvedCopilotQuota, activeCopilotAccountId, activeCopilotAccountEmail]);

    const { isModelDisabled } = useModelSelectorLogic({
        settings,
        groupedModels,
        quotas,
        codexUsage,
        claudeQuota,
        copilotQuota,
        activeCodexUsage,
        activeClaudeQuota,
        activeCopilotQuota,
        activeAntigravityQuota
    });
    const categories = useModelCategories({ groupedModels, debouncedSearchQuery, settings, selectedModel, isModelDisabled, t });
    const currentCat = categories.find(category => category.models.some(model =>
        model.id === selectedModel &&
        (!normalizedSelectedProvider || normalizeProvider(model.provider) === normalizedSelectedProvider)
    )) ?? categories.find(category => category.models.some(model => model.id === selectedModel))
        ?? categories.find(category => category.id === normalizedSelectedProvider);

    const currentModelInfo = useMemo(() => {
        const normalized = selectedModel.toLowerCase();
        if (normalizedSelectedProvider) {
            for (const cat of categories) {
                const model = cat.models.find(item =>
                    (item.id === selectedModel || item.id.toLowerCase() === normalized) &&
                    normalizeProvider(item.provider) === normalizedSelectedProvider
                );
                if (model) { return model; }
            }
        }
        for (const cat of categories) {
            const model = cat.models.find(item => item.id === selectedModel || item.id.toLowerCase() === normalized);
            if (model) { return model; }
        }
        return null;
    }, [categories, selectedModel, normalizedSelectedProvider, normalizeProvider]);

    const contextLimit = useMemo(() => {
        if (currentModelInfo?.contextWindow) { return currentModelInfo.contextWindow; }
        const id = selectedModel.toLowerCase();
        if (id.includes('gpt-4') || id.includes('o1') || id.includes('gpt-5')) { return 128000; }
        if (id.includes('claude-3')) { return 200000; }
        if (id.includes('gemini-1.5')) { return 1000000; }
        return 32000;
    }, [selectedModel, currentModelInfo]);

    const contextUsagePercent = Math.min(100, (contextTokens / contextLimit) * 100);

    const effectiveThinkingLevel = useMemo(() => {
        const levels = currentModelInfo?.thinkingLevels;
        if (!levels || levels.length === 0) { return undefined; }
        if (thinkingLevel && levels.includes(thinkingLevel)) { return thinkingLevel; }
        if (levels.includes('low')) { return 'low'; }
        return levels[0];
    }, [currentModelInfo, thinkingLevel]);

    // Get recent models from settings
    const recentModels = settings?.general?.recentModels ?? [];

    return (
        <div className="relative">
            <ModelSelectorTrigger
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                currentCategory={currentCat}
                currentModelInfo={currentModelInfo}
                selectedModel={selectedModel}
                selectedModels={selectedModels}
                contextTokens={contextTokens}
                contextUsagePercent={contextUsagePercent}
                t={t}
                isIconOnly={isIconOnly}
                chatMode={chatMode}
            />

            <ModelSelectorModal
                isOpen={isOpen}
                onClose={handleClose}
                initialTab={initialTab}
                categories={categories}
                selectedModels={selectedModels}
                selectedModel={selectedModel}
                selectedProvider={selectedProvider}
                onSelect={handleModelSelect}
                onRemoveModel={onRemoveModel}
                isFavorite={isFavorite}
                toggleFavorite={toggleFavorite}
                recentModels={recentModels}
                t={t}
                chatMode={chatMode}
                onChatModeChange={onChatModeChange}
                thinkingLevel={effectiveThinkingLevel}
                onThinkingLevelChange={onThinkingLevelChange}
                copilotQuota={resolvedCopilotQuota}
                activeCopilotAccountId={activeCopilotAccountId}
                activeCopilotAccountEmail={activeCopilotAccountEmail}
                activeClaudeQuota={activeClaudeQuota}
                activeCodexUsage={activeCodexUsage}
                activeAntigravityQuota={activeAntigravityQuota}
                permissionPolicy={permissionPolicy}
                onUpdatePermissionPolicy={onUpdatePermissionPolicy}
            />
        </div>
    );
});
ModelSelector.displayName = 'ModelSelector';

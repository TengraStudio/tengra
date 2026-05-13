/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { PROXY_CHANNELS, USAGE_CHANNELS } from '@shared/constants/ipc-channels';
import { CodexUsage, CopilotQuota, CursorQuota, ProxyModelResponse, QuotaResponse } from '@shared/types';
import { IpcValue } from '@shared/types/common';
import { MarketplaceSkill } from '@shared/types/marketplace';
import { ProxySkill, ProxySkillUpsertInput } from '@shared/types/skill';
import { IpcRenderer } from 'electron';

export interface ProxyBridge {
    getProxyModels: () => Promise<ProxyModelResponse>;
    getQuota: () => Promise<{
        accounts: Array<QuotaResponse & { accountId?: string; email?: string }>;
    } | null>;
    getCopilotQuota: () => Promise<{
        accounts: Array<CopilotQuota & { accountId?: string; email?: string }>;
    }>;
    getCodexUsage: () => Promise<{
        accounts: Array<{ usage: CodexUsage; accountId?: string; email?: string }>;
    }>;
    getClaudeQuota: () => Promise<{ accounts: Array<import('@shared/types/quota').ClaudeQuota> }>;
    getCursorQuota: () => Promise<{ accounts: Array<CursorQuota> }>;
    forceRefreshQuota: () => Promise<boolean>;

    antigravityLogin: (accountId?: string) => Promise<{ url: string; state: string; accountId: string }>;
    ollamaLogin: (accountId?: string) => Promise<{ url: string; state: string; accountId: string }>;
    ollamaSignout: (accountId?: string) => Promise<{ success: boolean; alreadySignedOut?: boolean; error?: string }>;
    codexLogin: (accountId?: string) => Promise<{ url: string; state: string; accountId: string }>;
    claudeLogin: (accountId?: string) => Promise<{ url: string; state: string; accountId: string }>;
    cancelAuth: (provider: 'antigravity' | 'claude' | 'codex' | 'ollama', state: string, accountId: string) => Promise<boolean>;
    getBrowserAuthStatus: (provider: string, state: string, accountId: string) => Promise<{
        status: string;
        error?: string;
        provider?: string;
        state?: string;
        accountId?: string;
        account_id?: string;
    }>;
    verifyAuthBridge: (provider?: 'antigravity' | 'claude' | 'codex' | 'ollama') => Promise<{
        status: string;
        provider: string;
        readiness?: IpcValue;
        callback?: IpcValue;
        error?: string;
    }>;
    saveClaudeSession: (
        sessionKey: string,
        accountId?: string
    ) => Promise<{ success: boolean; error?: string }>;
    saveCursorSession: (
        session: string,
        accountId?: string
    ) => Promise<{ success: boolean; error?: string }>;
    checkUsageLimit: (
        provider: string,
        model: string
    ) => Promise<{ allowed: boolean; reason?: string }>;
    getUsageCount: (
        period: 'hourly' | 'daily' | 'weekly',
        provider?: string,
        model?: string
    ) => Promise<number>;
    listSkills: () => Promise<ProxySkill[]>;
    saveSkill: (input: ProxySkillUpsertInput) => Promise<ProxySkill>;
    toggleSkill: (skillId: string, enabled: boolean) => Promise<ProxySkill>;
    deleteSkill: (skillId: string) => Promise<boolean>;
    listMarketplaceSkills: () => Promise<MarketplaceSkill[]>;
    installMarketplaceSkill: (skillId: string) => Promise<ProxySkill>;
}

export function createProxyBridge(ipc: IpcRenderer): ProxyBridge {
    return {
        getProxyModels: () => ipc.invoke(PROXY_CHANNELS.GET_MODELS),
        getQuota: () => ipc.invoke(PROXY_CHANNELS.GET_QUOTA),
        getCopilotQuota: () => ipc.invoke(PROXY_CHANNELS.GET_COPILOT_QUOTA),
        getCodexUsage: () => ipc.invoke(PROXY_CHANNELS.GET_CODEX_USAGE),
        getClaudeQuota: () => ipc.invoke(PROXY_CHANNELS.GET_CLAUDE_QUOTA),
        getCursorQuota: () => ipc.invoke(PROXY_CHANNELS.GET_CURSOR_QUOTA),
        forceRefreshQuota: () => ipc.invoke(PROXY_CHANNELS.FORCE_REFRESH_QUOTA),

        antigravityLogin: accountId => ipc.invoke(PROXY_CHANNELS.ANTIGRAVITY_LOGIN, accountId),
        ollamaLogin: accountId => ipc.invoke(PROXY_CHANNELS.OLLAMA_LOGIN, accountId),
        ollamaSignout: accountId => ipc.invoke(PROXY_CHANNELS.OLLAMA_SIGNOUT, accountId),
        codexLogin: accountId => ipc.invoke(PROXY_CHANNELS.CODEX_LOGIN, accountId),
        claudeLogin: accountId => ipc.invoke(PROXY_CHANNELS.CLAUDE_LOGIN, accountId),
        cancelAuth: (provider, state, accountId) => ipc.invoke(PROXY_CHANNELS.CANCEL_AUTH, provider, state, accountId),
        getBrowserAuthStatus: (provider, state, accountId) => ipc.invoke(PROXY_CHANNELS.GET_AUTH_STATUS, provider, state, accountId),
        verifyAuthBridge: (provider) => ipc.invoke(PROXY_CHANNELS.VERIFY_AUTH_BRIDGE, provider),
        saveClaudeSession: (sessionKey, accountId) =>
            ipc.invoke(PROXY_CHANNELS.SAVE_CLAUDE_SESSION, sessionKey, accountId),
        saveCursorSession: (session, accountId) =>
            ipc.invoke(PROXY_CHANNELS.COMPLETE_CURSOR_AUTH, session, accountId),
        checkUsageLimit: (provider, model) => ipc.invoke(USAGE_CHANNELS.CHECK_LIMIT, provider, model),
        getUsageCount: (period, provider, model) =>
            ipc.invoke(USAGE_CHANNELS.GET_USAGE_COUNT, period, provider, model),
        listSkills: () => ipc.invoke(PROXY_CHANNELS.LIST_SKILLS),
        saveSkill: (input) => ipc.invoke(PROXY_CHANNELS.SAVE_SKILL, input),
        toggleSkill: (skillId, enabled) => ipc.invoke(PROXY_CHANNELS.TOGGLE_SKILL, skillId, enabled),
        deleteSkill: (skillId) => ipc.invoke(PROXY_CHANNELS.DELETE_SKILL, skillId),
        listMarketplaceSkills: () => ipc.invoke(PROXY_CHANNELS.LIST_MARKETPLACE_SKILLS),
        installMarketplaceSkill: (skillId) => ipc.invoke(PROXY_CHANNELS.INSTALL_MARKETPLACE_SKILL, skillId),
    };
}


import { CodexUsage, CopilotQuota, ProxyModelResponse, QuotaResponse } from '@shared/types';
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
        getProxyModels: () => ipc.invoke('proxy:getModels'),
        getQuota: () => ipc.invoke('proxy:getQuota'),
        getCopilotQuota: () => ipc.invoke('proxy:getCopilotQuota'),
        getCodexUsage: () => ipc.invoke('proxy:getCodexUsage'),
        getClaudeQuota: () => ipc.invoke('proxy:getClaudeQuota'),
        antigravityLogin: accountId => ipc.invoke('proxy:antigravityLogin', accountId),
        ollamaLogin: accountId => ipc.invoke('proxy:ollamaLogin', accountId),
        ollamaSignout: accountId => ipc.invoke('proxy:ollamaSignout', accountId),
        codexLogin: accountId => ipc.invoke('proxy:codexLogin', accountId),
        claudeLogin: accountId => ipc.invoke('proxy:claudeLogin', accountId),
        cancelAuth: (provider, state, accountId) => ipc.invoke('proxy:cancelAuth', provider, state, accountId),
        getBrowserAuthStatus: (provider, state, accountId) => ipc.invoke('proxy:getAuthStatus', provider, state, accountId),
        verifyAuthBridge: (provider) => ipc.invoke('proxy:verifyAuthBridge', provider),
        saveClaudeSession: (sessionKey, accountId) =>
            ipc.invoke('proxy:saveClaudeSession', sessionKey, accountId),
        checkUsageLimit: (provider, model) => ipc.invoke('usage:checkLimit', provider, model),
        getUsageCount: (period, provider, model) =>
            ipc.invoke('usage:getUsageCount', period, provider, model),
        listSkills: () => ipc.invoke('proxy:listSkills'),
        saveSkill: (input) => ipc.invoke('proxy:saveSkill', input),
        toggleSkill: (skillId, enabled) => ipc.invoke('proxy:toggleSkill', skillId, enabled),
        deleteSkill: (skillId) => ipc.invoke('proxy:deleteSkill', skillId),
        listMarketplaceSkills: () => ipc.invoke('proxy:listMarketplaceSkills'),
        installMarketplaceSkill: (skillId) => ipc.invoke('proxy:installMarketplaceSkill', skillId),
    };
}

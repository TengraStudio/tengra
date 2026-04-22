/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useState } from 'react';
import { fetchModels, getSelectableProviderId } from '@renderer/features/models/utils/model-fetcher';
import { appLogger } from '@renderer/utils/renderer-logger';

interface AIProviderInfo {
    provider: string;
    accountId?: string;
    quota?: number;
    models: any[];
}

export const useAICommitGenerator = (workspacePath: string | undefined) => {
    const [isGenerating, setIsGenerating] = useState(false);

    const generateCommitMessage = useCallback(async () => {
        if (!workspacePath) return null;
        setIsGenerating(true);

        try {
            // 1. Get Staged Diff
            const diffResult = await window.electron.git.getStagedDiff(workspacePath);
            if (!diffResult.success || !diffResult.diff.trim()) {
                setIsGenerating(false);
                return null;
            }

            // 2. Fetch Models and Quotas
            const allModels = await fetchModels(true);
            const rawQuota = await window.electron.getQuota();
            const accounts = await window.electron.getLinkedAccounts();

            const quotaMap = new Map<string, number>();
            if (rawQuota?.accounts) {
                rawQuota.accounts.forEach(q => {
                    if (q.accountId) quotaMap.set(q.accountId, q.remainingQuota ?? 0);
                });
            }

            // 3. Selection Logic
            // Priority 1: OAuth (Antigravity -> Copilot -> Codex -> Claude)
            const oauthPriority = ['antigravity', 'copilot', 'codex', 'claude'];
            let selectedProvider: AIProviderInfo | null = null;

            for (const p of oauthPriority) {
                const providerAccounts = accounts.filter(acc => acc.provider === p && acc.isActive);
                if (providerAccounts.length > 0) {
                    // Pick the one with highest quota
                    let bestAcc = providerAccounts[0];
                    let maxQuota = quotaMap.get(bestAcc.id) ?? 0;

                    for (const acc of providerAccounts) {
                        const q = quotaMap.get(acc.id) ?? 0;
                        if (q > maxQuota) {
                            maxQuota = q;
                            bestAcc = acc;
                        }
                    }

                    const providerModels = allModels.filter(m => getSelectableProviderId(m) === p);
                    if (providerModels.length > 0) {
                        selectedProvider = {
                            provider: p,
                            accountId: bestAcc.id,
                            quota: maxQuota,
                            models: providerModels
                        };
                        break; 
                    }
                }
            }

            // Priority 2: API Keys (openai, etc.)
            if (!selectedProvider) {
                const apiProviders = ['openai', 'google', 'anthropic']; // Simple check for API providers
                for (const p of apiProviders) {
                   const providerModels = allModels.filter(m => getSelectableProviderId(m) === p);
                   if (providerModels.length > 0) {
                       selectedProvider = { provider: p, models: providerModels };
                       break;
                   }
                }
            }

            // Priority 3: Local (Ollama)
            if (!selectedProvider) {
                const ollamaModels = allModels.filter(m => getSelectableProviderId(m) === 'ollama');
                if (ollamaModels.length > 0) {
                    selectedProvider = { provider: 'ollama', models: ollamaModels };
                }
            }

            // Priority 4: Fallback (OpenCode)
            if (!selectedProvider) {
                const openCodeModels = allModels.filter(m => getSelectableProviderId(m) === 'opencode');
                if (openCodeModels.length > 0) {
                    selectedProvider = { provider: 'opencode', models: openCodeModels };
                }
            }

            if (!selectedProvider) {
                throw new Error("No AI providers available for commit generation");
            }

            // 4. Select Small / Low-cost Model
            // Priority: haiku, mini, 8b, flash, small
            const smallModelKeywords = ['haiku', 'mini', '8b', 'flash', 'small', 'tiny', '3.5-sonnet']; // sonnet is fallback for haiku missing
            let targetModel = selectedProvider.models[0];
            
            for (const kw of smallModelKeywords) {
                const found = selectedProvider.models.find(m => m.id.toLowerCase().includes(kw));
                if (found) {
                    targetModel = found;
                    break;
                }
            }

            // 5. Generate
            const prompt = `Generate a short, conventional commit message based on the following git diff.
Follow the format: <type>: <description>
Examples:
- feat: add user login validation
- fix: resolve null pointer in auth service
- refactor: simplify provider selection logic

Rules:
- Keep it short and clear
- Plain text only
- No explanations, no extra text

Diff:
${diffResult.diff}`;

            const response = await window.electron.session.conversation.complete({
                messages: [{ role: 'user', content: prompt, id: 'commit-gen-' + Date.now(), timestamp: new Date() }],
                model: targetModel.id,
                provider: selectedProvider.provider,
            });

            if (!response.content) {
                appLogger.warn('useAICommitGenerator', 'Empty content from AI', response);
                return null;
            }

            return response.content.trim().replace(/^`+|`+$/g, '');

        } catch (e) {
            appLogger.error('useAICommitGenerator', 'Generation failed', e as Error);
            return null;
        } finally {
            setIsGenerating(false);
        }
    }, [workspacePath]);

    return {
        generateCommitMessage,
        isGenerating
    };
};

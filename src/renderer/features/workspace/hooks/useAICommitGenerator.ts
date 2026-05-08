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

import { fetchModels, getSelectableProviderId } from '@/features/models/utils/model-fetcher';
import { ModelInfo } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

interface AIProviderInfo {
    provider: string;
    accountId?: string;
    quota?: number;
    models: ModelInfo[];
}

export const useAICommitGenerator = (workspacePath: string | undefined) => {
    const [isGenerating, setIsGenerating] = useState(false);

    const generateCommitMessage = useCallback(async () => {
        if (!workspacePath) {return null;}
        setIsGenerating(true);

        try {
            // 1. Get Workspace Status
            const statusResult = await window.electron.git.getDetailedStatus(workspacePath);
            const changedFiles = statusResult.success ? [
                ...(statusResult.staged || []),
                ...(statusResult.unstaged || []),
                ...(statusResult.untracked || [])
            ] : [];

            if (changedFiles.length === 0) {
                setIsGenerating(false);
                return "No changes found to generate a commit message.";
            }

            // 2. Get Staged Diff
            const diffResult = await window.electron.git.getStagedDiff(workspacePath);
            let diffText = diffResult.success ? diffResult.diff.trim() : '';

            if (!diffText) {
                // Fallback to all changes (unstaged + staged)
                const fullDiff = await window.electron.git.runControlledOperation(
                    workspacePath, 
                    'git diff HEAD', 
                    'diff-full-' + Date.now(), 
                    10000
                );
                if (fullDiff.success && fullDiff.stdout) {
                    diffText = fullDiff.stdout.trim();
                }
            }

            // Include untracked files in the context if they exist
            const untrackedFiles = statusResult.untracked || [];
            let untrackedContext = '';
            if (untrackedFiles.length > 0) {
                untrackedContext = `\nUntracked files (new):\n${untrackedFiles.map(f => `- ${f.path}`).join('\n')}`;
            }

            if (!diffText && untrackedFiles.length === 0) {
                setIsGenerating(false);
                return "No content changes found to generate a commit message.";
            }

            // 2. Fetch Models and Quotas
            const allModels = await fetchModels(true);
            const rawQuota = await window.electron.auth.getQuota();
            const accounts = await window.electron.auth.getLinkedAccounts();

            const quotaMap = new Map<string, number>();
            if (rawQuota?.accounts) {
                rawQuota.accounts.forEach(q => {
                    if (q.accountId) {quotaMap.set(q.accountId, q.remainingQuota ?? 0);}
                });
            }

            // 3. Selection Logic
            // Priority 1: OAuth (Antigravity -> Copilot -> Codex -> Claude)
            const oauthPriority = ['antigravity', 'copilot', 'codex', 'claude'];
            let selectedProvider: AIProviderInfo | null = null;

            for (const p of oauthPriority) {
                const providerAccounts = accounts.filter(acc => acc.provider === p && acc.isActive);
                if (providerAccounts.length === 0) { continue; }

                // Pick the one with highest quota
                const best = providerAccounts.reduce((acc, curr) => {
                    const q = quotaMap.get(curr.id) ?? 0;
                    return q > acc.quota ? { account: curr, quota: q } : acc;
                }, { account: providerAccounts[0], quota: quotaMap.get(providerAccounts[0].id) ?? 0 });

                const providerModels = allModels.filter(m => getSelectableProviderId(m) === p);
                if (providerModels.length > 0) {
                    selectedProvider = {
                        provider: p,
                        accountId: best.account.id,
                        quota: best.quota,
                        models: providerModels
                    };
                    break;
                }
            }

            // Priority 2: API Keys (openai, etc.)
            if (!selectedProvider) {
                const apiProviders = ['antigravity', 'proxy', 'openai', 'google', 'anthropic']; // Simple check for API providers
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
                const found = selectedProvider.models.find(m => m.id?.toLowerCase().includes(kw));
                if (found) {
                    targetModel = found;
                    break;
                }
            }

            // 5. Generate
            const fileList = changedFiles.map(f => `- ${f.path} (${f.status})`).join('\n');
            const prompt = `You are an expert developer. Analyze the following changes in the workspace and generate a precise, descriptive commit message.

Workspace Changes:
${fileList}
${untrackedContext}

Diff Analysis:
${diffText || 'No diff available (only untracked files).'}

Requirements:
1. Use the conventional commit format: <type>(<optional-scope>): <subject>
2. The subject should be a concise summary (max 50 chars) in the imperative mood.
3. Be specific. Instead of "update files", say "refactor user authentication logic" or "add validation to registration form".
4. If the changes are complex or cover multiple areas, add a blank line and provide a brief bulleted list explaining the *why* and *what* of the changes.
5. Output ONLY the commit message. No markdown blocks, no greetings.`;

            const response = await window.electron.session.conversation.complete({
                messages: [{ role: 'user', content: prompt, id: 'commit-gen-' + Date.now(), timestamp: new Date() }],
                model: targetModel.id || '',
                provider: selectedProvider.provider,
                accountId: selectedProvider.accountId,
            });

            if (!response.content) {
                appLogger.warn('useAICommitGenerator', 'Empty content from AI', response);
                return null;
            }

            return response.content.trim().replace(/^`+|`+$/g, '');

        } catch (e) {
            appLogger.error('useAICommitGenerator', 'Generation failed', e as Error);
            return `Generation failed: ${(e as Error).message}`;
        } finally {
            setIsGenerating(false);
        }
    }, [workspacePath]);

    return {
        generateCommitMessage,
        isGenerating
    };
};


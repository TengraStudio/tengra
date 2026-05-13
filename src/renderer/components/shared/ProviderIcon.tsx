/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { memo } from 'react';

import { cn } from '@/lib/utils';

import { ProviderLogo } from './ProviderLogo';

/**
 * Supported variants for the ProviderIcon.
 * - message: Used in chat bubbles for assistant avatars.
 * - settings: Used in the settings accounts tab for provider cards.
 * - minimal: Smaller variant used in tooltips or compact UI.
 * - list: Medium variant used in model selectors or lists.
 */
export type ProviderIconVariant = 'message' | 'settings' | 'minimal' | 'list';

export interface ProviderIconProps {
    provider?: string;
    model?: string;
    backend?: string;
    variant?: ProviderIconVariant;
    size?: number | string;
    className?: string;
    containerClassName?: string;
}

const getInferredProvider = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.startsWith('gpt-') || lower.startsWith('o1-')) { return 'openai'; }
    if (lower.startsWith('o3-') || lower.startsWith('o4-')) { return 'openai'; }
    if (lower.startsWith('claude-')) { return 'anthropic'; }
    if (lower.startsWith('gemini-')) { return 'gemini'; }
    if (lower.startsWith('grok-') || lower.startsWith('xai-')) { return 'xai'; }
    if (lower.startsWith('mistral-')) { return 'mistral'; }
    if (lower.startsWith('groq-')) { return 'groq'; }
    if (lower.startsWith('antigravity-')) { return 'antigravity'; }
    if (lower.startsWith('deepseek/')) { return 'deepseek'; }
    if (lower.startsWith('qwen/') || lower.startsWith('glm/') || lower.startsWith('kimi/')) { return 'opencode'; }
    return null;
};

const resolveProviderKey = (modelName?: string, provider?: string, backend?: string): string => {
    const name = (modelName ?? '').toLowerCase();
    const inferred = getInferredProvider(name);

    const candidates = [provider, backend, inferred, name]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map(value => value.toLowerCase());

    const keys = [
        'openai', 'anthropic', 'antigravity', 'gemini', 'nvidia', 
        'mistral', 'groq', 'deepseek', 'xai', 'ollama', 
        'copilot', 'opencode', 'openrouter', 'cursor', 'huggingface'
    ];

    for (const candidate of candidates) {
        const matched = keys.find(k => candidate.includes(k));
        if (matched) { return matched; }
        if (candidate.includes('codex')) { return 'openai'; }
        if (candidate.includes('gpt')) { return 'openai'; }
        if (candidate.includes('claude')) { return 'anthropic'; }
        if (candidate.includes('google')) { return 'gemini'; }
        if (candidate.includes('github')) { return 'copilot'; }
        if (candidate.includes('x-ai')) { return 'xai'; }
    }

    return inferred ?? 'ollama';
};

const VARIANT_CONFIG: Record<ProviderIconVariant, string> = {
    message: 'h-8 w-8 rounded-lg border border-border/40 bg-muted/20 p-1',
    settings: 'h-12 w-12 rounded-2xl border border-border/20 bg-muted/30 p-2.5',
    minimal: 'h-5 w-5 rounded-md border border-border/40 bg-muted/20 p-0.5',
    list: 'h-10 w-10 rounded-xl border border-border/20 bg-muted/20 p-2',
};

/**
 * Unified component for rendering provider icons with consistent styling and theme support.
 * Consolidates mapping logic and container designs.
 */
export const ProviderIcon = memo(({
    provider,
    model,
    backend,
    variant = 'minimal',
    size = '100%',
    className,
    containerClassName,
}: ProviderIconProps) => {
    const providerKey = resolveProviderKey(model, provider, backend);

    return (
        <div
            className={cn(
                'flex items-center justify-center shrink-0 overflow-hidden transition-all duration-300',
                VARIANT_CONFIG[variant],
                containerClassName
            )}
            title={providerKey.toUpperCase()}
        >
            <ProviderLogo 
                provider={providerKey} 
                size={size} 
                className={cn('text-foreground/80 transition-colors', className)} 
            />
        </div>
    );
});

ProviderIcon.displayName = 'ProviderIcon';

/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import LogoAntigravity from '@assets/antigravity.svg?url';
import LogoOpenAI from '@assets/chatgpt.svg?url';
import LogoClaude from '@assets/claude.svg?url';
import LogoCopilot from '@assets/copilot.svg?url';
import LogoGemini from '@assets/gemini.png';
import LogoHuggingFace from '@assets/huggingface.svg?url';
import LogoNvidia from '@assets/nvidia.svg?url';
import LogoOllama from '@assets/ollama.svg?url';
import LogoOpenCode from '@assets/opencode.svg?url';
import { memo } from 'react';

import { UI_PRIMITIVES } from '@/constants/ui-primitives';
import { cn } from '@/lib/utils';

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;
type MessageIconColor = 'blue' | 'orange' | 'indigo' | 'purple' | 'cyan' | 'emerald' | 'yellow' | 'black' | 'red' | 'muted';

interface MessageIconProps {
    short: string;
    color: MessageIconColor;
    title: string;
}

const MESSAGE_ICON_COLOR_CLASSES: Record<MessageIconColor, { container: string; text: string }> = {
    blue: { container: 'bg-blue-500/10 border-blue-500/10', text: 'text-blue-400' },
    orange: { container: 'bg-orange-500/10 border-orange-500/10', text: 'text-orange-400' },
    indigo: { container: 'bg-indigo-500/10 border-indigo-500/10', text: 'text-indigo-400' },
    purple: { container: 'bg-purple-500/10 border-purple-500/10', text: 'text-purple-400' },
    cyan: { container: 'bg-cyan-500/10 border-cyan-500/10', text: 'text-cyan-400' },
    emerald: { container: 'bg-emerald-500/10 border-emerald-500/10', text: 'text-emerald-400' },
    yellow: { container: 'bg-yellow-500/10 border-yellow-500/10', text: 'text-yellow-400' },
    black: { container: 'bg-muted/50 border-border/40', text: 'text-foreground' },
    red: { container: 'bg-red-500/10 border-red-500/10', text: 'text-red-400' },
    muted: { container: 'bg-muted/50 border-muted', text: 'text-muted-foreground' },
};

const MessageIcon = ({ short, color, title }: MessageIconProps) => (
    <div
        className={cn(
            UI_PRIMITIVES.ASSISTANT_LOGO_BASE,
            'w-6 h-6 shrink-0 mt-1.5 p-1',
            MESSAGE_ICON_COLOR_CLASSES[color].container
        )}
        title={title}
    >
        <span className={cn('font-bold typo-overline', MESSAGE_ICON_COLOR_CLASSES[color].text)}>{short}</span>
    </div>
);

const getSpecialModelLogo = (name: string, t: TranslationFn) => {
    const families = [
        { key: 'llama', short: 'LL', color: 'blue', title: t('frontend.messageBubble.modelFamilies.llama') },
        { key: 'mistral', short: 'M', color: 'orange', title: t('frontend.messageBubble.modelFamilies.mistral') },
        { key: 'mixtral', short: 'M', color: 'orange', title: t('frontend.messageBubble.modelFamilies.mistral') },
        { key: 'deepseek', short: 'DS', color: 'indigo', title: t('frontend.messageBubble.modelFamilies.deepseek') },
        { key: 'qwen', short: 'Q', color: 'purple', title: t('frontend.messageBubble.modelFamilies.qwen') },
        { key: 'phi', short: 'Φ', color: 'cyan', title: t('frontend.messageBubble.modelFamilies.phi') },
    ];
    const match = families.find(f => name.includes(f.key));
    if (match) {
        return { short: match.short, color: match.color as MessageIconColor, title: match.title };
    }
    return null;
};

const getInferredProvider = (name: string) => {
    if (name.startsWith('gpt-') || name.startsWith('o1-')) { return 'openai'; }
    if (name.startsWith('claude-')) { return 'anthropic'; }
    if (name.startsWith('gemini-')) { return 'gemini'; }
    if (name.startsWith('grok-')) { return 'groq'; }
    if (name.startsWith('antigravity-')) { return 'antigravity'; }
    if (name.startsWith('qwen/') || name.startsWith('deepseek/') || name.startsWith('glm/') || name.startsWith('kimi/')) { return 'opencode'; }
    return null;
};

const getProviderLogoInfo = (modelName: string, provider?: string, backend?: string) => {
    const name = modelName.toLowerCase();
    const inferred = getInferredProvider(name);

    const logoMap: Record<string, { logo: string | null; key: string; color: MessageIconColor; short?: string }> = {
        opencode: { logo: LogoOpenCode, key: 'opencode', color: 'blue' },
        openai: { logo: LogoOpenAI, key: 'openai', color: 'emerald' },
        codex: { logo: LogoOpenAI, key: 'openai', color: 'emerald' },
        gpt: { logo: LogoOpenAI, key: 'openai', color: 'emerald' },
        anthropic: { logo: LogoClaude, key: 'anthropic', color: 'orange' },
        claude: { logo: LogoClaude, key: 'anthropic', color: 'orange' },
        antigravity: { logo: LogoAntigravity, key: 'antigravity', color: 'yellow' },
        gemini: { logo: LogoGemini, key: 'gemini', color: 'cyan' },
        google: { logo: LogoGemini, key: 'gemini', color: 'cyan' },
        huggingface: { logo: LogoHuggingFace, key: 'huggingface', color: 'yellow' },
        nvidia: { logo: LogoNvidia, key: 'nvidia', color: 'emerald' },
        ollama: { logo: LogoOllama, key: 'ollama', color: 'muted' },
        github: { logo: LogoCopilot, key: 'copilot', color: 'black' },
        copilot: { logo: LogoCopilot, key: 'copilot', color: 'black' },
        groq: { logo: null, key: 'groq', color: 'red', short: 'G' },
    };

    const candidates = [provider, backend, inferred, name]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map(value => value.toLowerCase());

    for (const candidate of candidates) {
        const matchedKey = Object.keys(logoMap).find(key => candidate.includes(key));
        if (matchedKey) {
            return logoMap[matchedKey];
        }
    }

    return { logo: LogoOllama, key: inferred ?? 'ollama', color: 'muted' as MessageIconColor, short: undefined };
};

export interface AssistantLogoProps {
    displayModel?: string;
    provider?: string;
    backend?: string;
    t: TranslationFn;
}

/**
 * AssistantLogo component
 * 
 * Renders the logo for the AI assistant based on the model, provider, or backend.
 */
export const AssistantLogo = memo(({ displayModel, provider, backend, t }: AssistantLogoProps) => {
    const modelName = (displayModel ?? '').toString().toLowerCase();
    const special = getSpecialModelLogo(modelName, t);

    if (special) {
        return <MessageIcon {...special} />;
    }

    const info = getProviderLogoInfo(modelName, provider, backend);
    const containerClasses = cn(
        UI_PRIMITIVES.ASSISTANT_LOGO_BASE,
        "w-6 h-6 p-1 mt-1.5 shrink-0",
        MESSAGE_ICON_COLOR_CLASSES[info.color].container
    );

    if (info.logo) {
        return (
            <div className={containerClasses} title={info.key.toUpperCase()}>
                <img
                    src={info.logo}
                    className={cn(
                        'w-full h-full opacity-70 transition-all duration-300',
                        !['antigravity', 'gemini', 'huggingface', 'nvidia'].includes(info.key) && 'theme-logo-invert'
                    )}
                    alt={info.key}
                />
            </div>
        );
    }

    return (
        <MessageIcon
            short={info.short ?? t('common.ai')}
            color={info.color}
            title={info.key.toUpperCase()}
        />
    );
});

AssistantLogo.displayName = 'AssistantLogo';

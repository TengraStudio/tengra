/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { memo } from 'react';

import LogoAntigravity from '@/assets/antigravity.svg?url';
import LogoOpenAI from '@/assets/chatgpt.svg?url';
import LogoClaude from '@/assets/claude.svg?url';
import LogoCopilot from '@/assets/copilot.svg?url';
import LogoOllama from '@/assets/ollama.svg?url';
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
    black: { container: 'bg-black/10 border-black/15', text: 'text-black' },
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
        <span className={cn('font-bold text-10', MESSAGE_ICON_COLOR_CLASSES[color].text)}>{short}</span>
    </div>
);

const getSpecialModelLogo = (name: string, t: TranslationFn) => {
    const families = [
        { key: 'llama', short: 'LL', color: 'blue', title: t('messageBubble.modelFamilies.llama') },
        { key: 'mistral', short: 'M', color: 'orange', title: t('messageBubble.modelFamilies.mistral') },
        { key: 'mixtral', short: 'M', color: 'orange', title: t('messageBubble.modelFamilies.mistral') },
        { key: 'deepseek', short: 'DS', color: 'indigo', title: t('messageBubble.modelFamilies.deepseek') },
        { key: 'qwen', short: 'Q', color: 'purple', title: t('messageBubble.modelFamilies.qwen') },
        { key: 'phi', short: 'Φ', color: 'cyan', title: t('messageBubble.modelFamilies.phi') },
    ];
    const match = families.find(f => name.includes(f.key));
    if (match) {
        return { short: match.short, color: match.color as MessageIconColor, title: match.title };
    }
    return null;
};

const getInferredProvider = (name: string) => {
    if (name.startsWith('gpt-') || name.startsWith('o1-')) {return 'openai';}
    if (name.startsWith('claude-')) {return 'anthropic';}
    if (name.startsWith('grok-')) {return 'groq';}
    if (name.startsWith('antigravity-')) {return 'antigravity';}
    return null;
};

const getProviderLogoInfo = (modelName: string, provider?: string, backend?: string) => {
    const name = modelName.toLowerCase();
    const inferred = getInferredProvider(name);
    const effective = (provider ?? backend ?? inferred ?? 'ollama').toLowerCase();

    const logoMap: Record<string, { logo: string | null; key: string; color: MessageIconColor; short?: string }> = {
        openai: { logo: LogoOpenAI, key: 'openai', color: 'emerald' },
        codex: { logo: LogoOpenAI, key: 'openai', color: 'emerald' },
        gpt: { logo: LogoOpenAI, key: 'openai', color: 'emerald' },
        anthropic: { logo: LogoClaude, key: 'anthropic', color: 'orange' },
        claude: { logo: LogoClaude, key: 'anthropic', color: 'orange' },
        antigravity: { logo: LogoAntigravity, key: 'antigravity', color: 'yellow' },
        github: { logo: LogoCopilot, key: 'copilot', color: 'black' },
        copilot: { logo: LogoCopilot, key: 'copilot', color: 'black' },
        groq: { logo: null, key: 'groq', color: 'red', short: 'G' },
    };

    const matchedKey = Object.keys(logoMap).find(k => effective.includes(k));
    if (matchedKey) {return logoMap[matchedKey];}
    return { logo: LogoOllama, key: effective, color: 'muted' as MessageIconColor, short: undefined };
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
                        info.key !== 'antigravity' && 'theme-logo-invert'
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

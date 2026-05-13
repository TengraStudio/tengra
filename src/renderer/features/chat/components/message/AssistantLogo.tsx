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

import { ProviderIcon } from '@/components/shared/ProviderIcon';
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
    blue: { container: 'bg-muted/40 border-border', text: 'text-foreground/80' },
    orange: { container: 'bg-muted/40 border-border', text: 'text-foreground/80' },
    indigo: { container: 'bg-muted/40 border-border', text: 'text-foreground/80' },
    purple: { container: 'bg-muted/40 border-border', text: 'text-foreground/80' },
    cyan: { container: 'bg-muted/40 border-border', text: 'text-foreground/80' },
    emerald: { container: 'bg-muted/40 border-border', text: 'text-foreground/80' },
    yellow: { container: 'bg-muted/40 border-border', text: 'text-foreground/80' },
    black: { container: 'bg-muted/40 border-border', text: 'text-foreground/80' },
    red: { container: 'bg-muted/40 border-border', text: 'text-foreground/80' },
    muted: { container: 'bg-muted/40 border-border', text: 'text-muted-foreground' },
};

const MessageIcon = ({ short, color, title }: MessageIconProps) => (
    <div
        className={cn(
            UI_PRIMITIVES.ASSISTANT_LOGO_BASE,
            'mt-1.5 h-5 w-5 shrink-0 rounded border p-0.5',
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

    return (
        <ProviderIcon 
            model={modelName}
            provider={provider}
            backend={backend}
            variant="minimal"
            containerClassName="mt-1.5"
        />
    );
});

AssistantLogo.displayName = 'AssistantLogo';

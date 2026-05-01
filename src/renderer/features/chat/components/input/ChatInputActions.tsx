/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconMicrophone, IconMicrophoneOff, IconPaperclip, IconSend, IconSparkles, IconSquare } from '@tabler/icons-react';
import { memo } from 'react';

import { ModelSelector } from '@/components/shared/ModelSelector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { useChatInputController } from '../../hooks/useChatInputController';

/* Batch-02: Extracted Long Classes */
const C_CHATINPUTACTIONS_1 = "mb-2 flex items-center gap-2 rounded-md border border-border/30 bg-muted/5 px-2.5 py-1.5 transition-all animate-in fade-in slide-in-from-top-1";
const C_CHATINPUTACTIONS_2 = "ml-auto h-7 w-12 rounded-md border border-border/45 bg-background px-1.5 text-center typo-caption text-foreground outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring";


type ControllerType = ReturnType<typeof useChatInputController>;

/**
 * ModelSelectorWrapper - Integrated model selector button
 */
export const ModelSelectorWrapper = memo(({ ctrl }: { ctrl: ControllerType }) => (
    <div data-testid="model-selector" className="flex items-center">
        <ModelSelector
            selectedProvider={ctrl.selectedProvider}
            selectedModel={ctrl.selectedModel}
            selectedModels={ctrl.selectedModels}
            onSelect={ctrl.handleSelectModel}
            onRemoveModel={ctrl.removeSelectedModel}
            settings={ctrl.appSettings ?? undefined}
            groupedModels={ctrl.groupedModels ?? undefined}
            quotas={ctrl.quotas}
            codexUsage={ctrl.codexUsage}
            claudeQuota={ctrl.claudeQuota}
            copilotQuota={ctrl.copilotQuota}
            onOpenChange={ctrl.setIsModelMenuOpen}
            contextTokens={ctrl.contextTokens}
            language={ctrl.language}
            toggleFavorite={ctrl.toggleFavorite}
            isFavorite={ctrl.isFavorite}
            isIconOnly={true}
            chatMode={
                ctrl.systemMode === 'thinking'
                    ? 'thinking'
                    : ctrl.systemMode === 'agent'
                        ? 'agent'
                        : 'instant'
            }
            onChatModeChange={mode => {
                ctrl.setSystemMode(mode === 'instant' ? 'fast' : mode);
            }}
            thinkingLevel={ctrl.getModelReasoningLevel?.(ctrl.selectedModel)}
            onThinkingLevelChange={(modelId, level) =>
                ctrl.setModelReasoningLevel?.(modelId, level)
            }
            permissionPolicy={ctrl.permissionPolicy}
            onUpdatePermissionPolicy={ctrl.setPermissionPolicy}
        />
    </div>
));
ModelSelectorWrapper.displayName = 'ModelSelectorWrapper';

/**
 * EnhanceButton - Minimalism-focused enhance button
 */
export const EnhanceButton = memo(({ ctrl }: { ctrl: ControllerType }) => {
    const isEnhancable = ctrl.input.trim() !== '' && !ctrl.isLoading;
    const isEnhancing = ctrl.isEnhancing;

    return (
        <Button
            type="button"
            onClick={() => {
                void ctrl.handleEnhancePrompt();
            }}
            disabled={!isEnhancable || isEnhancing}
            variant="ghost"
            size="icon"
            className={cn(
                'h-8 w-8 rounded-md transition-colors',
                isEnhancing
                    ? 'bg-warning/10 text-warning'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
            title={ctrl.t('frontend.input.enhancePrompt')}
            aria-label={ctrl.t('frontend.input.enhancePrompt')}
        >
            <IconSparkles size={16} className={cn(isEnhancing && 'animate-spin')} aria-hidden="true" />
        </Button>
    );
});
EnhanceButton.displayName = 'EnhanceButton';

/**
 * SendButton - Premium look send button
 */
export const SendButton = memo(({ ctrl }: { ctrl: ControllerType }) => {
    const hasContent = ctrl.input.trim() !== '' || ctrl.attachments.length > 0;
    const isLoading = ctrl.isLoading;

    return (
        <Button
            type="button"
            onClick={
                isLoading
                    ? ctrl.stopGeneration
                    : () => {
                        void ctrl.sendMessageWithTelemetry();
                    }
            }
            disabled={!isLoading && !hasContent}
            size="icon"
            className={cn(
                'h-8 w-8 rounded-md border transition-colors duration-150',
                isLoading
                    ? 'border-destructive/35 bg-destructive/10 text-destructive hover:bg-destructive/15'
                    : hasContent
                        ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'border-border/35 bg-muted/35 text-muted-foreground/40'
            )}
            aria-label={isLoading ? ctrl.t('common.stop') : ctrl.t('common.send')}
            aria-busy={isLoading}
            aria-live="polite"
        >
            <SendIcon isLoading={isLoading} hasContent={hasContent} />
        </Button>
    );
});
SendButton.displayName = 'SendButton';

const SendIcon = memo(({ isLoading, hasContent }: { isLoading: boolean; hasContent: boolean }) => {
    const Icon = isLoading ? IconSquare : IconSend;
    const colorFill = isLoading ? 'currentColor' : 'none';
    const iClass = cn(isLoading && 'animate-pulse', !isLoading && hasContent && 'ml-0.5');
    return <Icon size={16} fill={colorFill} className={iClass} aria-hidden="true" />;
});
SendIcon.displayName = 'SendIcon';

/**
 * VoiceButton - Minimalist mic toggle
 */
export const VoiceButton = memo(({ ctrl }: { ctrl: ControllerType }) => (
    <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={ctrl.isListening ? ctrl.stopListening : ctrl.startListening}
        className={cn(
            'h-8 w-8 rounded-md transition-colors',
            ctrl.isListening
                ? 'bg-destructive/10 text-destructive'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        )}
        title={
            ctrl.isListening
                ? ctrl.t('frontend.input.stopListening')
                : ctrl.t('frontend.input.startListening')
        }
        aria-label={
            ctrl.isListening
                ? ctrl.t('frontend.input.stopListening')
                : ctrl.t('frontend.input.startListening')
        }
        aria-pressed={ctrl.isListening}
    >
        {ctrl.isListening ? (
            <IconMicrophoneOff size={16} aria-hidden="true" />
        ) : (
            <IconMicrophone size={16} aria-hidden="true" />
        )}
    </Button>
));
VoiceButton.displayName = 'VoiceButton';

/**
 * AttachButton - Minimalist paperclip button
 */
export const AttachButton = memo(({ onClick, ctrl }: { onClick: () => void; ctrl: ControllerType }) => (
    <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onClick}
        className="h-8 w-8 rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title={ctrl.t('frontend.input.attachFile')}
        aria-label={ctrl.t('frontend.input.attachFile')}
    >
        <IconPaperclip size={16} aria-hidden="true" />
    </Button>
));
AttachButton.displayName = 'AttachButton';

/**
 * ComposerStateBadges - Status indicators in the bottom bar
 */
export const ComposerStateBadges = memo(({ ctrl }: { ctrl: ControllerType }) => (
    <div className="flex items-center gap-1.5 ml-1">
        {ctrl.isListening && (
            <Badge
                variant="destructive"
                className="h-6 rounded-md border-transparent px-1.5 typo-body"
            >
                <IconMicrophone size={10} aria-hidden="true" />
            </Badge>
        )}
        {ctrl.attachments.length > 0 && (
            <Badge
                variant="secondary"
                className="h-6 gap-1 rounded-md px-2 typo-body font-medium"
            >
                <IconPaperclip size={10} aria-hidden="true" />
                <span>{ctrl.attachments.length}</span>
            </Badge>
        )}
    </div>
));
ComposerStateBadges.displayName = 'ComposerStateBadges';

/**
 * ImageCountPanel - Settings for image generation models
 */
export const ImageCountPanel = memo(({ ctrl }: { ctrl: ControllerType }) => (
    <div className={C_CHATINPUTACTIONS_1}>
        <span className="typo-body text-muted-foreground font-medium">{ctrl.t('frontend.input.imageCountLabel')}</span>
        <input
            type="number"
            min={1}
            max={5}
            value={ctrl.imageRequestCount}
            onChange={event => {
                const nextValue = Number.parseInt(event.target.value, 10);
                if (!Number.isFinite(nextValue)) {
                    ctrl.setImageRequestCount(1);
                    return;
                }
                ctrl.setImageRequestCount(Math.max(1, Math.min(5, nextValue)));
            }}
            className={C_CHATINPUTACTIONS_2}
            aria-label={ctrl.t('frontend.input.imageCountLabel')}
        />
    </div>
));
ImageCountPanel.displayName = 'ImageCountPanel';

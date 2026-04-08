import { Mic, MicOff, Paperclip, Send, Sparkles, Square } from 'lucide-react';
import { memo } from 'react';

import { ModelSelector } from '@/components/shared/ModelSelector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { useChatInputController } from '../../hooks/useChatInputController';

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
                'h-8 w-8 rounded-full transition-all active:scale-95',
                isEnhancing
                    ? 'bg-warning/10 text-warning animate-pulse'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            )}
            title={ctrl.t('input.enhancePrompt')}
            aria-label={ctrl.t('input.enhancePrompt')}
        >
            <Sparkles size={16} className={cn(isEnhancing && 'animate-spin')} aria-hidden="true" />
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
                'h-8 w-8 rounded-full transition-all duration-200 active:scale-90 shadow-sm',
                isLoading
                    ? 'bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/10'
                    : hasContent
                        ? 'bg-primary text-primary-foreground hover:bg-primary/95 hover:shadow-primary/20 active:translate-y-0.5'
                        : 'bg-muted/40 text-muted-foreground/30'
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
    const Icon = isLoading ? Square : Send;
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
            'h-8 w-8 rounded-full transition-all active:scale-95',
            ctrl.isListening
                ? 'bg-destructive/10 text-destructive animate-pulse'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
        )}
        title={
            ctrl.isListening
                ? ctrl.t('input.stopListening')
                : ctrl.t('input.startListening')
        }
        aria-label={
            ctrl.isListening
                ? ctrl.t('input.stopListening')
                : ctrl.t('input.startListening')
        }
        aria-pressed={ctrl.isListening}
    >
        {ctrl.isListening ? (
            <MicOff size={16} aria-hidden="true" />
        ) : (
            <Mic size={16} aria-hidden="true" />
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
        className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all active:scale-95"
        title={ctrl.t('input.attachFile')}
        aria-label={ctrl.t('input.attachFile')}
    >
        <Paperclip size={16} aria-hidden="true" />
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
                className="h-6 rounded-full border-transparent px-1.5 typo-body animate-pulse"
            >
                <Mic size={10} aria-hidden="true" />
            </Badge>
        )}
        {ctrl.attachments.length > 0 && (
            <Badge
                variant="secondary"
                className="h-6 gap-1 rounded-full px-2 typo-body font-medium"
            >
                <Paperclip size={10} aria-hidden="true" />
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
    <div className="mb-2 flex items-center gap-2 rounded-xl border border-border/15 bg-muted/5 px-3 py-1.5 transition-all animate-in fade-in slide-in-from-top-1">
        <span className="typo-body text-muted-foreground font-medium">{ctrl.t('input.imageCountLabel')}</span>
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
            className="ml-auto h-7 w-12 rounded-lg border border-border/20 bg-background px-1.5 text-center text-xs text-foreground outline-none transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/5"
            aria-label={ctrl.t('input.imageCountLabel')}
        />
    </div>
));
ImageCountPanel.displayName = 'ImageCountPanel';

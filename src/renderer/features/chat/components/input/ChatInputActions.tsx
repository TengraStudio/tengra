import { Mic, MicOff, Paperclip, Send, Sparkles, Square } from 'lucide-react';
import { memo } from 'react';

import { ModelSelector } from '@/components/shared/ModelSelector';
import { cn } from '@/lib/utils';

import { useChatInputController } from '../../hooks/useChatInputController';

type ControllerType = ReturnType<typeof useChatInputController>;

export const ModelSelectorWrapper = memo(({ ctrl }: { ctrl: ControllerType }) => (
    <div data-testid="model-selector">
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
            onOpenChange={ctrl.setIsModelMenuOpen}
            contextTokens={ctrl.contextTokens}
            language={ctrl.language}
            toggleFavorite={ctrl.toggleFavorite}
            isFavorite={ctrl.isFavorite}
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
            onThinkingLevelChange={level =>
                ctrl.setModelReasoningLevel?.(ctrl.selectedModel, level)
            }
        />
    </div>
));
ModelSelectorWrapper.displayName = 'ModelSelectorWrapper';

export const EnhanceButton = memo(({ ctrl }: { ctrl: ControllerType }) => {
    const isEnhancable = ctrl.input.trim() !== '' && !ctrl.isLoading;
    const isEnhancing = ctrl.isEnhancing;
    const btnClass = cn(
        'p-2 rounded-lg transition-all duration-200 flex items-center justify-center mb-0.5',
        isEnhancing
            ? 'bg-warning/20 text-warning animate-pulse'
            : isEnhancable
                ? 'bg-warning/10 text-warning hover:bg-warning/20 hover:text-warning-light'
                : 'bg-muted/30 text-muted-foreground/50 cursor-not-allowed'
    );
    return (
        <button
            type="button"
            onClick={() => {
                void ctrl.handleEnhancePrompt();
            }}
            disabled={!isEnhancable || isEnhancing}
            className={btnClass}
            title={ctrl.t('input.enhancePrompt')}
            aria-label={ctrl.t('input.enhancePrompt')}
        >
            <Sparkles size={18} className={cn(isEnhancing && 'animate-spin')} aria-hidden="true" />
        </button>
    );
});
EnhanceButton.displayName = 'EnhanceButton';

export const SendButton = memo(({ ctrl }: { ctrl: ControllerType }) => {
    const hasContent = ctrl.input.trim() !== '' || ctrl.attachments.length > 0;
    const isLoading = ctrl.isLoading;
    const btnClass = cn(
        'p-2 rounded-lg transition-all duration-200 flex items-center justify-center mb-0.5',
        isLoading
            ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
            : hasContent
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity'
                : 'bg-muted/30 text-muted-foreground/50 cursor-not-allowed'
    );
    return (
        <button
            type="button"
            onClick={
                isLoading
                    ? ctrl.stopGeneration
                    : () => {
                        void ctrl.sendMessageWithTelemetry();
                    }
            }
            disabled={!isLoading && !hasContent}
            className={btnClass}
            aria-label={isLoading ? ctrl.t('common.stop') : ctrl.t('common.send')}
            aria-busy={isLoading}
            aria-live="polite"
        >
            <SendIcon isLoading={isLoading} hasContent={hasContent} />
        </button>
    );
});
SendButton.displayName = 'SendButton';

const SendIcon = memo(({ isLoading, hasContent }: { isLoading: boolean; hasContent: boolean }) => {
    const Icon = isLoading ? Square : Send;
    const colorFill = isLoading ? 'currentColor' : 'none';
    const iClass = cn(isLoading && 'animate-pulse', !isLoading && hasContent && 'ml-0.5');
    return <Icon size={18} fill={colorFill} className={iClass} aria-hidden="true" />;
});
SendIcon.displayName = 'SendIcon';

export const VoiceButton = memo(({ ctrl }: { ctrl: ControllerType }) => (
    <button
        type="button"
        onClick={ctrl.isListening ? ctrl.stopListening : ctrl.startListening}
        className={cn(
            'p-2 rounded-lg transition-all',
            ctrl.isListening
                ? 'bg-destructive/20 text-destructive animate-pulse'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
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
            <MicOff size={20} aria-hidden="true" />
        ) : (
            <Mic size={20} aria-hidden="true" />
        )}
    </button>
));
VoiceButton.displayName = 'VoiceButton';

export const AttachButton = memo(({ onClick, ctrl }: { onClick: () => void; ctrl: ControllerType }) => (
    <button
        type="button"
        onClick={onClick}
        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
        title={ctrl.t('input.attachFile')}
        aria-label={ctrl.t('input.attachFile')}
    >
        <Paperclip size={20} aria-hidden="true" />
    </button>
));
AttachButton.displayName = 'AttachButton';

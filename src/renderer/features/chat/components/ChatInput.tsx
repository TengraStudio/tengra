import { X } from 'lucide-react';
import React, { memo, useEffect, useRef } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import { useChatInputController } from '../hooks/useChatInputController';

import { AttachmentList } from './input/AttachmentList';
import {
    AttachButton,
    ComposerStateBadges,
    EnhanceButton,
    ImageCountPanel,
    ModelSelectorWrapper,
    SendButton,
    VoiceButton
} from './input/ChatInputActions';
import { PromptCommandMenu } from './input/PromptCommandMenu';

interface ChatInputProps {
    fileInputRef?: React.RefObject<HTMLInputElement>;
    textareaRef?: React.RefObject<HTMLTextAreaElement>;
    showFileMenu?: boolean;
    setShowFileMenu?: (show: boolean) => void;
}

/**
 * ChatInput - Redesigned minimal chat input component
 * Following NASA Power of Ten rules for simplicity.
 */
export const ChatInput: React.FC<ChatInputProps> = memo(
    ({ 
        fileInputRef: externalFileInputRef, 
        textareaRef: externalTextareaRef,
        showFileMenu: _showFileMenu,
        setShowFileMenu: _setShowFileMenu
    }) => {
        const ctrl = useChatInputController();
        const { t } = useTranslation();

        const localFileInputRef = useRef<HTMLInputElement>(null);
        const localTextareaRef = useRef<HTMLTextAreaElement>(null);
        const fileInputRef = externalFileInputRef ?? localFileInputRef;
        const textareaRef = externalTextareaRef ?? localTextareaRef;

        // Auto-resize textarea effect
        useEffect(() => {
            const area = textareaRef.current;
            if (!area) {
                return;
            }

            const resize = () => {
                const viewportHeight = window.innerHeight;
                const maxHeight = Math.min(200, Math.max(100, viewportHeight * 0.3));
                area.style.height = 'auto';
                area.style.height = `${Math.min(area.scrollHeight, maxHeight)}px`;
            };

            resize();
            const resizeObserver = new ResizeObserver(resize);
            resizeObserver.observe(area);
            window.addEventListener('resize', resize);

            return () => {
                resizeObserver.disconnect();
                window.removeEventListener('resize', resize);
            };
        }, [ctrl.input, textareaRef]);

        const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            const newValue = e.target.value;
            ctrl.setInput(newValue);
            
            const lastWord = newValue.split(' ').pop() ?? '';
            if (lastWord.startsWith('/')) {
                ctrl.setShowCommandMenu(true);
                ctrl.setSelectedIndex(0);
                ctrl.setCommandQuery(lastWord.slice(1));
            } else if (ctrl.showCommandMenu) {
                ctrl.setShowCommandMenu(false);
            }
        };

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (ctrl.showCommandMenu && ctrl.filteredPrompts.length > 0) {
                if (ctrl.handleCommandNavigation(e)) {
                    return;
                }
            }

            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const hasContent = ctrl.input.trim() !== '' || ctrl.attachments.length > 0;
                if (!ctrl.isLoading && hasContent) {
                    void ctrl.sendMessageWithTelemetry();
                }
            }
        };

        const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const firstFile = e.target.files ? e.target.files[0] : null;
            if (firstFile) {
                void ctrl.processFile(firstFile);
                e.target.value = '';
            }
        };

        return (
            <div
                role="group"
                aria-label={t('aria.chatInput')}
                className={cn('relative z-30 px-3 pb-4 pt-1 sm:px-6 sm:pb-6', ctrl.isDragging && 'bg-primary/5')}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); ctrl.setIsDragging(true); }}
                onDragLeave={e => { e.preventDefault(); e.stopPropagation(); ctrl.setIsDragging(false); }}
                onDrop={ctrl.onDrop}
            >
                {ctrl.lastError && (
                    <div role="status" aria-live="polite" className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive animate-in fade-in slide-in-from-top-1">
                        <span>{ctrl.t(ctrl.lastError.messageKey)}</span>
                        <button type="button" onClick={ctrl.clearLastError} className="p-1 rounded-md hover:bg-destructive/10 transition-colors" aria-label={ctrl.t('common.close')}><X size={12} aria-hidden="true" /></button>
                    </div>
                )}

                <PromptCommandMenu
                    show={ctrl.showCommandMenu && ctrl.filteredPrompts.length > 0}
                    prompts={ctrl.filteredPrompts}
                    selectedIndex={ctrl.selectedIndex}
                    onSelect={prompt => {
                        const words = ctrl.input.split(' ');
                        words.pop();
                        ctrl.setInput(words.join(' ') + (words.length > 0 ? ' ' : '') + prompt.content);
                        ctrl.setShowCommandMenu(false);
                    }}
                    t={ctrl.t}
                />

                <div className={cn(
                    'group flex flex-col relative overflow-hidden rounded-[24px] border border-border/40 bg-background/95 transition-all duration-300 shadow-sm',
                    'focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/5 focus-within:shadow-md',
                    ctrl.isDragging && 'border-primary/45 bg-primary/5'
                )}>
                    <div className="px-4 pt-4">
                        {ctrl.isImageOnlyModel && <ImageCountPanel ctrl={ctrl} />}
                        <Textarea
                            data-testid="chat-textarea"
                            ref={textareaRef}
                            value={ctrl.input}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder={ctrl.t('input.placeholder.default')}
                            className="min-h-[44px] max-h-60 resize-none overflow-y-auto border-0 bg-transparent px-0 py-1 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50"
                            rows={1}
                            aria-label={ctrl.t('input.placeholder.default')}
                            role="combobox"
                            aria-expanded={ctrl.showCommandMenu && ctrl.filteredPrompts.length > 0}
                        />
                    </div>

                    <div className="px-4">
                        <AttachmentList attachments={ctrl.attachments} onRemove={ctrl.removeAttachment} t={ctrl.t} />
                    </div>

                    <div className="flex items-center justify-between px-2 pb-2 pt-1 transition-all">
                        <div className="flex items-center gap-1.5 pl-1.5">
                            <ModelSelectorWrapper ctrl={ctrl} />
                            <div className="flex items-center gap-0.5">
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple={false} />
                                <AttachButton onClick={() => fileInputRef.current?.click()} ctrl={ctrl} />
                                <VoiceButton ctrl={ctrl} />
                            </div>
                            <ComposerStateBadges ctrl={ctrl} />
                        </div>
                        <div className="flex items-center gap-1.5 pr-1.5">
                            <EnhanceButton ctrl={ctrl} />
                            <SendButton ctrl={ctrl} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
);

ChatInput.displayName = 'ChatInput';

/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconX } from '@tabler/icons-react';
import React, { memo, useEffect, useRef } from 'react';

import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
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

/* Batch-02: Extracted Long Classes */
const C_CHATINPUT_1 = "mb-2.5 flex items-center justify-between gap-2 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 typo-caption text-destructive animate-in fade-in slide-in-from-top-1";
const C_CHATINPUT_2 = "min-h-11 max-h-60 resize-none overflow-y-auto border-0 bg-transparent px-0 py-1 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50";


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
        const antigravityCreditConfirmation = ctrl.antigravityCreditConfirmation ?? {
            isOpen: false,
            title: '',
            message: '',
            confirmLabel: '',
        };
        const cancelAntigravityCreditUsage = ctrl.cancelAntigravityCreditUsage ?? (() => undefined);
        const confirmAntigravityCreditUsage = ctrl.confirmAntigravityCreditUsage ?? (() => undefined);

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
                className={cn('relative z-30 px-2 pb-3 pt-1 sm:px-4 sm:pb-4', ctrl.isDragging && 'bg-primary/5')}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); ctrl.setIsDragging(true); }}
                onDragLeave={e => { e.preventDefault(); e.stopPropagation(); ctrl.setIsDragging(false); }}
                onDrop={ctrl.onDrop}
            >
                {ctrl.lastError && (
                    <div role="status" aria-live="polite" className={C_CHATINPUT_1}>
                        <span>{ctrl.t(ctrl.lastError.messageKey)}</span>
                        <button type="button" onClick={ctrl.clearLastError} className="p-1 rounded-md hover:bg-destructive/10 transition-colors" aria-label={ctrl.t('common.close')}><IconX size={12} aria-hidden="true" /></button>
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
                    'group relative flex flex-col overflow-hidden rounded-lg border border-border/50 bg-background transition-colors duration-200',
                    'focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-ring',
                    ctrl.isDragging && 'border-primary/45 bg-primary/5'
                )}>
                    <div className="px-3 pt-3">
                        {ctrl.isImageOnlyModel && <ImageCountPanel ctrl={ctrl} />}
                        <Textarea
                            data-testid="chat-textarea"
                            ref={textareaRef}
                            value={ctrl.input}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder={ctrl.t('input.placeholder.default')}
                            className={C_CHATINPUT_2}
                            rows={1}
                            aria-label={ctrl.t('input.placeholder.default')}
                            role="combobox"
                            aria-expanded={ctrl.showCommandMenu && ctrl.filteredPrompts.length > 0}
                        />
                    </div>

                    <div className="px-3">
                        <AttachmentList attachments={ctrl.attachments} onRemove={ctrl.removeAttachment} t={ctrl.t} />
                    </div>

                    <div className="flex items-center justify-between px-2.5 pb-2 pt-1 transition-all">
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

                <ConfirmationModal
                    isOpen={antigravityCreditConfirmation.isOpen}
                    onClose={cancelAntigravityCreditUsage}
                    onConfirm={confirmAntigravityCreditUsage}
                    title={antigravityCreditConfirmation.title}
                    message={antigravityCreditConfirmation.message}
                    confirmLabel={antigravityCreditConfirmation.confirmLabel}
                    variant="warning"
                />
            </div>
        );
    }
);

ChatInput.displayName = 'ChatInput';

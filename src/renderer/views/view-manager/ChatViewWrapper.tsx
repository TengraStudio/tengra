/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { lazy, memo, Suspense } from 'react';

import { LoadingState } from '@/components/ui/LoadingState';
import { ChatTemplate } from '@/features/chat/types';

const ChatView = lazy(() => import('@/features/chat/components/ChatView').then(m => ({ default: m.ChatView })));

interface ChatViewWrapperProps {
    templates: ChatTemplate[]
    messagesEndRef: React.RefObject<HTMLDivElement>
    fileInputRef: React.RefObject<HTMLInputElement>
    textareaRef: React.RefObject<HTMLTextAreaElement>
    onScrollToBottom: () => void
    showScrollButton: boolean
    setShowScrollButton: (show: boolean) => void
    showFileMenu: boolean
    setShowFileMenu: (show: boolean) => void
}

export const ChatViewWrapper: React.FC<ChatViewWrapperProps> = memo(({
    templates,
    messagesEndRef,
    fileInputRef,
    textareaRef,
    onScrollToBottom,
    showScrollButton,
    setShowScrollButton,
    showFileMenu,
    setShowFileMenu
}) => {
    return (
        <Suspense fallback={<LoadingState size="md" />}>
            <ChatView
                templates={templates}
                messagesEndRef={messagesEndRef}
                fileInputRef={fileInputRef}
                textareaRef={textareaRef}
                onScrollToBottom={onScrollToBottom}
                showScrollButton={showScrollButton}
                setShowScrollButton={setShowScrollButton}
                showFileMenu={showFileMenu}
                setShowFileMenu={setShowFileMenu}
            />
        </Suspense>
    );
});

ChatViewWrapper.displayName = 'ChatViewWrapper';


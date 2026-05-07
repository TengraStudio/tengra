/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Sidebar } from '@/components/layout/Sidebar';

vi.mock('@/context/ChatContext', () => ({
    useChatLibrary: () => ({
        chats: [],
        currentChatId: null,
        setCurrentChatId: vi.fn(),
        deleteChat: vi.fn(),
        updateChat: vi.fn(),
        folders: [],
        createFolder: vi.fn(),
        deleteFolder: vi.fn(),
        prompts: [],
        createPrompt: vi.fn(),
        updatePrompt: vi.fn(),
        deletePrompt: vi.fn(),
        togglePin: vi.fn(),
        bulkDeleteChats: vi.fn(),
    }),
    useChatShell: () => ({
        chatsCount: 0,
        createNewChat: vi.fn(),
    }),
}));

vi.mock('@/context/WorkspaceContext', () => ({
    useWorkspaceSelection: () => ({
        selectedWorkspace: null,
    }),
}));

vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        language: 'en',
    }),
}));

vi.mock('@/features/prompts/components/PromptManagerModal', () => ({
    PromptManagerModal: () => null,
}));

describe('Sidebar', () => {
    it('renders application sidebar landmark', () => {
        render(
            <Sidebar
                isCollapsed={false}
                toggleSidebar={vi.fn()}
                currentView={'chat'}
                onChangeView={vi.fn()}
                onSearch={vi.fn()}
            />
        );

        expect(screen.getByLabelText('aria.applicationSidebar')).toBeInTheDocument();
    });
});


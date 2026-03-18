import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Sidebar } from '@/components/layout/Sidebar';

vi.mock('@/context/ChatContext', () => ({
    useChat: () => ({
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
    useWorkspace: () => ({
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
                onOpenSettings={vi.fn()}
                onSearch={vi.fn()}
            />
        );

        expect(screen.getByLabelText('aria.applicationSidebar')).toBeInTheDocument();
    });
});

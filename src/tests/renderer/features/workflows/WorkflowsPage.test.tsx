import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkflowsPage } from '@/features/workflows/WorkflowsPage';
import { Workflow } from '@/types/workflow.types';

vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, params?: Record<string, unknown>) => {
            if (params && 'workflowId' in params) {return `${key}:${String(params.workflowId)}`;}
            return key;
        },
    }),
}));

vi.mock('@/store/notification-center.store', () => ({
    pushNotification: vi.fn(),
}));

vi.mock('@/utils/renderer-logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

const mockWorkflows: Workflow[] = [
    {
        id: 'wf-1',
        name: 'Deploy Workflow',
        description: 'Auto deploy',
        enabled: true,
        triggers: [],
        steps: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
    },
    {
        id: 'wf-2',
        name: 'Test Workflow',
        description: 'Run tests',
        enabled: false,
        triggers: [],
        steps: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
    },
];

describe('WorkflowsPage', () => {
    beforeEach(() => {
        window.electron = {
            ...window.electron,
            workflow: {
                getAll: vi.fn().mockResolvedValue(mockWorkflows),
                create: vi.fn().mockResolvedValue({ ...mockWorkflows[0], id: 'wf-new' }),
                update: vi.fn().mockImplementation((_id: string, w: Workflow) => Promise.resolve(w)),
                delete: vi.fn().mockResolvedValue(undefined),
                execute: vi.fn().mockResolvedValue({ status: 'success' }),
            },
        } as unknown as typeof window.electron;
    });

    it('should render the page title', async () => {
        render(<WorkflowsPage />);
        expect(screen.getByText('workflows.title')).toBeInTheDocument();
        expect(screen.getByText('workflows.subtitle')).toBeInTheDocument();
    });

    it('should show loading state initially', () => {
        window.electron.workflow.getAll = vi.fn().mockReturnValue(new Promise(() => { /* never resolves */ }));
        render(<WorkflowsPage />);
        expect(screen.getByText('common.loading')).toBeInTheDocument();
    });

    it('should render workflows after loading', async () => {
        render(<WorkflowsPage />);
        await waitFor(() => {
            expect(screen.getByText('Deploy Workflow')).toBeInTheDocument();
            expect(screen.getByText('Test Workflow')).toBeInTheDocument();
        });
    });

    it('should filter workflows by search query', async () => {
        const user = userEvent.setup();
        render(<WorkflowsPage />);

        await waitFor(() => {
            expect(screen.getByText('Deploy Workflow')).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText('workflows.searchPlaceholder');
        await user.type(searchInput, 'Deploy');

        expect(screen.getByText('Deploy Workflow')).toBeInTheDocument();
        expect(screen.queryByText('Test Workflow')).not.toBeInTheDocument();
    });

    it('should show error state when loading fails', async () => {
        window.electron.workflow.getAll = vi.fn().mockRejectedValue(new Error('Network error'));
        render(<WorkflowsPage />);

        await waitFor(() => {
            expect(screen.getByText('workflows.errors.loadFailed')).toBeInTheDocument();
            expect(screen.getByText('Network error')).toBeInTheDocument();
        });
    });

    it('should show empty state when no workflows', async () => {
        window.electron.workflow.getAll = vi.fn().mockResolvedValue([]);
        render(<WorkflowsPage />);

        await waitFor(() => {
            expect(screen.getByText('workflows.noWorkflows')).toBeInTheDocument();
        });
    });
});

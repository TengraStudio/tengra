import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { EditWorkspaceModal } from '@/features/workspace/components/modals/EditWorkspaceModal';
import { Workspace } from '@/types';

const workspaceFixture: Workspace = {
    id: 'workspace-1',
    title: 'Stable Title',
    description: 'Stable Description',
    path: 'C:\\workspaces\\demo-workspace',
    mounts: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    chatIds: [],
    councilConfig: {
        enabled: false,
        members: [],
        consensusThreshold: 0.7,
    },
    status: 'active',
};

const t = (key: string): string => key;

const Harness: React.FC<{ onSubmit: () => Promise<boolean> }> = ({ onSubmit }) => {
    const [form, setForm] = React.useState({
        title: workspaceFixture.title,
        description: workspaceFixture.description,
    });
    return (
        <EditWorkspaceModal
            workspace={workspaceFixture}
            onClose={vi.fn()}
            form={form}
            setForm={setForm}
            onSubmit={onSubmit}
            t={t}
        />
    );
};

describe('EditWorkspaceModal optimistic rollback', () => {
    it('restores the latest persisted workspace metadata when save fails', async () => {
        const onSubmit = vi.fn().mockResolvedValue(false);
        render(<Harness onSubmit={onSubmit} />);

        const input = screen.getByPlaceholderText('workspaces.namePlaceholder');
        fireEvent.change(input, { target: { value: 'Unpersisted title' } });
        fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledTimes(1);
            expect(screen.getByDisplayValue('Stable Title')).toBeInTheDocument();
        });
    });
});

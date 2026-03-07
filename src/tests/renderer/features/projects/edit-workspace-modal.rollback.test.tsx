import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { EditProjectModal as EditWorkspaceModal } from '@/features/workspace/components/modals/EditProjectModal';
import { Project } from '@/types';

const projectFixture: Project = {
    id: 'project-1',
    title: 'Stable Title',
    description: 'Stable Description',
    path: 'C:\\workspace\\project',
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
        title: projectFixture.title,
        description: projectFixture.description,
    });
    return (
        <EditWorkspaceModal
            project={projectFixture}
            onClose={vi.fn()}
            form={form}
            setForm={setForm}
            onSubmit={onSubmit}
            t={t}
        />
    );
};

describe('EditWorkspaceModal optimistic rollback', () => {
    it('restores the latest persisted project metadata when save fails', async () => {
        const onSubmit = vi.fn().mockResolvedValue(false);
        render(<Harness onSubmit={onSubmit} />);

        const input = screen.getByPlaceholderText('projects.namePlaceholder');
        fireEvent.change(input, { target: { value: 'Unpersisted title' } });
        fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledTimes(1);
            expect(screen.getByDisplayValue('Stable Title')).toBeInTheDocument();
        });
    });
});

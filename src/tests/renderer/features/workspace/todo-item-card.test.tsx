import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TodoItemCard } from '@/features/workspace/components/todo/TodoItemCard';

describe('TodoItemCard', () => {
    it('triggers undo/redo actions without toggling the todo item', () => {
        const onToggle = vi.fn();
        const onUndo = vi.fn();
        const onRedo = vi.fn();

        render(
            <TodoItemCard
                todo={{
                    id: 'todo-1',
                    text: 'Write test',
                    completed: false,
                    line: 4,
                    filePath: 'C:\\workspace\\TODO.md',
                    relativePath: 'TODO.md',
                }}
                onToggle={onToggle}
                t={(key: string) =>
                    key === 'workspace.todoUndoTitle' ? 'Undo (Ctrl/Cmd+Z)' : 'Redo (Ctrl/Cmd+Y)'
                }
                onUndo={onUndo}
                onRedo={onRedo}
                canUndo
                canRedo
            />
        );

        fireEvent.click(screen.getByTitle('Undo (Ctrl/Cmd+Z)'));
        fireEvent.click(screen.getByTitle('Redo (Ctrl/Cmd+Y)'));

        expect(onUndo).toHaveBeenCalledTimes(1);
        expect(onRedo).toHaveBeenCalledTimes(1);
        expect(onToggle).not.toHaveBeenCalled();
    });
});

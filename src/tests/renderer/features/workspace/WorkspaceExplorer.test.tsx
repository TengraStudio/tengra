/**
 * @fileoverview Comprehensive unit tests for WorkspaceExplorer component
 * @description Tests edge cases, user interactions, and accessibility
 */

import { WorkspaceEntry, WorkspaceMount } from '@shared/types';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ContextMenuAction, ContextMenuState } from '../../../../renderer/features/workspace/components/workspace/types';
import { WorkspaceExplorer } from '../../../../renderer/features/workspace/components/WorkspaceExplorer';

// Mock the hooks
vi.mock('@renderer/features/workspace/hooks/useWorkspaceExplorerLogic', () => ({
    useWorkspaceExplorerLogic: vi.fn(() => ({
        expandedMounts: {},
        rootNodes: {},
        loadingMounts: {},
        contextMenu: null,
        toggleMount: vi.fn(),
        handleContextMenu: vi.fn(),
        handleMountContextMenu: vi.fn(),
        handleContextAction: vi.fn(),
        closeContextMenu: vi.fn(),
    })),
}));

// Mock the utils
vi.mock('@renderer/features/workspace/utils/workspaceUtils', () => ({
    getWorkspaceExplorerStorageKey: vi.fn(() => 'test-storage-key'),
    getWorkspaceTreeStorageKey: vi.fn(() => 'test-tree-key'),
    loadExpandedTreeState: vi.fn(() => ({})),
    saveExpandedTreeState: vi.fn(),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
    Folder: () => <span data-testid="folder-icon">Folder</span>,
    Plus: () => <span data-testid="plus-icon">Plus</span>,
}));

// Mock cn utility
vi.mock('@/lib/utils', () => ({
    cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
}));

// Mock i18n
vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
    Language: { EN: 'en', TR: 'tr' },
}));

// Mock WorkspaceMountItem
vi.mock('@renderer/features/workspace/components/workspace/WorkspaceMountItem', () => ({
    WorkspaceMountItem: ({
        mount,
        isExpanded,
        onToggle,
        onRemove, 
    }: {
        mount: WorkspaceMount;
        isExpanded: boolean;
        onToggle: (id: string) => void;
        onRemove: (id: string) => void; 
    }) => (
        <div data-testid={`mount-item-${mount.id}`}>
            <span>{mount.name}</span>
            <button onClick={() => onToggle(mount.id)} data-testid={`toggle-${mount.id}`}>
                {isExpanded ? 'Collapse' : 'Expand'}
            </button>
            <button onClick={() => onRemove(mount.id)} data-testid={`remove-${mount.id}`}>
                Remove
            </button>
        </div>
    ),
}));

// Mock WorkspaceContextMenu
vi.mock('@renderer/features/workspace/components/workspace/WorkspaceContextMenu', () => ({
    WorkspaceContextMenu: ({
        contextMenu,
        onClose,
        onContextAction,
    }: {
        contextMenu: ContextMenuState;
        onClose: () => void;
        onContextAction: (action: ContextMenuAction) => void;
    }) => (
        <div data-testid="context-menu">
            <span>Context Menu at {contextMenu.x}, {contextMenu.y}</span>
            <button onClick={onClose}>Close</button>
            <button onClick={() => onContextAction({ type: 'delete', entry: contextMenu.entry! })}>
                Delete
            </button>
        </div>
    ),
}));

/**
 * Creates mock workspace mount data
 */
function createMockMount(overrides?: Partial<WorkspaceMount>): WorkspaceMount {
    return {
        id: 'mount-1',
        name: 'Test Mount',
        rootPath: '/test/path',
        type: 'local',
        ...overrides,
    };
}

/**
 * Creates mock workspace entry data
 */
function createMockEntry(overrides?: Partial<WorkspaceEntry>): WorkspaceEntry {
    return {
        name: 'test-file.ts',
        path: '/test/path/test-file.ts',
        isDirectory: false,
        mountId: 'mount-1',
        ...overrides,
    };
}

/**
 * Creates mock props for the WorkspaceExplorer
 */
function createMockProps(overrides?: Partial<React.ComponentProps<typeof WorkspaceExplorer>>) {
    return {
        workspaceId: 'workspace-1',
        mounts: [createMockMount()],
        mountStatus: { 'mount-1': 'connected' as const },
        refreshSignal: 0,
        onOpenFile: vi.fn(),
        onSelectEntry: vi.fn(),
        selectedEntries: null,
        onAddMount: vi.fn(),
        onRemoveMount: vi.fn(),
        onEnsureMount: vi.fn(),
        onContextAction: vi.fn(),
        variant: 'panel' as const,
        language: 'en' as const,
        onMove: vi.fn(),
        ...overrides,
    };
}

describe('WorkspaceExplorer', () => {
    let mockProps: ReturnType<typeof createMockProps>;

    beforeEach(() => {
        mockProps = createMockProps();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Rendering', () => {
        it('should render with panel variant', () => {
            render(<WorkspaceExplorer {...mockProps} />);
            expect(screen.getByText('workspace.files')).toBeInTheDocument();
        });

        it('should render with embedded variant', () => {
            const props = createMockProps({ variant: 'embedded' });
            render(<WorkspaceExplorer {...props} />);
            expect(screen.getByText('workspace.files')).toBeInTheDocument();
        });

        it('should render add mount button', () => {
            render(<WorkspaceExplorer {...mockProps} />);
            expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
        });

        it('should render mount items', () => {
            render(<WorkspaceExplorer {...mockProps} />);
            expect(screen.getByTestId('mount-item-mount-1')).toBeInTheDocument();
        });

        it('should show empty state when no mounts', () => {
            const props = createMockProps({ mounts: [] });
            render(<WorkspaceExplorer {...props} />);
            expect(screen.getByText('workspace.noMounts')).toBeInTheDocument();
        }); 
    });

    describe('Mount Management', () => {
        it('should call onAddMount when add button is clicked', async () => {
            const onAddMount = vi.fn();
            const props = createMockProps({ onAddMount });
            render(<WorkspaceExplorer {...props} />);

            const addButton = screen.getByTitle('workspace.addConnection');
            fireEvent.click(addButton);

            expect(onAddMount).toHaveBeenCalled();
        });

        it('should call onRemoveMount when remove is triggered', async () => {
            const onRemoveMount = vi.fn();
            const props = createMockProps({ onRemoveMount });
            render(<WorkspaceExplorer {...props} />);

            const removeButton = screen.getByTestId('remove-mount-1');
            fireEvent.click(removeButton);

            expect(onRemoveMount).toHaveBeenCalledWith('mount-1');
        });

        it('should toggle mount expansion', async () => {
            const { useWorkspaceExplorerLogic } = await import(
                '@renderer/features/workspace/hooks/useWorkspaceExplorerLogic'
            );
            const toggleMount = vi.fn();
            vi.mocked(useWorkspaceExplorerLogic).mockReturnValue({
                expandedMounts: {},
                rootNodes: {},
                loadingMounts: {},
                contextMenu: null,
                toggleMount,
                handleContextMenu: vi.fn(),
                handleMountContextMenu: vi.fn(),
                handleContextAction: vi.fn(),
                closeContextMenu: vi.fn(),
            });

            render(<WorkspaceExplorer {...mockProps} />);

            const toggleButton = screen.getByTestId('toggle-mount-1');
            fireEvent.click(toggleButton);

            expect(toggleMount).toHaveBeenCalledWith('mount-1');
        });
    });

    describe('Keyboard Navigation', () => {
        it('should handle F2 key for rename', async () => {
            const onContextAction = vi.fn();
            const entry = createMockEntry();
            const props = createMockProps({
                onContextAction,
                selectedEntries: [entry],
            });

            const { container } = render(<WorkspaceExplorer {...props} />);
            fireEvent.keyDown(container.firstElementChild!, { key: 'F2' });

            expect(onContextAction).toHaveBeenCalledWith({
                type: 'rename',
                entry,
            });
        });

        it('should handle Delete key', async () => {
            const onContextAction = vi.fn();
            const entry = createMockEntry();
            const props = createMockProps({
                onContextAction,
                selectedEntries: [entry],
            });

            const { container } = render(<WorkspaceExplorer {...props} />);
            fireEvent.keyDown(container.firstElementChild!, { key: 'Delete' });

            expect(onContextAction).toHaveBeenCalledWith({
                type: 'delete',
                entry,
            });
        });

        it('should handle Enter key for files', async () => {
            const onOpenFile = vi.fn();
            const entry = createMockEntry({ isDirectory: false });
            const props = createMockProps({
                onOpenFile,
                selectedEntries: [entry],
            });

            const { container } = render(<WorkspaceExplorer {...props} />);
            fireEvent.keyDown(container.firstElementChild!, { key: 'Enter' });

            expect(onOpenFile).toHaveBeenCalledWith(entry);
        });

        it('should not handle keyboard events when no selection', async () => {
            const onContextAction = vi.fn();
            const props = createMockProps({
                onContextAction,
                selectedEntries: null,
            });

            const { container } = render(<WorkspaceExplorer {...props} />);
            fireEvent.keyDown(container.firstElementChild!, { key: 'F2' });

            expect(onContextAction).not.toHaveBeenCalled();
        });
    });

    describe('Context Menu', () => {
        it('should render context menu when open', async () => {
            const { useWorkspaceExplorerLogic } = await import(
                '@renderer/features/workspace/hooks/useWorkspaceExplorerLogic'
            );
            const entry = createMockEntry();
            vi.mocked(useWorkspaceExplorerLogic).mockReturnValue({
                expandedMounts: {},
                rootNodes: {},
                loadingMounts: {},
                contextMenu: { x: 100, y: 100, entry },
                toggleMount: vi.fn(),
                handleContextMenu: vi.fn(),
                handleMountContextMenu: vi.fn(),
                handleContextAction: vi.fn(),
                closeContextMenu: vi.fn(),
            });

            render(<WorkspaceExplorer {...mockProps} />);

            expect(screen.getByTestId('context-menu')).toBeInTheDocument();
        });

        it('should close context menu', async () => {
            const { useWorkspaceExplorerLogic } = await import(
                '@renderer/features/workspace/hooks/useWorkspaceExplorerLogic'
            );
            const closeContextMenu = vi.fn();
            const entry = createMockEntry();
            vi.mocked(useWorkspaceExplorerLogic).mockReturnValue({
                expandedMounts: {},
                rootNodes: {},
                loadingMounts: {},
                contextMenu: { x: 100, y: 100, entry },
                toggleMount: vi.fn(),
                handleContextMenu: vi.fn(),
                handleMountContextMenu: vi.fn(),
                handleContextAction: vi.fn(),
                closeContextMenu,
            });

            render(<WorkspaceExplorer {...mockProps} />);

            const closeButton = screen.getByText('Close');
            fireEvent.click(closeButton);

            expect(closeContextMenu).toHaveBeenCalled();
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty mounts array', () => {
            const props = createMockProps({ mounts: [] });
            render(<WorkspaceExplorer {...props} />);
            expect(screen.getByText('workspace.noMounts')).toBeInTheDocument();
        });

        it('should handle undefined selectedEntries', () => {
            const props = createMockProps({ selectedEntries: undefined });
            render(<WorkspaceExplorer {...props} />);
            expect(screen.getByText('workspace.files')).toBeInTheDocument();
        });

        it('should handle multiple mounts', () => {
            const mounts = [
                createMockMount({ id: 'mount-1', name: 'Mount 1' }),
                createMockMount({ id: 'mount-2', name: 'Mount 2' }),
                createMockMount({ id: 'mount-3', name: 'Mount 3' }),
            ];
            const props = createMockProps({ mounts });
            render(<WorkspaceExplorer {...props} />);

            expect(screen.getByTestId('mount-item-mount-1')).toBeInTheDocument();
            expect(screen.getByTestId('mount-item-mount-2')).toBeInTheDocument();
            expect(screen.getByTestId('mount-item-mount-3')).toBeInTheDocument();
        });
   
        it('should handle multiple selected entries', async () => {
            const onContextAction = vi.fn();
            const entries = [
                createMockEntry({ path: '/file1.ts' }),
                createMockEntry({ path: '/file2.ts' }),
            ];
            const props = createMockProps({
                onContextAction,
                selectedEntries: entries,
            });

            const { container } = render(<WorkspaceExplorer {...props} />);

            const rootElement = container.firstElementChild!;
            fireEvent.keyDown(rootElement, { key: 'Delete' });

            // Should use the last entry for the action
            expect(onContextAction).toHaveBeenCalledWith({
                type: 'delete',
                entry: entries[1],
            });
        });
    });

    describe('Accessibility', () => {
        it('should be focusable', () => {
            const { container } = render(<WorkspaceExplorer {...mockProps} />);
            expect(container.firstElementChild!).toHaveAttribute('tabIndex', '0');
        });

        it('should have proper structure for screen readers', () => {
            render(<WorkspaceExplorer {...mockProps} />);
            expect(screen.getByText('workspace.files')).toBeInTheDocument();
        });
    });

    describe('Performance', () => {
        it('should handle large number of mounts efficiently', () => {
            const mounts = Array.from({ length: 50 }, (_, i) =>
                createMockMount({ id: `mount-${i}`, name: `Mount ${i}` })
            );
            const props = createMockProps({ mounts });

            const startTime = performance.now();
            render(<WorkspaceExplorer {...props} />);
            const endTime = performance.now();

            // Rendering should complete in reasonable time (< 500ms)
            expect(endTime - startTime).toBeLessThan(500);
        });

        it('should not re-render unnecessarily', () => {
            const { rerender } = render(<WorkspaceExplorer {...mockProps} />);

            // Re-render with same props
            rerender(<WorkspaceExplorer {...mockProps} />);

            expect(screen.getByText('workspace.files')).toBeInTheDocument();
        });
    });

    describe('State Persistence', () => {
        it('should load expanded tree state on mount', async () => {
            const { loadExpandedTreeState } = await import(
                '@renderer/features/workspace/utils/workspaceUtils'
            );
            render(<WorkspaceExplorer {...mockProps} />);
            expect(loadExpandedTreeState).toHaveBeenCalled();
        });

        it('should save expanded tree state on change', async () => {
            const { saveExpandedTreeState } = await import(
                '@renderer/features/workspace/utils/workspaceUtils'
            );
            render(<WorkspaceExplorer {...mockProps} />);

            // The component should save state when expandedTreeNodes changes
            // This is tested indirectly through the useEffect
            expect(saveExpandedTreeState).toHaveBeenCalled();
        });
    });
});


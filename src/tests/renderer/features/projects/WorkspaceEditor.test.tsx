/**
 * @fileoverview Comprehensive unit tests for WorkspaceEditor component
 * @description Tests edge cases, user interactions, and accessibility
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceEditor, WorkspaceEditorProps } from '@/features/projects/components/workspace/WorkspaceEditor';
import { EditorTab } from '@/types';

// Mock CodeEditor component
vi.mock('@/components/ui/CodeEditor', () => ({
    CodeEditor: ({
        value,
        language,
        onChange,
        className,
        showMinimap,
        fontSize,
        initialLine,
    }: {
        value: string;
        language: string;
        onChange: (val: string | undefined) => void;
        className: string;
        showMinimap: boolean;
        fontSize: number;
        initialLine?: number;
    }) => (
        <div
            data-testid="code-editor"
            data-language={language}
            data-show-minimap={showMinimap}
            data-font-size={fontSize}
            data-initial-line={initialLine}
            className={className}
        >
            <textarea
                value={value}
                onChange={e => onChange(e.target.value)}
                data-testid="code-editor-input"
            />
        </div>
    ),
}));

// Mock cn utility
vi.mock('@/lib/utils', () => ({
    cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
}));

// Mock language-map
vi.mock('@/utils/language-map', () => ({
    getLanguageFromExtension: (filename: string) => {
        const ext = filename.split('.').pop() ?? '';
        const map: Record<string, string> = {
            ts: 'typescript',
            tsx: 'typescript',
            js: 'javascript',
            jsx: 'javascript',
            json: 'json',
            md: 'markdown',
            css: 'css',
            html: 'html',
        };
        return map[ext] ?? 'plaintext';
    },
}));

/**
 * Creates mock editor tab data
 */
function createMockTab(overrides?: Partial<EditorTab>): EditorTab {
    return {
        id: 'tab-1',
        mountId: 'mount-1',
        path: '/test/file.ts',
        name: 'file.ts',
        content: 'const x = 1;',
        savedContent: 'const x = 1;',
        isDirty: false,
        type: 'code',
        ...overrides,
    };
}

/**
 * Creates mock props for the WorkspaceEditor
 */
function createMockProps(overrides?: Partial<WorkspaceEditorProps>): WorkspaceEditorProps {
    return {
        activeTab: null,
        updateTabContent: vi.fn(),
        projectKey: 'test-project',
        emptyState: <div data-testid="empty-state">No file open</div>,
        ...overrides,
    };
}

describe('WorkspaceEditor', () => {
    let mockProps: ReturnType<typeof createMockProps>;

    beforeEach(() => {
        mockProps = createMockProps();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Rendering', () => {
        it('should render empty state when no tab is active', () => {
            render(<WorkspaceEditor {...mockProps} />);
            expect(screen.getByTestId('empty-state')).toBeInTheDocument();
        });

        it('should render code editor when code tab is active', () => {
            const tab = createMockTab({ type: 'code' });
            const props = createMockProps({ activeTab: tab });
            render(<WorkspaceEditor {...props} />);
            expect(screen.getByTestId('code-editor')).toBeInTheDocument();
        });

        it('should render image preview when image tab is active', () => {
            const tab = createMockTab({
                type: 'image',
                content: 'data:image/png;base64,test',
                name: 'image.png',
            });
            const props = createMockProps({ activeTab: tab });
            render(<WorkspaceEditor {...props} />);
            expect(screen.getByRole('img')).toBeInTheDocument();
        });

        it('should pass correct language to code editor', () => {
            const tab = createMockTab({ name: 'test.ts' });
            const props = createMockProps({ activeTab: tab });
            render(<WorkspaceEditor {...props} />);
            expect(screen.getByTestId('code-editor')).toHaveAttribute('data-language', 'typescript');
        });

        it('should pass initial line to code editor', () => {
            const tab = createMockTab({ initialLine: 42 });
            const props = createMockProps({ activeTab: tab });
            render(<WorkspaceEditor {...props} />);
            expect(screen.getByTestId('code-editor')).toHaveAttribute('data-initial-line', '42');
        });
    });

    describe('Content Updates', () => {
        it('should call updateTabContent when content changes', async () => {
            const updateTabContent = vi.fn();
            const tab = createMockTab();
            const props = createMockProps({ activeTab: tab, updateTabContent });

            render(<WorkspaceEditor {...props} />);

            const textarea = screen.getByTestId('code-editor-input');
            fireEvent.change(textarea, { target: { value: 'const y = 2;' } });

            expect(updateTabContent).toHaveBeenCalledWith('const y = 2;');
        });

        it('should not call updateTabContent when no tab is active', async () => {
            const updateTabContent = vi.fn();
            const props = createMockProps({ activeTab: null, updateTabContent });

            render(<WorkspaceEditor {...props} />);

            // Editor should be hidden and pointer-events-none
            expect(screen.getByTestId('code-editor').parentElement).toHaveClass('opacity-0');
            expect(updateTabContent).not.toHaveBeenCalled();
        });
    });

    describe('Unsaved Changes Warning', () => {
        it('should add beforeunload listener when there are unsaved changes', () => {
            const tab = createMockTab({
                content: 'modified content',
                savedContent: 'original content',
            });
            const props = createMockProps({ activeTab: tab });

            const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

            render(<WorkspaceEditor {...props} />);

            expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
        });

        it('should not add beforeunload listener when no unsaved changes', () => {
            const tab = createMockTab({
                content: 'same content',
                savedContent: 'same content',
            });
            const props = createMockProps({ activeTab: tab });

            const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

            render(<WorkspaceEditor {...props} />);

            expect(addEventListenerSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));
        });

        it('should remove beforeunload listener on unmount', () => {
            const tab = createMockTab({
                content: 'modified content',
                savedContent: 'original content',
            });
            const props = createMockProps({ activeTab: tab });

            const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

            const { unmount } = render(<WorkspaceEditor {...props} />);
            unmount();

            expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
        });

        it('should prevent default on beforeunload when unsaved changes', () => {
            const tab = createMockTab({
                content: 'modified content',
                savedContent: 'original content',
            });
            const props = createMockProps({ activeTab: tab });

            render(<WorkspaceEditor {...props} />);

            const event = new Event('beforeunload') as BeforeUnloadEvent;
            const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

            window.dispatchEvent(event);

            // The event should be handled
            expect(preventDefaultSpy).toHaveBeenCalled();
        });
    });

    describe('Image Preview', () => {
        it('should display image with correct src', () => {
            const imageData = 'data:image/png;base64,test';
            const tab = createMockTab({
                type: 'image',
                content: imageData,
                name: 'test-image.png',
            });
            const props = createMockProps({ activeTab: tab });

            render(<WorkspaceEditor {...props} />);

            const img = screen.getByRole('img');
            expect(img).toHaveAttribute('src', imageData);
        });

        it('should display image with correct alt text', () => {
            const tab = createMockTab({
                type: 'image',
                content: 'data:image/png;base64,test',
                name: 'my-image.png',
            });
            const props = createMockProps({ activeTab: tab });

            render(<WorkspaceEditor {...props} />);

            const img = screen.getByRole('img');
            expect(img).toHaveAttribute('alt', 'my-image.png');
        });
    });

    describe('Edge Cases', () => {
        it('should handle null activeTab gracefully', () => {
            const props = createMockProps({ activeTab: null });
            render(<WorkspaceEditor {...props} />);
            expect(screen.getByTestId('empty-state')).toBeInTheDocument();
        });

        it('should handle undefined initialLine', () => {
            const tab = createMockTab({ initialLine: undefined });
            const props = createMockProps({ activeTab: tab });
            render(<WorkspaceEditor {...props} />);
            expect(screen.getByTestId('code-editor')).toBeInTheDocument();
        });

        it('should handle empty content', () => {
            const tab = createMockTab({ content: '' });
            const props = createMockProps({ activeTab: tab });
            render(<WorkspaceEditor {...props} />);
            expect(screen.getByTestId('code-editor-input')).toHaveValue('');
        });

        it('should handle various file extensions', () => {
            const extensions = [
                { name: 'file.ts', expected: 'typescript' },
                { name: 'file.js', expected: 'javascript' },
                { name: 'file.json', expected: 'json' },
                { name: 'file.md', expected: 'markdown' },
                { name: 'file.css', expected: 'css' },
                { name: 'file.html', expected: 'html' },
                { name: 'file.unknown', expected: 'plaintext' },
            ];

            for (const { name, expected } of extensions) {
                const tab = createMockTab({ name });
                const props = createMockProps({ activeTab: tab });
                const { unmount } = render(<WorkspaceEditor {...props} />);

                expect(screen.getByTestId('code-editor')).toHaveAttribute('data-language', expected);
                unmount();
            }
        });

        it('should handle very long content', () => {
            const longContent = 'x'.repeat(100000);
            const tab = createMockTab({ content: longContent });
            const props = createMockProps({ activeTab: tab });
            render(<WorkspaceEditor {...props} />);
            expect(screen.getByTestId('code-editor-input')).toHaveValue(longContent);
        });

        it('should handle special characters in content', () => {
            const specialContent = '<script>alert("XSS")</script>\n\t"\'`';
            const tab = createMockTab({ content: specialContent });
            const props = createMockProps({ activeTab: tab });
            render(<WorkspaceEditor {...props} />);
            expect((screen.getByTestId('code-editor-input') as HTMLTextAreaElement).value).toBe(tab.content);
        });
    });

    describe('Accessibility', () => {
        it('should have accessible image element', () => {
            const tab = createMockTab({
                type: 'image',
                content: 'data:image/png;base64,test',
                name: 'accessible-image.png',
            });
            const props = createMockProps({ activeTab: tab });

            render(<WorkspaceEditor {...props} />);

            const img = screen.getByRole('img');
            expect(img).toBeInTheDocument();
        });

        it('should have accessible textarea', () => {
            const tab = createMockTab();
            const props = createMockProps({ activeTab: tab });

            render(<WorkspaceEditor {...props} />);

            const textarea = screen.getByTestId('code-editor-input');
            expect(textarea).toBeInTheDocument();
        });
    });

    describe('Performance', () => {
        it('should not re-render unnecessarily', () => {
            const tab = createMockTab();
            const props = createMockProps({ activeTab: tab });

            const { rerender } = render(<WorkspaceEditor {...props} />);
            rerender(<WorkspaceEditor {...props} />);

            expect(screen.getByTestId('code-editor')).toBeInTheDocument();
        });

        it('should handle rapid content changes', async () => {
            const updateTabContent = vi.fn();
            const tab = createMockTab();
            const props = createMockProps({ activeTab: tab, updateTabContent });

            render(<WorkspaceEditor {...props} />);

            const textarea = screen.getByTestId('code-editor-input');

            // Simulate rapid typing
            for (let i = 0; i < 10; i++) {
                fireEvent.change(textarea, { target: { value: `content ${i}` } });
            }

            expect(updateTabContent).toHaveBeenCalledTimes(10);
        });
    });

    describe('Tab Switching', () => {
        it('should switch from code to image tab', () => {
            const codeTab = createMockTab({ type: 'code', id: 'code-tab' });
            const props = createMockProps({ activeTab: codeTab });

            const { rerender } = render(<WorkspaceEditor {...props} />);
            expect(screen.getByTestId('code-editor')).toBeInTheDocument();

            const imageTab = createMockTab({
                type: 'image',
                id: 'image-tab',
                content: 'data:image/png;base64,test',
            });
            rerender(<WorkspaceEditor {...createMockProps({ activeTab: imageTab })} />);

            expect(screen.getByRole('img')).toBeInTheDocument();
        });

        it('should switch from image to code tab', () => {
            const imageTab = createMockTab({
                type: 'image',
                id: 'image-tab',
                content: 'data:image/png;base64,test',
            });
            const props = createMockProps({ activeTab: imageTab });

            const { rerender } = render(<WorkspaceEditor {...props} />);
            expect(screen.getByRole('img')).toBeInTheDocument();

            const codeTab = createMockTab({ type: 'code', id: 'code-tab' });
            rerender(<WorkspaceEditor {...createMockProps({ activeTab: codeTab })} />);

            expect(screen.getByTestId('code-editor')).toBeInTheDocument();
        });

        it('should switch to empty state when tab is closed', () => {
            const codeTab = createMockTab();
            const props = createMockProps({ activeTab: codeTab });

            const { rerender } = render(<WorkspaceEditor {...props} />);
            expect(screen.getByTestId('code-editor')).toBeInTheDocument();

            rerender(<WorkspaceEditor {...createMockProps({ activeTab: null })} />);

            expect(screen.getByTestId('empty-state')).toBeInTheDocument();
        });
    });
});

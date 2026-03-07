import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CodeEditor } from '@/components/ui/CodeEditor';

vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('@/utils/renderer-logger', () => ({
    appLogger: {
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('@codemirror/state', () => ({
    EditorState: {
        allowMultipleSelections: { of: vi.fn() },
        readOnly: { of: vi.fn() },
        create: vi.fn(() => ({})),
    },
}));

vi.mock('@codemirror/view', () => {
    class EditorView {
        public static theme = vi.fn(() => ({}));
        public static updateListener = { of: vi.fn(() => ({})) };
        public static MouseTargetType = { GUTTER_GLYPH_MARGIN: 1 };
        constructor() {}
        public destroy(): void {}
    }
    return {
        EditorView,
        lineNumbers: vi.fn(() => ({})),
        highlightActiveLineGutter: vi.fn(() => ({})),
        drawSelection: vi.fn(() => ({})),
        dropCursor: vi.fn(() => ({})),
        keymap: { of: vi.fn(() => ({})) },
        hoverTooltip: vi.fn(() => ({})),
        highlightActiveLine: vi.fn(() => ({})),
    };
});

vi.mock('@codemirror/commands', () => ({
    defaultKeymap: [],
    history: vi.fn(() => ({})),
    historyKeymap: [],
}));

vi.mock('@codemirror/lang-javascript', () => ({ javascript: vi.fn(() => ({})) }));
vi.mock('@codemirror/lang-json', () => ({ json: vi.fn(() => ({})) }));
vi.mock('@codemirror/lang-markdown', () => ({ markdown: vi.fn(() => ({})) }));
vi.mock('@codemirror/lang-html', () => ({ html: vi.fn(() => ({})) }));
vi.mock('@codemirror/lang-css', () => ({ css: vi.fn(() => ({})) }));
vi.mock('@codemirror/lang-python', () => ({ python: vi.fn(() => ({})) }));
vi.mock('@codemirror/theme-one-dark', () => ({ oneDark: {} }));
vi.mock('@codemirror/autocomplete', () => ({
    closeBrackets: vi.fn(() => ({})),
    autocompletion: vi.fn(() => ({})),
    closeBracketsKeymap: [],
    completionKeymap: [],
}));

describe('Project CodeEditor integration', () => {
    it('renders empty state for blank content after initialization', async () => {
        render(<CodeEditor value="" language="typescript" />);
        expect(await screen.findByText('workspaceDashboard.editor.empty')).toBeInTheDocument();
    });
});

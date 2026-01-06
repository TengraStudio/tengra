import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorTab } from '@/types';

interface WorkspaceEditorProps {
    activeTab: EditorTab | null;
    editorExtensions: any[];
    updateTabContent: (value: string) => void;
    emptyState: React.ReactNode;
}

/**
 * WorkspaceEditor Component
 * 
 * Handles the display of the active file:
 * - Image preview for image types
 * - CodeMirror editor for text/code types
 * - Empty state when no file is open
 */
export const WorkspaceEditor: React.FC<WorkspaceEditorProps> = ({
    activeTab,
    editorExtensions,
    updateTabContent,
    emptyState
}) => {
    if (!activeTab) return <>{emptyState}</>;

    if (activeTab.type === 'image') {
        return (
            <div className="absolute inset-0 flex items-center justify-center p-8 bg-[#09090b] overflow-auto">
                <div className="relative max-w-full max-h-full shadow-2xl bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiMxMTEiLz48cGF0aCBkPSJNMCAwSDhWOFMwIDAgMCAweiIgZmlsbD0iIzIyMiIvPjwvc3ZnPg==')] rounded-lg border border-white/10 p-1">
                    <img src={activeTab.content} alt={activeTab.name} className="max-w-full max-h-[80vh] object-contain rounded" />
                </div>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 overflow-hidden">
            <CodeMirror
                value={activeTab.content}
                height="100%"
                style={{ height: '100%' }}
                theme={oneDark}
                extensions={editorExtensions}
                onChange={updateTabContent}
                basicSetup={{
                    lineNumbers: true,
                    highlightActiveLine: true,
                    highlightSelectionMatches: true,
                    foldGutter: true,
                    drawSelection: true,
                    dropCursor: true,
                    allowMultipleSelections: true,
                    indentOnInput: true,
                    bracketMatching: true,
                    closeBrackets: true,
                    autocompletion: true,
                    rectangularSelection: true,
                    crosshairCursor: true,
                    highlightActiveLineGutter: true,
                }}
                className="h-full w-full text-base font-mono"
            />
        </div>
    );
};

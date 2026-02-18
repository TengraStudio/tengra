import React from 'react';

import { CodeEditor } from '@/components/ui/CodeEditor';
import { cn } from '@/lib/utils';
import { EditorTab } from '@/types';
import { getLanguageFromExtension } from '@/utils/language-map';

export interface WorkspaceEditorProps {
    activeTab: EditorTab | null;
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
    updateTabContent,
    emptyState
}) => {
    const hasUnsavedChanges = Boolean(activeTab && activeTab.content !== activeTab.savedContent);

    React.useEffect(() => {
        if (!hasUnsavedChanges) {
            return undefined;
        }
        const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', beforeUnloadHandler);
        return () => {
            window.removeEventListener('beforeunload', beforeUnloadHandler);
        };
    }, [hasUnsavedChanges]);

    return (
        <div className="absolute inset-0 overflow-hidden">
            {activeTab?.type === 'image' ? (
                <div className="absolute inset-0 flex items-center justify-center p-8 bg-background overflow-auto z-10">
                    <div className="relative max-w-full max-h-full shadow-2xl bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiMxMTEiLz48cGF0aCBkPSJNMCAwSDhWOFMwIDAgMCAweiIgZmlsbD0iIzIyMiIvPjwvc3ZnPg==')] rounded-lg border border-white/10 p-1">
                        <img src={activeTab.content} alt={activeTab.name} className="max-w-full max-h-[80vh] object-contain rounded" />
                    </div>
                </div>
            ) : (
                <div className={cn("absolute inset-0 transition-opacity duration-300", !activeTab && "opacity-0 pointer-events-none")}>
                    <CodeEditor
                        value={activeTab?.content ?? ''}
                        language={activeTab ? getLanguageFromExtension(activeTab.name) : 'typescript'}
                        onChange={(val) => activeTab && updateTabContent(val ?? '')}
                        className="h-full w-full"
                        showMinimap={true}
                        fontSize={16}
                        initialLine={activeTab?.initialLine}
                    />
                </div>
            )}
            {!activeTab && emptyState}
        </div>
    );
};

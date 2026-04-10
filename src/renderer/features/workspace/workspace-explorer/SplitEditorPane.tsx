/**
 * @fileoverview Secondary editor pane for split view
 * @description Provides a read-only Monaco-backed editor with file selector,
 *   used as the right pane in split view mode.
 */

import React from 'react';

import { CodeEditor } from '@/components/ui/CodeEditor';
import { EditorTab } from '@/types';
import { getLanguageFromExtension } from '@/utils/language-map';

interface SplitEditorPaneProps {
    /** The secondary tab to display */
    rightTab: EditorTab | null;
    /** Available tabs for selection */
    openTabs: EditorTab[];
    /** Callback to set the right pane tab */
    onSelectRightTab: (tabId: string) => void;
    /** Translation function */
    t: (key: string) => string;
}

/**
 * Secondary read-only editor pane with tab selector for split view
 */
export const SplitEditorPane: React.FC<SplitEditorPaneProps> = ({
    rightTab,
    openTabs,
    onSelectRightTab,
    t,
}) => {
    return (
        <div className="h-full flex flex-col">
            {/* Tab selector header */}
            <div className="h-8 flex items-center gap-1 px-2 bg-muted/30 border-b border-border/50 shrink-0">
                <select
                    value={rightTab?.id ?? ''}
                    onChange={e => onSelectRightTab(e.target.value)}
                    className="typo-caption bg-transparent border border-border/40 rounded px-1 py-0.5 tw-max-w-200 truncate"
                >
                    <option value="">{t('workspaceDashboard.editor.selectFile')}</option>
                    {openTabs.map(tab => (
                        <option key={tab.id} value={tab.id}>
                            {tab.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Read-only editor */}
            <div className="flex-1 relative overflow-hidden">
                {rightTab ? (
                    <CodeEditor
                        value={rightTab.content}
                        language={getLanguageFromExtension(rightTab.name)}
                        readOnly={true}
                        initialLine={rightTab.initialLine}
                        savedValue={rightTab.savedContent}
                        showMinimap={false}
                        enableCodeLens={false}
                        enableInlayHints={false}
                        performanceMode={true}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                        {t('workspaceDashboard.editor.selectFileForSplit')}
                    </div>
                )}
            </div>
        </div>
    );
};

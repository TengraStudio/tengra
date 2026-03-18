/**
 * @fileoverview Editor breadcrumb navigation showing the file path hierarchy
 * @description Renders a clickable breadcrumb trail from the active editor tab's path,
 *   allowing quick navigation to parent directories via the file explorer.
 */

import { ChevronRight, FileCode, FolderOpen } from 'lucide-react';
import React, { useMemo } from 'react';

import { EditorTab } from '@/types';

interface EditorBreadcrumbProps {
    /** Currently active editor tab */
    activeTab: EditorTab | null;
    /** Callback to open a directory in the explorer */
    onNavigateToPath?: (path: string) => void;
    /** Translation function */
    t: (key: string) => string;
}

/**
 * Breadcrumb trail showing the path hierarchy of the active file
 */
export const EditorBreadcrumb: React.FC<EditorBreadcrumbProps> = ({
    activeTab,
    onNavigateToPath,
    t,
}) => {
    const segments = useMemo(() => {
        if (!activeTab?.path) {
            return [];
        }
        const parts = activeTab.path.replace(/\\/g, '/').split('/').filter(Boolean);
        return parts;
    }, [activeTab]);

    if (!activeTab || segments.length === 0) {
        return null;
    }

    return (
        <nav
            aria-label={t('workspaceDashboard.editor.breadcrumbNav')}
            className="flex items-center gap-0.5 px-3 py-1 text-xs text-muted-foreground bg-muted/20 border-b border-border/30 overflow-x-auto scrollbar-none"
        >
            {segments.map((segment, index) => {
                const isLast = index === segments.length - 1;
                const pathUpToHere = segments.slice(0, index + 1).join('/');

                return (
                    <React.Fragment key={pathUpToHere}>
                        {index > 0 && (
                            <ChevronRight className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />
                        )}
                        {isLast ? (
                            <span className="flex items-center gap-1 font-medium text-foreground truncate max-w-[180px]">
                                <FileCode className="w-3 h-3 flex-shrink-0" />
                                {segment}
                            </span>
                        ) : (
                            <button
                                onClick={() => onNavigateToPath?.(pathUpToHere)}
                                className="flex items-center gap-1 hover:text-foreground transition-colors truncate max-w-[140px]"
                                title={pathUpToHere}
                            >
                                <FolderOpen className="w-3 h-3 flex-shrink-0" />
                                {segment}
                            </button>
                        )}
                    </React.Fragment>
                );
            })}
        </nav>
    );
};

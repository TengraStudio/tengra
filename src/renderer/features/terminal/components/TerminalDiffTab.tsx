/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconGitCompare } from '@tabler/icons-react';
import React from 'react';

import { DiffViewer } from '@/components/ui/DiffViewer';

interface TerminalDiffTabProps {
    workspaceId: string;
    workspacePath: string;
    activeFilePath?: string;
    activeFileContent?: string;
    activeFileType?: string;
    activeFileDiff?: { oldValue: string; newValue: string };
    onOpenFile?: (path: string, line?: number) => void;
}

export const TerminalDiffTab: React.FC<TerminalDiffTabProps> = ({
    activeFilePath,
    activeFileContent
}) => {
    return (
        <div className="flex flex-col h-full w-full bg-background overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/40 bg-muted/5">
                <IconGitCompare className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-foreground/80 truncate">
                    {activeFilePath ? activeFilePath.split(/[\\/]/).pop() : 'Diff'}
                </span>
            </div>
            <div className="flex-1 min-h-0 p-2">
                <DiffViewer
                    original={""} // TODO: How to get original?
                    modified={activeFileContent ?? ""}
                    language={activeFilePath?.split('.').pop() ?? 'plaintext'}
                    className="h-full border-none shadow-none bg-transparent"
                />
            </div>
        </div>
    );
};

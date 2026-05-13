/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */


import { IconFileCode, IconX } from '@tabler/icons-react';

import { CodeEditor } from '@/components/ui/CodeEditor';
import { FolderInspector } from '@/features/workspace/components/ide/FolderInspector';
import { cn } from '@/lib/utils';
import { useWorkspaceDiagnostics } from '@/store/diagnostics.store';

interface OpenFile {
    path: string;
    name: string;
    content: string;
    isDirty: boolean;
    initialLine?: number;
    gitStatus?: string;
    gitRawStatus?: string;
    originalContent?: string;
    diff?: {
        oldValue: string;
        newValue: string;
    };
}

interface WorkspaceFilesTabProps {
    openFiles: OpenFile[];
    activeFile: string | null;
    setActiveFile: (path: string | null) => void;
    setOpenFiles: (files: OpenFile[]) => void;
    closeFile: (e: React.MouseEvent, path: string) => void;
    activeFileObj?: OpenFile;
    selectedFolder: string | null;
    workspaceRoot: string;
    t: (key: string) => string;
}

export const WorkspaceFilesTab = ({
    openFiles,
    activeFile,
    setActiveFile,
    setOpenFiles,
    closeFile,
    activeFileObj,
    selectedFolder,
    workspaceRoot,
    t
}: WorkspaceFilesTabProps) => {
    const workspaceDiagnostics = useWorkspaceDiagnostics(workspaceRoot);

    return (
        <div className="h-full flex gap-4 transition-all duration-300">
            <div className="flex-1 bg-card rounded-xl border border-border/50 flex flex-col overflow-hidden min-w-0">
                {openFiles.length > 0 ? (
                    <>
                        <div className="flex items-center overflow-x-auto border-b border-border/50 bg-muted/20 scrollbar-none max-w-[calc(100vw-450px)]">
                            {openFiles.map(file => {
                                const uri = file.path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^[A-Za-z]:\//, 'file:///').replace(/^\//, 'file:///');
                                const diag = workspaceDiagnostics?.get(uri.startsWith('file://') ? uri : `file://${uri}`);
                                const hasErrors = (diag?.errorCount ?? 0) > 0;
                                const hasWarnings = (diag?.warningCount ?? 0) > 0;

                                return (
                                    <div
                                        key={file.path}
                                        onClick={() => { setActiveFile(file.path); }}
                                        className={cn(
                                            'group flex items-center gap-2 px-3 py-2 typo-caption border-r border-border/20 cursor-pointer min-w-120 max-w-200 shrink-0 transition-colors',
                                            activeFile === file.path ? 'bg-card text-primary font-medium border-t-2 border-t-primary' : 'text-muted-foreground hover:bg-muted/30',
                                            file.gitStatus === 'M' && 'text-git-modified hover:text-git-modified',
                                            (file.gitStatus === 'A' || file.gitStatus === '?') && 'text-git-added hover:text-git-added',
                                            file.gitStatus === 'D' && 'text-git-deleted hover:text-git-deleted',
                                            hasErrors && activeFile !== file.path && 'text-destructive hover:text-destructive',
                                            hasWarnings && !hasErrors && activeFile !== file.path && 'text-warning hover:text-warning'
                                        )}
                                    >
                                        <IconFileCode size={12} className={cn(activeFile === file.path ? 'text-primary' : 'opacity-50')} />
                                        <span className={cn("truncate flex-1", activeFile === file.path && "font-semibold")}>
                                            {file.name}
                                        </span>
                                        {(file.gitStatus || hasErrors || hasWarnings || file.isDirty) && (
                                            <span 
                                                className={cn(
                                                    "w-1.5 h-1.5 rounded-full shrink-0",
                                                    hasErrors ? "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.4)]" : 
                                                    hasWarnings ? "bg-warning shadow-[0_0_8px_rgba(245,158,11,0.4)]" : 
                                                    file.gitStatus === 'M' ? "bg-git-modified" : 
                                                    (file.gitStatus === 'A' || file.gitStatus === '?') ? "bg-git-added" : 
                                                    file.gitStatus === 'D' ? "bg-git-deleted" : 
                                                    file.isDirty ? "bg-warning" : "bg-primary/40"
                                                )} 
                                            />
                                        )}
                                        <button onClick={(e) => { e.stopPropagation(); closeFile(e, file.path); }} className="opacity-0 group-hover:opacity-100 hover:text-destructive p-0.5 rounded transition-opacity">
                                            <IconX size={12} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex-1 relative">
                            {activeFileObj && (
                                <CodeEditor
                                    value={activeFileObj.diff ? undefined : activeFileObj.content}
                                    diff={activeFileObj.diff}
                                    language={activeFileObj.name.split('.').pop()?.replace('Diff: ', '') ?? 'typescript'}
                                    initialLine={activeFileObj.initialLine}
                                    showMinimap={false}
                                    enableCodeLens={false}
                                    enableInlayHints={false}
                                    performanceMode={true}
                                    performanceMarkPrefix="workspace:editor"
                                    gitStatus={activeFileObj.gitStatus}
                                    gitRawStatus={activeFileObj.gitRawStatus}
                                    originalContent={activeFileObj.originalContent}
                                    onCursorPositionChange={pos => {
                                        window.dispatchEvent(new CustomEvent('tengra:cursor-moved', {
                                            detail: {
                                                filePath: activeFileObj.path,
                                                line: pos.lineNumber,
                                                column: pos.column
                                            }
                                        }));
                                    }}
                                    onChange={newContent => {
                                        const newFiles = openFiles.map(f => f.path === activeFileObj.path ? { ...f, content: newContent ?? '', isDirty: true } : f);
                                        setOpenFiles(newFiles);
                                    }}
                                />
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                        <div className="w-16 h-16 mb-4 opacity-10 flex items-center justify-center border-2 border-current rounded-full">
                            <IconFileCode size={32} />
                        </div>
                        <p>{t('frontend.workspaceDashboard.selectFile')}</p>
                    </div>
                )}
            </div>
            <div className={cn("w-80 flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden border-l border-border/50", selectedFolder ? "opacity-100 mr-0" : "opacity-0 w-0 border-0 pointer-events-none")}>
                <FolderInspector folderPath={selectedFolder} rootPath={workspaceRoot} />
            </div>
        </div>
    );
};


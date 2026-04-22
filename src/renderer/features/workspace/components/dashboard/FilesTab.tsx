/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { FileText,X } from 'lucide-react';
import React from 'react';

import { CodeEditor } from '@/components/ui/CodeEditor';
import { useTranslation } from '@/i18n';
import { FileIcon } from '@/lib/file-icons';
import { cn } from '@/lib/utils';

import { OpenFile } from '../../hooks/useWorkspaceDashboardLogic';
import { FolderInspector } from '../ide/FolderInspector';

/* Batch-02: Extracted Long Classes */
const C_FILESTAB_1 = "w-3 h-3 opacity-0 group-hover:opacity-100 hover:text-foreground transition-all p-0.5 rounded-sm hover:bg-zinc-700/50";
const C_FILESTAB_2 = "absolute inset-0 flex flex-col items-center justify-center p-8 bg-zinc-950/20 m-4 border border-zinc-800/80 lg:p-10 sm:flex-row shadow-2xl rounded-xl";


interface FilesTabProps {
    openFiles: OpenFile[];
    activeFile: string | null;
    setActiveFile: (path: string | null) => void;
    closeFile: (e: React.MouseEvent, path: string) => void;
    setOpenFiles: (files: OpenFile[]) => void;
    selectedFolder: string | null;
    workspaceRoot: string;
}

export const FilesTab: React.FC<FilesTabProps> = ({
    openFiles,
    activeFile,
    setActiveFile,
    closeFile,
    setOpenFiles,
    selectedFolder,
    workspaceRoot,
}) => {
    const { t } = useTranslation();
    const activeFileObj = openFiles.find(f => f.path === activeFile);

    return (
        <div className="flex-1 min-h-0 flex flex-col animate-in fade-in duration-500">
            {/* Tabs */}
            {openFiles.length > 0 && (
                <div className="flex items-center border-b border-zinc-800/60 bg-zinc-900/80 backdrop-blur-md overflow-x-auto no-scrollbar h-9 shrink-0">
                    {openFiles.map(file => (
                        <button
                            key={file.path}
                            onClick={() => setActiveFile(file.path)}
                            className={cn(
                                'group flex items-center gap-2 px-3 h-full typo-caption font-medium transition-all duration-150 border-r border-zinc-800/40 relative min-w-140 max-w-220 select-none',
                                activeFile === file.path
                                    ? 'bg-zinc-950/40 text-foreground'
                                    : 'text-muted-foreground/60 bg-zinc-900/40 hover:bg-zinc-800/40 hover:text-foreground/80'
                            )}
                        >
                            {/* Active Top Border Accent */}
                            {activeFile === file.path && (
                                <div className="absolute top-0 left-0 right-0 h-2px bg-primary shadow-[0_0_8px_rgb(var(--primary)_/_0.5)]" />
                            )}
                            
                            <FileIcon
                                fileName={file.name}
                                className={cn(
                                    'w-3.5 h-3.5 shrink-0 transition-opacity',
                                    activeFile === file.path ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'
                                )}
                            />
                            <span className={cn(
                                "truncate flex-1 text-left text-11 tracking-tight",
                                activeFile === file.path ? "font-bold" : "font-medium"
                            )}>
                                {file.name}
                            </span>
                            
                            <div className="flex items-center justify-center min-w-16">
                                {file.isDirty ? (
                                    <div className="w-2 h-2 rounded-full bg-primary/80 shrink-0" />
                                ) : (
                                    <X
                                        className={C_FILESTAB_1}
                                        onClick={e => {
                                            e.stopPropagation();
                                            closeFile(e, file.path);
                                        }}
                                    />
                                )}
                            </div>
                        </button>
                    ))}
                    <div className="flex-1 h-full border-b border-transparent bg-zinc-900/40" />
                </div>
            )}

            {/* Editor Area */}
            <div className="flex-1 flex min-h-0 relative group">
                <div className="flex-1 relative">
                    {activeFileObj ? (
                        <div className="absolute inset-0">
                            <CodeEditor
                                value={activeFileObj.content}
                                language={activeFileObj.name.split('.').pop() ?? 'typescript'}
                                initialLine={activeFileObj.initialLine}
                                showMinimap={false}
                                enableCodeLens={false}
                                enableInlayHints={false}
                                performanceMode={true}
                                onChange={newContent => {
                                    const newFiles = openFiles.map(f =>
                                        f.path === activeFileObj.path
                                            ? { ...f, content: newContent ?? '', isDirty: true }
                                            : f
                                    );
                                    setOpenFiles(newFiles);
                                }}
                            />
                        </div>
                    ) : (
                        <div className={C_FILESTAB_2}>
                            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 shadow-2xl">
                                <FileText className="w-8 h-8 text-primary/40" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">
                                {t('workspaceDashboard.filesTab.noFileSelected')}
                            </h3>
                            <p className="text-sm text-muted-foreground text-center max-w-sm mb-8 leading-relaxed opacity-60">
                                {t('workspaceDashboard.filesTab.noFileDesc')}
                            </p>

                            <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
                                <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/50 flex flex-col items-center gap-2 shadow-sm">
                                    <span className="text-10 font-black uppercase tracking-tight text-muted-foreground/40">
                                        {t('workspaceDashboard.filesTab.shortcuts')}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-10 border border-zinc-700 text-muted-foreground">
                                            {t('shortcuts.ctrl')}
                                        </kbd>
                                        <span className="text-10 text-muted-foreground/40">+</span>
                                        <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-10 border border-zinc-700 text-muted-foreground">
                                            P
                                        </kbd>
                                    </div>
                                    <span className="text-10 text-muted-foreground/60">
                                        {t('workspaceDashboard.filesTab.quickSearch')}
                                    </span>
                                </div>
                                <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/50 flex flex-col items-center gap-2 shadow-sm">
                                    <span className="text-10 font-black uppercase tracking-tight text-muted-foreground/40">
                                        {t('workspaceDashboard.filesTab.navigation')}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-10 border border-zinc-700 text-muted-foreground">
                                            {t('shortcuts.ctrl')}
                                        </kbd>
                                        <span className="text-10 text-muted-foreground/40">+</span>
                                        <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-10 border border-zinc-700 text-muted-foreground">
                                            B
                                        </kbd>
                                    </div>
                                    <span className="text-10 text-muted-foreground/60">
                                        {t('workspaceDashboard.filesTab.toggleExplorer')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Folder Inspector Sidebar */}
                <div
                    className={cn(
                        'w-80 flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden border-l border-zinc-800/50 bg-zinc-950/20',
                        selectedFolder
                            ? 'opacity-100 mr-0'
                            : 'opacity-0 w-0 border-0 pointer-events-none'
                    )}
                >
                    {selectedFolder && (
                        <FolderInspector folderPath={selectedFolder} rootPath={workspaceRoot} />
                    )}
                </div>
            </div>
        </div>
    );
};

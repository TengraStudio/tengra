import { FileCode, X } from 'lucide-react';
import React from 'react';

import { CodeEditor } from '@/components/ui/CodeEditor';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import { OpenFile } from '../../hooks/useWorkspaceDashboardLogic';
import { FolderInspector } from '../ide/FolderInspector';

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
        <div className="flex-1 min-h-0 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Tabs */}
            {openFiles.length > 0 && (
                <div className="flex items-center gap-1 px-2 border-b border-border/50 bg-muted/30 overflow-x-auto no-scrollbar py-1">
                    {openFiles.map(file => (
                        <button
                            key={file.path}
                            onClick={() => setActiveFile(file.path)}
                            className={cn(
                                'group flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 border',
                                activeFile === file.path
                                    ? 'bg-primary/10 text-primary border-primary/20 shadow-sm'
                                    : 'text-muted-foreground border-transparent hover:bg-muted/50 hover:text-foreground'
                            )}
                        >
                            <FileCode
                                className={cn(
                                    'w-3.5 h-3.5',
                                    activeFile === file.path
                                        ? 'text-primary'
                                        : 'text-muted-foreground/60'
                                )}
                            />
                            <span className="truncate tw-max-w-120">{file.name}</span>
                            {file.isDirty && (
                                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            )}
                            <X
                                className="w-3 h-3 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all p-0.5 rounded-full hover:bg-destructive/10"
                                onClick={e => closeFile(e, file.path)}
                            />
                        </button>
                    ))}
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
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-muted/10 rounded-lg m-4 border border-dashed border-border/50">
                            <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mb-6">
                                <FileCode className="w-8 h-8 text-primary/40" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">
                                {t('workspaceDashboard.filesTab.noFileSelected')}
                            </h3>
                            <p className="text-sm text-muted-foreground text-center max-w-sm mb-8 leading-relaxed">
                                {t('workspaceDashboard.filesTab.noFileDesc')}
                            </p>

                            <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
                                <div className="p-3 rounded-lg bg-background/50 border border-border/50 flex flex-col items-center gap-2">
                                    <span className="text-xxs uppercase tracking-wider font-bold text-muted-foreground/50">
                                        {t('workspaceDashboard.filesTab.shortcuts')}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <kbd className="px-1.5 py-0.5 rounded bg-muted text-xxs border border-border">
                                            {t('shortcuts.ctrl')}
                                        </kbd>
                                        <span className="text-xxs text-muted-foreground">+</span>
                                        <kbd className="px-1.5 py-0.5 rounded bg-muted text-xxs border border-border">
                                            P
                                        </kbd>
                                    </div>
                                    <span className="text-xxs text-muted-foreground">
                                        {t('workspaceDashboard.filesTab.quickSearch')}
                                    </span>
                                </div>
                                <div className="p-3 rounded-lg bg-background/50 border border-border/50 flex flex-col items-center gap-2">
                                    <span className="text-xxs uppercase tracking-wider font-bold text-muted-foreground/50">
                                        {t('workspaceDashboard.filesTab.navigation')}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <kbd className="px-1.5 py-0.5 rounded bg-muted text-xxs border border-border">
                                            {t('shortcuts.ctrl')}
                                        </kbd>
                                        <span className="text-xxs text-muted-foreground">+</span>
                                        <kbd className="px-1.5 py-0.5 rounded bg-muted text-xxs border border-border">
                                            B
                                        </kbd>
                                    </div>
                                    <span className="text-xxs text-muted-foreground">
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
                        'w-80 flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden border-l border-border/50',
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

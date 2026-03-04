
import { FolderInspector } from '@renderer/features/workspace/components/ide/FolderInspector';
import { FileCode, X } from 'lucide-react';

import { CodeMirrorEditor } from '@/components/ui/CodeMirrorEditor';
import { cn } from '@/lib/utils';

interface OpenFile {
    path: string;
    name: string;
    content: string;
    isDirty: boolean;
    initialLine?: number;
}

interface ProjectFilesTabProps {
    openFiles: OpenFile[];
    activeFile: string | null;
    setActiveFile: (path: string | null) => void;
    setOpenFiles: (files: OpenFile[]) => void;
    closeFile: (e: React.MouseEvent, path: string) => void;
    activeFileObj?: OpenFile;
    selectedFolder: string | null;
    projectRoot: string;
    t: (key: string) => string;
}

export const ProjectFilesTab = ({
    openFiles,
    activeFile,
    setActiveFile,
    setOpenFiles,
    closeFile,
    activeFileObj,
    selectedFolder,
    projectRoot,
    t
}: ProjectFilesTabProps) => {
    return (
        <div className="h-full flex gap-4 transition-all duration-300">
            <div className="flex-1 bg-card rounded-xl border border-border/50 flex flex-col overflow-hidden min-w-0">
                {openFiles.length > 0 ? (
                    <>
                        <div className="flex items-center overflow-x-auto border-b border-border/50 bg-muted/20 scrollbar-none">
                            {openFiles.map(file => (
                                <div
                                    key={file.path}
                                    onClick={() => { setActiveFile(file.path); }}
                                    className={`group flex items-center gap-2 px-3 py-2 text-xs border-r border-border/20 cursor-pointer min-w-[120px] max-w-[200px] ${activeFile === file.path ? 'bg-card text-primary font-medium border-t-2 border-t-primary' : 'text-muted-foreground hover:bg-muted/30'}`}
                                >
                                    <FileCode size={12} className={activeFile === file.path ? 'text-primary' : 'opacity-50'} />
                                    <span className="truncate flex-1">{file.name}</span>
                                    <button onClick={(e) => closeFile(e, file.path)} className="opacity-0 group-hover:opacity-100 hover:text-destructive p-0.5 rounded">
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex-1 relative">
                            {activeFileObj && (
                                <CodeMirrorEditor
                                    content={activeFileObj.content}
                                    language={activeFileObj.name.split('.').pop() ?? 'typescript'}
                                    onChange={(newContent) => {
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
                            <FileCode size={32} />
                        </div>
                        <p>{t('projectDashboard.selectFile')}</p>
                    </div>
                )}
            </div>
            <div className={cn("w-80 flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden border-l border-border/50", selectedFolder ? "opacity-100 mr-0" : "opacity-0 w-0 border-0 pointer-events-none")}>
                <FolderInspector folderPath={selectedFolder} rootPath={projectRoot} />
            </div>
        </div>
    );
};

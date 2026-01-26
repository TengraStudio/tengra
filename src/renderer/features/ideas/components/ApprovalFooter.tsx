import { Archive, CheckCircle, FolderOpen, XCircle } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';

interface ApprovalFooterProps {
    projectPath: string
    setProjectPath: (path: string) => void
    handleSelectFolder: () => Promise<void>
    onReject: () => Promise<void>
    handleApprove: () => Promise<void>
    onArchive?: () => Promise<void>
    isApproving: boolean
    isRejecting: boolean
    isArchiving: boolean
}

export const ApprovalFooter: React.FC<ApprovalFooterProps> = ({
    projectPath,
    setProjectPath,
    handleSelectFolder,
    onReject,
    handleApprove,
    onArchive,
    isApproving,
    isRejecting,
    isArchiving
}) => {
    const { t } = useTranslation();

    return (
        <div className="p-6 border-t border-border/50 bg-background/50 backdrop-blur-md">
            <div className="flex items-end gap-4">
                <div className="flex-1">
                    <label className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mb-2 block">
                        {t('ideas.idea.selectPath')}
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={projectPath}
                            onChange={e => setProjectPath(e.target.value)}
                            placeholder="C:\Projects\my-project"
                            className="flex-1 px-4 py-2 bg-muted/20 border border-border/50 rounded-lg text-foreground placeholder-muted-foreground/30 focus:outline-none focus:border-primary/50 transition-all font-mono text-xs"
                        />
                        <button
                            type="button"
                            onClick={() => {
                                void handleSelectFolder();
                            }}
                            className="px-4 py-2 bg-muted/30 hover:bg-muted/50 text-foreground rounded-lg transition-colors border border-border/50"
                        >
                            <FolderOpen className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            void onReject();
                        }}
                        disabled={isRejecting || isApproving}
                        className="px-4 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 font-bold text-sm group"
                        title="Ctrl+Backspace"
                    >
                        <XCircle className="w-4 h-4" />
                        {t('ideas.idea.reject')}
                        <kbd className="hidden group-hover:inline-block ml-1 px-1.5 py-0.5 text-[10px] bg-destructive/20 rounded font-mono">Ctrl+⌫</kbd>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            void handleApprove();
                        }}
                        disabled={!projectPath || isApproving || isRejecting || isArchiving}
                        className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 font-bold text-sm group"
                        title="Ctrl+Enter"
                    >
                        <CheckCircle className="w-4 h-4" />
                        {isApproving ? t('ideas.idea.creating') : t('ideas.idea.approve')}
                        {!isApproving && <kbd className="hidden group-hover:inline-block ml-1 px-1.5 py-0.5 text-[10px] bg-primary/20 rounded font-mono">Ctrl+↵</kbd>}
                    </button>

                    {onArchive && (
                        <button
                            type="button"
                            onClick={() => {
                                void onArchive();
                            }}
                            disabled={isArchiving || isApproving || isRejecting}
                            className="px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 font-bold text-sm"
                            title="Archive Idea"
                        >
                            <Archive className="w-4 h-4" />
                            {isArchiving ? 'Archiving...' : 'Archive'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

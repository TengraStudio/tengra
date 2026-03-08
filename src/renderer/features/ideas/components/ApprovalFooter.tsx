import { Archive, CheckCircle, FolderOpen, LucideIcon, XCircle } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';

interface ApprovalFooterProps {
    workspacePath: string
    setWorkspacePath: (path: string) => void
    handleSelectFolder: () => Promise<void>
    onReject: () => Promise<void>
    handleApprove: () => Promise<void>
    onArchive?: () => Promise<void>
    isApproving: boolean
    isRejecting: boolean
    isArchiving: boolean
}

interface ActionButtonProps {
    onClick: () => void
    disabled: boolean
    Icon: LucideIcon
    label: string
    loadingLabel?: string
    isLoading?: boolean
    shortcut?: string
    colorScheme: 'destructive' | 'primary' | 'accent'
}

const COLOR_SCHEMES = {
    destructive: 'bg-destructive/10 hover:bg-destructive/20 text-destructive border-destructive/20',
    primary: 'bg-primary/10 hover:bg-primary/20 text-primary border-primary/20',
    accent: 'bg-accent/10 hover:bg-accent/20 text-accent border-accent/20'
};

const ActionButton: React.FC<ActionButtonProps> = ({ onClick, disabled, Icon, label, loadingLabel, isLoading, shortcut, colorScheme }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`px-4 py-2 ${COLOR_SCHEMES[colorScheme]} border rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 font-bold text-sm group`}
        title={shortcut}
    >
        <Icon className="w-4 h-4" />
        {isLoading ? loadingLabel : label}
        {shortcut && !isLoading && (
            <kbd className={`hidden group-hover:inline-block ml-1 px-1.5 py-0.5 text-xxs bg-${colorScheme}/20 rounded font-mono`}>{shortcut}</kbd>
        )}
    </button>
);

export const ApprovalFooter: React.FC<ApprovalFooterProps> = ({
    workspacePath,
    setWorkspacePath,
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
                    <label className="text-xxs font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mb-2 block">
                        {t('ideas.idea.selectPath')}
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={workspacePath}
                            onChange={e => setWorkspacePath(e.target.value)}
                            placeholder={t('ideas.idea.pathPlaceholder')}
                            className="flex-1 px-4 py-2 bg-muted/20 border border-border/50 rounded-lg text-foreground placeholder-muted-foreground/30 focus:outline-none focus:border-primary/50 transition-all font-mono text-xs"
                        />
                        <button
                            type="button"
                            onClick={() => void handleSelectFolder()}
                            className="px-4 py-2 bg-muted/30 hover:bg-muted/50 text-foreground rounded-lg transition-colors border border-border/50"
                        >
                            <FolderOpen className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex gap-2">
                    <ActionButton
                        onClick={() => void onReject()}
                        disabled={isRejecting || isApproving}
                        Icon={XCircle}
                        label={t('ideas.idea.reject')}
                        shortcut="Ctrl+⌫"
                        colorScheme="destructive"
                    />
                    <ActionButton
                        onClick={() => void handleApprove()}
                        disabled={!workspacePath || isApproving || isRejecting || isArchiving}
                        Icon={CheckCircle}
                        label={t('ideas.idea.approve')}
                        loadingLabel={t('ideas.idea.creating')}
                        isLoading={isApproving}
                        shortcut="Ctrl+↵"
                        colorScheme="primary"
                    />
                    {onArchive && (
                        <ActionButton
                            onClick={() => void onArchive()}
                            disabled={isArchiving || isApproving || isRejecting}
                            Icon={Archive}
                            label={t('ideas.idea.archive')}
                            loadingLabel={t('ideas.idea.archiving')}
                            isLoading={isArchiving}
                            colorScheme="accent"
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

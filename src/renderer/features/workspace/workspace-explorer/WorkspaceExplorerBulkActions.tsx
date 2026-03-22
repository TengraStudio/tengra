import { Copy, FolderInput, Pencil, Trash2, X } from 'lucide-react';
import React from 'react';

import type { WorkspaceBulkAction } from '@/store/workspace-explorer.store';
import type { WorkspaceEntry } from '@/types';

interface WorkspaceExplorerBulkActionsProps {
    bulkAction: WorkspaceBulkAction | null;
    canUsePathAction: boolean;
    selectedEntries: WorkspaceEntry[];
    onStartAction: (type: 'rename' | 'move' | 'copy') => void;
    onDraftValueChange: (value: string) => void;
    onSubmit: () => void;
    onCancel: () => void;
    onDelete: () => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}

function ToolbarActionButton(props: {
    ariaLabel: string;
    children: React.ReactNode;
    disabled?: boolean;
    onClick: () => void;
    title: string;
}): React.ReactElement {
    return (
        <button
            type="button"
            onClick={props.onClick}
            disabled={props.disabled}
            aria-label={props.ariaLabel}
            title={props.title}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border/50 bg-background/70 px-2 text-[11px] font-medium text-foreground transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
            {props.children}
        </button>
    );
}

export function WorkspaceExplorerBulkActions({
    bulkAction,
    canUsePathAction,
    selectedEntries,
    onStartAction,
    onDraftValueChange,
    onSubmit,
    onCancel,
    onDelete,
    t,
}: WorkspaceExplorerBulkActionsProps): React.ReactElement | null {
    if (selectedEntries.length <= 1) {
        return null;
    }

    return (
        <div className="mx-4 mb-2 rounded-lg border border-border/50 bg-muted/20 p-2">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-muted-foreground">
                    {t('common.itemsSelected', { count: selectedEntries.length })}
                </span>
                <ToolbarActionButton
                    ariaLabel={t('workspace.rename')}
                    onClick={() => onStartAction('rename')}
                    title={t('workspace.rename')}
                >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>{t('workspace.rename')}</span>
                </ToolbarActionButton>
                <ToolbarActionButton
                    ariaLabel={t('common.copy')}
                    disabled={!canUsePathAction}
                    onClick={() => onStartAction('copy')}
                    title={t('common.copy')}
                >
                    <Copy className="h-3.5 w-3.5" />
                    <span>{t('common.copy')}</span>
                </ToolbarActionButton>
                <ToolbarActionButton
                    ariaLabel={t('workspace.notifications.entryMoved')}
                    disabled={!canUsePathAction}
                    onClick={() => onStartAction('move')}
                    title={t('workspace.notifications.entryMoved')}
                >
                    <FolderInput className="h-3.5 w-3.5" />
                </ToolbarActionButton>
                <ToolbarActionButton
                    ariaLabel={t('common.delete')}
                    onClick={onDelete}
                    title={t('common.delete')}
                >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    <span>{t('common.delete')}</span>
                </ToolbarActionButton>
            </div>
            {bulkAction && (
                <div className="mt-2 flex items-center gap-2">
                    <input
                        type="text"
                        value={bulkAction.draftValue}
                        onChange={event => onDraftValueChange(event.target.value)}
                        onKeyDown={event => {
                            event.stopPropagation();
                            if (event.key === 'Enter') {
                                onSubmit();
                            }
                            if (event.key === 'Escape') {
                                onCancel();
                            }
                        }}
                        autoFocus
                        className="h-8 flex-1 rounded-md border border-border/50 bg-background/70 px-2 text-xs text-foreground outline-none transition-colors focus:border-primary/40"
                        placeholder={
                            bulkAction.type === 'rename'
                                ? t('workspace.placeholders.name')
                                : t('workspace.placeholders.rootPath')
                        }
                    />
                    <button
                        type="button"
                        onClick={onSubmit}
                        className="inline-flex h-8 items-center rounded-md bg-primary/15 px-2 text-[11px] font-semibold text-foreground transition-colors hover:bg-primary/20"
                    >
                        {t('common.confirm')}
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="inline-flex h-8 items-center rounded-md border border-border/50 px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                        aria-label={t('common.cancel')}
                        title={t('common.cancel')}
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}
        </div>
    );
}

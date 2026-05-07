/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconChevronRight } from '@tabler/icons-react';
import React from 'react';

import { FileIcon, FolderIcon } from '@/lib/file-icons';
import { cn } from '@/lib/utils';

/* Batch-02: Extracted Long Classes */
const C_WORKSPACEEXPLORERINLINEROW_1 = "h-6 w-full rounded-6px border border-primary/70 bg-background px-2 typo-overline text-foreground outline-none ring-0 transition-colors focus:border-primary focus-visible:border-primary placeholder:text-muted-foreground/45";


interface WorkspaceExplorerInlineRowProps {
    rowKey: string;
    depth: number;
    draftName: string;
    actionType: 'rename' | 'createFile' | 'createFolder';
    placeholder: string;
    isFocused: boolean;
    setRowRef?: (rowKey: string, element: HTMLDivElement | null) => void;
    onDraftNameChange: (value: string) => void;
    onSubmit: () => void;
    onCancel: () => void;
}

export const WorkspaceExplorerInlineRow: React.FC<WorkspaceExplorerInlineRowProps> = ({
    rowKey,
    depth,
    draftName,
    actionType,
    placeholder,
    isFocused,
    setRowRef,
    onDraftNameChange,
    onSubmit,
    onCancel,
}) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    React.useEffect(() => {
        if (!isFocused) {
            return;
        }
        inputRef.current?.focus();
        inputRef.current?.select();
    }, [isFocused]);

    return (
        <div
            ref={element => setRowRef?.(rowKey, element)}
            className={cn(
                'px-2 py-0 h-22 flex items-center',
                isFocused && 'bg-primary/5'
            )}
            style={{ paddingLeft: `${depth * 12 + 16}px` }}
        >
            <div className="mr-1 inline-flex items-center justify-center text-muted-foreground/70">
                <IconChevronRight className="h-3.5 w-3.5" />
            </div>
            <div className="mr-1.5 inline-flex items-center justify-center">
                {actionType === 'createFolder' ? (
                    <FolderIcon folderName="folder" className="h-3.5 w-3.5" size={14} />
                ) : (
                    <FileIcon fileName="file.txt" className="h-3.5 w-3.5" size={14} />
                )}
            </div>
            <input
                ref={inputRef}
                type="text"
                value={draftName}
                onChange={event => onDraftNameChange(event.target.value)}
                onKeyDown={event => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        onSubmit();
                    } else if (event.key === 'Escape') {
                        event.preventDefault();
                        onCancel();
                    }
                }}
                onBlur={() => {
                    if (actionType === 'createFile' || actionType === 'createFolder') {
                        onCancel();
                        return;
                    }
                    onSubmit();
                }}
                className={C_WORKSPACEEXPLORERINLINEROW_1}
                placeholder={placeholder}
                tabIndex={-1}
            />
        </div>
    );
};


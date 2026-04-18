/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React from 'react';

import { cn } from '@/lib/utils';

/* Batch-02: Extracted Long Classes */
const C_WORKSPACEEXPLORERINLINEROW_1 = "w-full rounded-md border border-primary/20 bg-background/90 px-2 py-1 typo-caption text-foreground outline-none focus:border-primary/40";


interface WorkspaceExplorerInlineRowProps {
    rowKey: string;
    depth: number;
    draftName: string;
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
                'px-2 py-1',
                isFocused && 'bg-primary/5'
            )}
            style={{ paddingLeft: `${depth * 14 + 32}px` }}
        >
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
                onBlur={onSubmit}
                className={C_WORKSPACEEXPLORERINLINEROW_1}
                placeholder={placeholder}
                tabIndex={-1}
            />
        </div>
    );
};

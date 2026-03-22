import React from 'react';

import { cn } from '@/lib/utils';

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
                className="w-full rounded-md border border-primary/20 bg-background/90 px-2 py-1 text-xs text-foreground outline-none focus:border-primary/40"
                placeholder={placeholder}
                tabIndex={-1}
            />
        </div>
    );
};

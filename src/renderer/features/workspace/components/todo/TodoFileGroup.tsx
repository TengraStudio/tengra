/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconChevronDown, IconChevronRight, IconFileText } from '@tabler/icons-react';

import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

import { TodoItemCard } from './TodoItemCard';
import { TodoFile, TodoItem } from './types';

/* Batch-02: Extracted Long Classes */
const C_TODOFILEGROUP_1 = "w-full flex items-center gap-2 typo-caption font-bold text-muted-foreground hover:text-foreground transition-colors group select-none";


interface TodoFileGroupProps {
    file: TodoFile;
    isExpanded: boolean;
    onToggleExpand: (path: string) => void;
    onToggleItem: (item: TodoItem) => void;
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
    t: (key: string) => string;
}

export const TodoFileGroup = ({
    file,
    isExpanded,
    onToggleExpand,
    onToggleItem,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    t,
}: TodoFileGroupProps) => {
    const pendingCount = file.items.filter(i => !i.completed).length;

    return (
        <div className="space-y-2">
            <button
                onClick={() => onToggleExpand(file.path)}
                className={C_TODOFILEGROUP_1}
            >
                {isExpanded ? <IconChevronDown className="w-3 h-3" /> : <IconChevronRight className="w-3 h-3" />}
                <IconFileText className="w-3 h-3" />
                <span className="truncate">{file.relativePath}</span>
                <div className="h-px bg-muted/20 flex-1 group-hover:bg-muted/40 transition-colors" />
                <span className={cn("px-1.5 py-0.5 rounded text-sm", pendingCount > 0 ? "bg-primary/20 text-primary" : "bg-muted/30 text-muted-foreground")}>
                    {pendingCount} {t('workspaceDashboard.pending')}
                </span>
            </button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="grid gap-2 pl-2"
                    >
                        {file.items.map(todo => (
                            <TodoItemCard
                                key={todo.id}
                                todo={todo}
                                onToggle={(item) => onToggleItem(item)}
                                t={t}
                                onUndo={onUndo}
                                onRedo={onRedo}
                                canUndo={canUndo}
                                canRedo={canRedo}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

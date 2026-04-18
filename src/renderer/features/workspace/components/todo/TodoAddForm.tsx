/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useState } from 'react';

import { AnimatePresence, motion } from '@/lib/framer-motion-compat';

interface TodoAddFormProps {
    isAdding: boolean;
    onAdd: (text: string) => Promise<void>;
    t: (key: string) => string;
}

export const TodoAddForm = ({ isAdding, onAdd, t }: TodoAddFormProps) => {
    const [newTaskText, setNewTaskText] = useState('');

    const handleAdd = async () => {
        if (!newTaskText.trim()) {return;}
        await onAdd(newTaskText);
        setNewTaskText('');
    };

    return (
        <AnimatePresence>
            {isAdding && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                >
                    <div className="bg-card border border-primary/30 rounded-xl p-3 mb-4 shadow-lg shadow-primary/5">
                        <div className="flex gap-2">
                            <input
                                autoFocus
                                value={newTaskText}
                                onChange={e => setNewTaskText(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { void handleAdd(); } }}
                                placeholder={t('workspaces.todoPlaceholder')}
                                className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground/50"
                            />
                            <button
                                onClick={() => void handleAdd()}
                                disabled={!newTaskText.trim()}
                                className="px-3 py-1 bg-primary text-primary-foreground typo-caption font-bold rounded-md disabled:opacity-50"
                            >
                                {t('common.add')}
                            </button>
                        </div>
                        <div className="text-xxs text-muted-foreground mt-2 pl-1">
                            {t('workspaces.willActOn')} <span className="font-mono text-primary/70">/TODO.md</span>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

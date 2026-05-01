/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { memo } from 'react';

import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

/* Batch-02: Extracted Long Classes */
const C_PROMPTCOMMANDMENU_1 = "absolute bottom-full left-0 z-50 mb-3 w-command-menu overflow-hidden rounded-2xl border border-border/25 bg-popover shadow-xl";


export interface PromptCommandMenuProps {
    show: boolean;
    prompts: Array<{ id: string; title: string; content: string }>;
    selectedIndex: number;
    onSelect: (prompt: { id: string; title: string; content: string }) => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}

/**
 * PromptCommandMenu component
 * 
 * Displays a list of suggested prompts when the user types a '/' in the input.
 */
export const PromptCommandMenu = memo(({ show, prompts, selectedIndex, onSelect, t }: PromptCommandMenuProps) => (
    <AnimatePresence>
        {show && (
            <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                className={C_PROMPTCOMMANDMENU_1}
                role="listbox"
                aria-label={t('frontend.input.promptSuggestions')}
                id="chat-prompt-command-listbox"
            >
                <div
                    className="border-b border-border/10 bg-muted/5 px-3 py-2 typo-body uppercase font-bold text-muted-foreground/70"
                    role="heading"
                    aria-level={3}
                >
                    {t('frontend.input.prompts')}
                </div>
                {prompts.map((prompt, i) => (
                    <button
                        key={prompt.id}
                        onClick={() => onSelect(prompt)}
                        className={cn(
                            'block w-full px-3 py-2 text-left typo-caption transition-colors',
                            i === selectedIndex
                                ? 'bg-primary/10 text-primary'
                                : 'text-foreground hover:bg-accent/40'
                        )}
                        aria-label={t('frontend.input.usePrompt', { title: prompt.title })}
                        aria-selected={i === selectedIndex}
                        role="option"
                    >
                        <div className="font-semibold">{prompt.title}</div>
                        <div className="typo-body text-muted-foreground/80 truncate mt-0.5">
                            {prompt.content}
                        </div>
                    </button>
                ))}
            </motion.div>
        )}
    </AnimatePresence>
));

PromptCommandMenu.displayName = 'PromptCommandMenu';

import React, { useEffect, useMemo, useState } from 'react';

import { motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

export interface SlashCommand {
    id: string
    label: string
    description: string
    icon: React.ReactNode
    action: () => void
}

interface SlashMenuProps {
    isOpen: boolean
    onClose: () => void
    query: string
    onSelect: (command: SlashCommand) => void
    commands: SlashCommand[]
    t: (key: string) => string
}

export const SlashMenu = React.memo(({ isOpen, onClose, query, onSelect, commands, t }: SlashMenuProps) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Filter commands based on query (after the slash)
    const filteredCommands = useMemo(() => {
        const lowerQuery = query.toLowerCase();
        return commands.filter(c =>
            c.label.toLowerCase().includes(lowerQuery) ||
            c.description.toLowerCase().includes(lowerQuery)
        );
    }, [commands, query]);

    const [prevQuery, setPrevQuery] = useState(query);

    // Reset selection when query changes
    if (prevQuery !== query) {
        setPrevQuery(query);
        setSelectedIndex(0);
    }

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) { return; }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                const cmd = filteredCommands[selectedIndex];
                onSelect(cmd);
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredCommands, selectedIndex, onSelect, onClose]);

    if (!isOpen || filteredCommands.length === 0) { return null; }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full left-4 mb-2 w-64 bg-popover border border-border shadow-2xl rounded-xl overflow-hidden z-50 flex flex-col"
        >
            <div className="px-3 py-2 text-xxs font-black uppercase tracking-widest text-muted-foreground bg-muted/20 border-b border-border/50">
                {t('common.commands')}
            </div>
            <div className="max-h-52 overflow-y-auto p-1 custom-scrollbar">
                {filteredCommands.map((cmd, idx) => (
                    <button
                        key={cmd.id}
                        onClick={() => onSelect(cmd)}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all",
                            idx === selectedIndex ? "bg-primary text-primary-foreground shadow-lg scale-102" : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                        )}
                        onMouseEnter={() => setSelectedIndex(idx)}
                    >
                        <div className={cn(
                            "p-1.5 rounded-md shrink-0",
                            idx === selectedIndex ? "bg-muted/50" : "bg-muted/30"
                        )}>
                            {cmd.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold truncate leading-tight">{cmd.label}</div>
                            <div className={cn(
                                "text-xxs truncate mt-0.5",
                                idx === selectedIndex ? "text-foreground/70" : "text-muted-foreground"
                            )}>{cmd.description}</div>
                        </div>
                    </button>
                ))}
            </div>
        </motion.div>
    );
});

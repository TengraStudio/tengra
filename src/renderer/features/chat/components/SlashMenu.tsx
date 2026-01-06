import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

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
}

export function SlashMenu({ isOpen, onClose, query, onSelect, commands }: SlashMenuProps) {
    const [selectedIndex, setSelectedIndex] = useState(0)

    // Filter commands based on query (after the slash)
    const filteredCommands = commands.filter(c =>
        (c.label?.toLowerCase() || '').includes(query?.toLowerCase() || '') ||
        (c.description?.toLowerCase() || '').includes(query?.toLowerCase() || '')
    )

    useEffect(() => {
        setSelectedIndex(0)
    }, [query])

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex(prev => (prev + 1) % filteredCommands.length)
            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length)
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault()
                const cmd = filteredCommands[selectedIndex]
                if (cmd) onSelect(cmd)
            } else if (e.key === 'Escape') {
                onClose()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, filteredCommands, selectedIndex, onSelect, onClose])

    if (!isOpen || filteredCommands.length === 0) return null

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full left-4 mb-2 w-64 bg-popover border border-border shadow-2xl rounded-xl overflow-hidden z-50 flex flex-col"
        >
            <div className="px-3 py-2 text-sm font-bold text-muted-foreground uppercase tracking-wider bg-muted/20">
                Komutlar
            </div>
            <div className="max-h-[200px] overflow-y-auto p-1 custom-scrollbar">
                {filteredCommands.map((cmd, idx) => (
                    <button
                        key={cmd.id}
                        onClick={() => onSelect(cmd)}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                            idx === selectedIndex ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                        )}
                        onMouseEnter={() => setSelectedIndex(idx)}
                    >
                        <div className={cn(
                            "p-1.5 rounded-md",
                            idx === selectedIndex ? "bg-white/20" : "bg-muted/30"
                        )}>
                            {cmd.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{cmd.label}</div>
                            <div className={cn(
                                "text-sm truncate",
                                idx === selectedIndex ? "text-indigo-100" : "text-zinc-500"
                            )}>{cmd.description}</div>
                        </div>
                    </button>
                ))}
            </div>
        </motion.div>
    )
}

import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
    Search,
    MessageSquarePlus,
    Settings,
    Server,
    RefreshCw,
    Cpu,
    Command,
    X,
    MessageSquare,
    Folder,
    Trash2
} from 'lucide-react'
import { Chat, Project } from '@/types'

interface CommandItem {
    id: string
    label: string
    description?: string
    icon: React.ReactNode
    shortcut?: string
    action: () => void
    category: 'chat' | 'navigation' | 'model' | 'system' | 'projects' | 'actions'
}

interface CommandPaletteProps {
    isOpen: boolean
    onClose: () => void
    chats: Chat[]
    onSelectChat: (id: string) => void
    onNewChat: () => void
    projects: Project[]
    onSelectProject: (id: string) => void
    onOpenSettings: (category?: any) => void
    onOpenSSHManager: () => void
    onRefreshModels: () => void
    models: { name: string }[]
    onSelectModel: (model: string) => void
    selectedModel: string
    onClearChat: () => void
}

export function CommandPalette({
    isOpen,
    onClose,
    chats,
    onSelectChat,
    onNewChat,
    projects,
    onSelectProject,
    onOpenSettings,
    onOpenSSHManager,
    onRefreshModels,
    models,
    onSelectModel,
    selectedModel,
    onClearChat
}: CommandPaletteProps) {
    const [search, setSearch] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)

    const commands: CommandItem[] = useMemo(() => {
        const baseCommands: CommandItem[] = [
            {
                id: 'new-chat',
                label: 'Yeni Sohbet',
                description: 'Yeni bir sohbet baÅŸlat',
                icon: <MessageSquarePlus className="w-4 h-4" />,
                shortcut: 'N',
                action: () => { onNewChat(); onClose(); },
                category: 'chat'
            },
            {
                id: 'clear-chat',
                label: 'Sohbeti Temizle',
                description: 'Mevcut sohbet mesajlarÄ±nÄ± sil',
                icon: <Trash2 className="w-4 h-4" />,
                action: () => { if (confirm('Sohbeti temizlemek istediÄŸinize emin misiniz?')) { onClearChat(); onClose(); } },
                category: 'actions'
            },
            {
                id: 'settings',
                label: 'Ayarlar',
                description: 'Uygulama ayarlarÄ±nÄ± aÃ§',
                icon: <Settings className="w-4 h-4" />,
                shortcut: ',',
                action: () => { onOpenSettings(); onClose(); },
                category: 'navigation'
            },
            {
                id: 'ssh-manager',
                label: 'SSH YÃ¶neticisi',
                description: 'SSH baÄŸlantÄ±larÄ±nÄ± yÃ¶net',
                icon: <Server className="w-4 h-4" />,
                action: () => { onOpenSSHManager(); onClose(); },
                category: 'navigation'
            }
        ]

        // Add recent chats
        const chatCommands: CommandItem[] = chats.slice(0, 5).map(chat => ({
            id: `chat-${chat.id}`,
            label: chat.title || 'Ä°simsiz Sohbet',
            description: 'Sohbete git',
            icon: <MessageSquare className="w-4 h-4" />,
            action: () => { onSelectChat(chat.id); onClose(); },
            category: 'chat'
        }))

        // Add projects
        const projectCommands: CommandItem[] = projects.slice(0, 5).map(project => ({
            id: `project-${project.id}`,
            label: project.title || 'Ä°simsiz Proje',
            description: 'Projeye git',
            icon: <Folder className="w-4 h-4" />,
            action: () => { onSelectProject(project.id); onClose(); },
            category: 'projects'
        }))

        // Add models
        const modelCommands: CommandItem[] = [
            {
                id: 'refresh-models',
                label: 'Modelleri Yenile',
                description: 'Ollama modellerini yeniden yÃ¼kle',
                icon: <RefreshCw className="w-4 h-4" />,
                action: () => { onRefreshModels(); onClose(); },
                category: 'model'
            },
            ...models.map(model => ({
                id: `model-${model.name}`,
                label: model.name,
                description: model.name === selectedModel ? 'âœ“ Aktif model' : 'Bu modele geÃ§',
                icon: <Cpu className="w-4 h-4" />,
                action: () => { onSelectModel(model.name); onClose(); },
                category: 'model' as const
            }))
        ]

        return [...baseCommands, ...chatCommands, ...projectCommands, ...modelCommands]
    }, [chats, projects, models, selectedModel, onNewChat, onOpenSettings, onOpenSSHManager, onRefreshModels, onSelectModel, onSelectChat, onSelectProject, onClearChat, onClose])

    const filteredCommands = useMemo(() => {
        if (!search.trim()) return commands
        const query = search.toLowerCase()

        // Simple fuzzy search by checking if all characters of query exist in label/description in order
        const fuzzyMatch = (text: string, query: string) => {
            let i = 0, j = 0
            text = text.toLowerCase()
            while (i < text.length && j < query.length) {
                if (text[i] === query[j]) j++
                i++
            }
            return j === query.length
        }

        return commands.filter(cmd =>
            fuzzyMatch(cmd.label, query) ||
            fuzzyMatch(cmd.description || '', query) ||
            cmd.category.toLowerCase().includes(query)
        )
    }, [commands, search])

    useEffect(() => {
        if (isOpen) {
            setSearch('')
            setSelectedIndex(0)
            setTimeout(() => inputRef.current?.focus(), 50)
        }
    }, [isOpen])

    useEffect(() => {
        setSelectedIndex(0)
    }, [search])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1))
                break
            case 'ArrowUp':
                e.preventDefault()
                setSelectedIndex(prev => Math.max(prev - 1, 0))
                break
            case 'Enter':
                e.preventDefault()
                if (filteredCommands[selectedIndex]) {
                    filteredCommands[selectedIndex].action()
                }
                break
            case 'Escape':
                e.preventDefault()
                onClose()
                break
        }
    }

    const categoryLabels: Record<string, string> = {
        chat: 'Sohbetler',
        projects: 'Projeler',
        navigation: 'Navigasyon',
        actions: 'Eylemler',
        model: 'Modeller',
        system: 'Sistem'
    }

    const groupedCommands = useMemo(() => {
        const groups: Record<string, CommandItem[]> = {}
        filteredCommands.forEach(cmd => {
            if (!groups[cmd.category]) groups[cmd.category] = []
            groups[cmd.category].push(cmd)
        })
        return groups
    }, [filteredCommands])

    let flatIndex = -1

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
                    onClick={onClose}
                >
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ duration: 0.2, type: 'spring', damping: 25 }}
                        onClick={e => e.stopPropagation()}
                        className="relative w-full max-w-lg bg-card/95 border border-border rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl"
                    >
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
                            <Search className="w-5 h-5 text-white/40" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Dosya, sohbet veya komut ara..."
                                className="flex-1 bg-transparent text-white placeholder-white/40 outline-none text-sm"
                            />
                            <div className="flex items-center gap-1 text-white/30 text-xs">
                                <Command className="w-3 h-3" />
                                <span>K</span>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="max-h-[450px] overflow-y-auto py-2">
                            {Object.entries(groupedCommands).map(([category, items]) => (
                                <div key={category}>
                                    <div className="px-4 py-1.5 text-xs font-medium text-white/40 uppercase tracking-wider">
                                        {categoryLabels[category] || category}
                                    </div>
                                    {items.map(cmd => {
                                        flatIndex++
                                        const isSelected = flatIndex === selectedIndex
                                        return (
                                            <button
                                                key={cmd.id}
                                                onClick={cmd.action}
                                                className={cn(
                                                    "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors",
                                                    isSelected
                                                        ? "bg-primary/20 text-foreground"
                                                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                                                )}
                                            >
                                                <span className={cn(
                                                    "p-1.5 rounded-md",
                                                    isSelected ? "bg-primary/30" : "bg-muted/30"
                                                )}>
                                                    {cmd.icon}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-sm truncate">{cmd.label}</div>
                                                    {cmd.description && (
                                                        <div className="text-xs text-white/30 truncate">{cmd.description}</div>
                                                    )}
                                                </div>
                                                {cmd.shortcut && (
                                                    <kbd className="px-1.5 py-0.5 text-[10px] bg-white/5 rounded border border-white/10 text-white/40">
                                                        {cmd.shortcut}
                                                    </kbd>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            ))}

                            {filteredCommands.length === 0 && (
                                <div className="px-4 py-8 text-center text-white/40 text-sm">
                                    SonuÃ§ bulunamadÄ±
                                </div>
                            )}
                        </div>

                        <div className="px-4 py-2 border-t border-white/10 flex items-center gap-4 text-[10px] text-white/20">
                            <span className="flex items-center gap-1">
                                <kbd className="px-1 py-0.5 bg-white/10 rounded">â†‘â†“</kbd>
                                Gezin
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1 py-0.5 bg-white/10 rounded">â†µ</kbd>
                                SeÃ§
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1 py-0.5 bg-white/10 rounded">Esc</kbd>
                                Kapat
                            </span>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

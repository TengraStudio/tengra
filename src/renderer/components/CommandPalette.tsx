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
    X
} from 'lucide-react'

interface CommandItem {
    id: string
    label: string
    description?: string
    icon: React.ReactNode
    shortcut?: string
    action: () => void
    category: 'chat' | 'navigation' | 'model' | 'system'
}

interface CommandPaletteProps {
    isOpen: boolean
    onClose: () => void
    onNewChat: () => void
    onOpenSettings: () => void
    onOpenSSHManager: () => void
    onRefreshModels: () => void
    models: { name: string }[]
    onSelectModel: (model: string) => void
    selectedModel: string
}

export function CommandPalette({
    isOpen,
    onClose,
    onNewChat,
    onOpenSettings,
    onOpenSSHManager,
    onRefreshModels,
    models,
    onSelectModel,
    selectedModel
}: CommandPaletteProps) {
    const [search, setSearch] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)

    const commands: CommandItem[] = useMemo(() => [
        {
            id: 'new-chat',
            label: 'Yeni Sohbet',
            description: 'Yeni bir sohbet başlat',
            icon: <MessageSquarePlus className="w-4 h-4" />,
            shortcut: 'N',
            action: () => { onNewChat(); onClose(); },
            category: 'chat'
        },
        {
            id: 'settings',
            label: 'Ayarlar',
            description: 'Uygulama ayarlarını aç',
            icon: <Settings className="w-4 h-4" />,
            shortcut: ',',
            action: () => { onOpenSettings(); onClose(); },
            category: 'navigation'
        },
        {
            id: 'ssh-manager',
            label: 'SSH Yöneticisi',
            description: 'SSH bağlantılarını yönet',
            icon: <Server className="w-4 h-4" />,
            action: () => { onOpenSSHManager(); onClose(); },
            category: 'navigation'
        },
        {
            id: 'refresh-models',
            label: 'Modelleri Yenile',
            description: 'Ollama modellerini yeniden yükle',
            icon: <RefreshCw className="w-4 h-4" />,
            action: () => { onRefreshModels(); onClose(); },
            category: 'model'
        },
        ...models.map(model => ({
            id: `model-${model.name}`,
            label: model.name,
            description: model.name === selectedModel ? '✓ Aktif model' : 'Bu modele geç',
            icon: <Cpu className="w-4 h-4" />,
            action: () => { onSelectModel(model.name); onClose(); },
            category: 'model' as const
        }))
    ], [models, selectedModel, onNewChat, onOpenSettings, onOpenSSHManager, onRefreshModels, onSelectModel, onClose])

    const filteredCommands = useMemo(() => {
        if (!search.trim()) return commands
        const query = search.toLowerCase()
        return commands.filter(cmd =>
            cmd.label.toLowerCase().includes(query) ||
            cmd.description?.toLowerCase().includes(query) ||
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
        chat: 'Sohbet',
        navigation: 'Navigasyon',
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
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

                    {/* Palette */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ duration: 0.2, type: 'spring', damping: 25 }}
                        onClick={e => e.stopPropagation()}
                        className="relative w-full max-w-lg bg-card/95 border border-border rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl"
                    >
                        {/* Search Input */}
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
                            <Search className="w-5 h-5 text-white/40" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Komut ara..."
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

                        {/* Commands List */}
                        <div className="max-h-[400px] overflow-y-auto py-2">
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
                                                    "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                                                    isSelected
                                                        ? "bg-primary/20 text-foreground"
                                                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
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
                                                        <div className="text-xs text-white/40 truncate">{cmd.description}</div>
                                                    )}
                                                </div>
                                                {cmd.shortcut && (
                                                    <kbd className="px-1.5 py-0.5 text-xs bg-white/10 rounded border border-white/10">
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
                                    Sonuç bulunamadı
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-2 border-t border-white/10 flex items-center gap-4 text-xs text-white/30">
                            <span className="flex items-center gap-1">
                                <kbd className="px-1 py-0.5 bg-white/10 rounded">↑↓</kbd>
                                Gezin
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1 py-0.5 bg-white/10 rounded">↵</kbd>
                                Seç
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

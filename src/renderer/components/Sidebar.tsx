import { Chat, OllamaModel, SystemUsage } from '../types'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface SidebarProps {
    chats: Chat[]
    currentChatId: string | null
    models: OllamaModel[]
    selectedModel: string
    onSelectChat: (id: string) => void
    onNewChat: () => void
    onDeleteChat: (id: string) => void
    onSelectModel: (model: string) => void
    onRefreshModels: () => void
    onOpenSSHManager: () => void
    onOpenSettings: () => void
}

export function Sidebar({
    chats,
    currentChatId,
    models,
    selectedModel,
    onSelectChat,
    onNewChat,
    onDeleteChat,
    onSelectModel,
    onRefreshModels,
    onOpenSSHManager,
    onOpenSettings
}: SidebarProps) {
    const [systemUsage, setSystemUsage] = useState<SystemUsage | null>(null)

    useEffect(() => {
        const fetchUsage = async () => {
            try {
                const result = await (window as any).electron.executeTool('get_system_usage', {})
                if (result) setSystemUsage(result)
            } catch (error) {
                console.error('Usage fetch error:', error)
            }
        }

        fetchUsage()
        const interval = setInterval(fetchUsage, 3000)
        return () => clearInterval(interval)
    }, [])
    return (
        <aside className="w-64 sidebar-glass flex flex-col h-full z-30 relative overflow-hidden">
            {/* Subtle Sidebar Accent */}
            <div className="absolute top-0 right-0 w-[1px] h-full bg-gradient-to-b from-transparent via-white/5 to-transparent" />

            <div className="p-6 flex flex-col gap-6">
                <Button
                    onClick={onNewChat}
                    className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 shadow-lg shadow-primary/5 flex items-center justify-center gap-2 group py-6 rounded-2xl transition-all duration-300 active:scale-95"
                >
                    <span className="text-xl group-hover:rotate-90 transition-transform duration-300">+</span>
                    <span className="font-bold tracking-tight">Yeni Sohbet</span>
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 space-y-1.5 custom-scrollbar pb-10">
                <div className="flex items-center justify-between px-2 mb-3 mt-2">
                    <label className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">Hafıza Bankası</label>
                </div>
                <div className="space-y-1">
                    {chats.length === 0 ? (
                        <div className="text-[11px] text-muted-foreground/30 font-bold uppercase tracking-widest text-center py-10 border-2 border-dashed border-white/5 rounded-2xl m-2">
                            Kayıt Yok
                        </div>
                    ) : (
                        Object.entries(groupChatsByDate(chats)).map(([category, categoryChats]) => (
                            <div key={category} className="mb-4">
                                <div className="px-2 mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/20">
                                    {category}
                                </div>
                                <div className="space-y-1">
                                    {categoryChats.map(chat => (
                                        <motion.button
                                            key={chat.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            whileHover={{ x: 4 }}
                                            onClick={() => onSelectChat(chat.id)}
                                            className={cn(
                                                "w-full px-4 py-3 rounded-xl text-[13px] font-medium text-left transition-all group relative flex items-center justify-between border",
                                                currentChatId === chat.id
                                                    ? "bg-white/[0.08] text-foreground border-white/10 shadow-lg shadow-black/20"
                                                    : "text-muted-foreground/60 border-transparent hover:bg-white/[0.03] hover:text-foreground/80"
                                            )}
                                        >
                                            <span className="truncate flex-1 pr-6 text-left">{chat.title || 'Yeni Analiz'}</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onDeleteChat(chat.id)
                                                }}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 text-red-400/60 hover:text-red-400 rounded-lg transition-all"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                            </button>
                                        </motion.button>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="p-6 border-t border-white/5 bg-black/40 space-y-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <label className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">Model Sensörü</label>
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                    </div>
                    <div className="flex gap-2">
                        <Select value={selectedModel} onValueChange={onSelectModel}>
                            <SelectTrigger className="w-full bg-white/[0.03] border-white/10 backdrop-blur-3xl rounded-xl h-10 shadow-inner">
                                <SelectValue placeholder="Model Seçin" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0c0c1e]/90 backdrop-blur-2xl border-white/5 text-foreground rounded-xl">
                                {models.length === 0 ? (
                                    <div className="p-2 text-sm text-muted-foreground text-center">Model bulunamadı</div>
                                ) : (
                                    models.map((model) => (
                                        <SelectItem key={model.name} value={model.name} className="hover:bg-white/5 rounded-lg transition-colors">
                                            <div className="flex flex-col items-start text-left">
                                                <span className="font-medium">{model.name}</span>
                                                {model.details && (
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {Math.round(model.size / 1024 / 1024 / 1024)}GB • {model.details.parameter_size}
                                                    </span>
                                                )}
                                            </div>
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 shrink-0 bg-white/[0.03] border-white/10 backdrop-blur-3xl rounded-xl"
                            onClick={onRefreshModels}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-muted-foreground/60 group-hover:rotate-180 transition-transform duration-500"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></svg>
                        </Button>
                    </div>
                </div>

                {systemUsage && (
                    <div className="space-y-4 px-1">
                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold tracking-wider text-muted-foreground/40 uppercase">
                                <span>İşlemci Gücü</span>
                                <span className="text-blue-400/70">{systemUsage.cpu.toFixed(1)}%</span>
                            </div>
                            <div className="h-1 bg-white/5 rounded-full overflow-hidden shadow-inner">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${systemUsage.cpu}%` }}
                                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold tracking-wider text-muted-foreground/40 uppercase">
                                <span>Bellek Havuzu</span>
                                <span className="text-purple-400/70">{systemUsage.memory.percent.toFixed(1)}%</span>
                            </div>
                            <div className="h-1 bg-white/5 rounded-full overflow-hidden shadow-inner">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${systemUsage.memory.percent}%` }}
                                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 text-[11px] font-black tracking-widest bg-white/[0.03] hover:bg-white/[0.08] text-muted-foreground/60 hover:text-foreground border border-white/5 rounded-xl uppercase transition-all"
                        onClick={onOpenSSHManager}
                    >
                        Terminal
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 text-[11px] font-black tracking-widest bg-white/[0.03] hover:bg-white/[0.08] text-muted-foreground/60 hover:text-foreground border border-white/5 rounded-xl uppercase transition-all"
                        onClick={onOpenSettings}
                    >
                        Sistem
                    </Button>
                </div>
            </div>
        </aside>
    )
}

function groupChatsByDate(chats: Chat[]) {
    const groups: Record<string, Chat[]> = {
        'Bugün': [],
        'Dün': [],
        'Önceki 7 Gün': [],
        'Eskiler': []
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const lastWeek = new Date(today)
    lastWeek.setDate(lastWeek.getDate() - 7)

    chats.forEach(chat => {
        const date = new Date(chat.createdAt)
        date.setHours(0, 0, 0, 0)

        if (date.getTime() === today.getTime()) {
            groups['Bugün'].push(chat)
        } else if (date.getTime() === yesterday.getTime()) {
            groups['Dün'].push(chat)
        } else if (date > lastWeek) {
            groups['Önceki 7 Gün'].push(chat)
        } else {
            groups['Eskiler'].push(chat)
        }
    })

    // Filter empty groups
    return Object.fromEntries(
        Object.entries(groups).filter(([_, items]) => items.length > 0)
    )
}

import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
    MessageSquare,
    Download,
    Puzzle,
    Settings
} from 'lucide-react'

type PageId = 'chat' | 'models' | 'mcp' | 'settings'

interface AppLayoutProps {
    currentPage: PageId
    onNavigate: (page: PageId) => void
    children: ReactNode
    modelName?: string
}

const navItems = [
    { id: 'chat' as PageId, label: 'Chat', icon: MessageSquare },
    { id: 'models' as PageId, label: 'Models', icon: Download },
    { id: 'mcp' as PageId, label: 'MCP', icon: Puzzle },
    { id: 'settings' as PageId, label: 'Ayarlar', icon: Settings },
]

import { TitleBar } from '../TitleBar'

export function AppLayout({ currentPage, onNavigate, children, modelName }: AppLayoutProps) {
    return (
        <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden">
            <TitleBar />

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Navigation */}
                <aside className="w-16 lg:w-56 border-r border-border/50 flex flex-col bg-card/30">
                    {/* Nav Items */}
                    <nav className="flex-1 p-2 space-y-1 pt-4">
                        {navItems.map((item) => {
                            const Icon = item.icon
                            const isActive = currentPage === item.id
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => onNavigate(item.id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                                        isActive
                                            ? "bg-primary/10 text-primary border-l-2 border-primary -ml-[2px] pl-[14px]"
                                            : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                                    )}
                                >
                                    <Icon className="w-5 h-5 shrink-0" />
                                    <span className="hidden lg:block">{item.label}</span>
                                </button>
                            )
                        })}
                    </nav>

                    {/* Model Indicator */}
                    {modelName && (
                        <div className="p-3 border-t border-border/50">
                            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/5 text-xs">
                                <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                                <span className="hidden lg:block text-muted-foreground truncate">{modelName}</span>
                            </div>
                        </div>
                    )}
                </aside>

                {/* Main Content */}
                <main className="flex-1 flex flex-col overflow-hidden">
                    <motion.div
                        key={currentPage}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex-1 flex flex-col overflow-hidden"
                    >
                        {children}
                    </motion.div>
                </main>
            </div>
        </div>
    )
}

export type { PageId }

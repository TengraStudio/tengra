import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
    MessageSquare,
    Download,
    Puzzle,
    Settings,
    Cpu
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

export function AppLayout({ currentPage, onNavigate, children, modelName }: AppLayoutProps) {
    return (
        <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
            {/* Sidebar Navigation */}
            <aside className="w-16 lg:w-56 border-r border-border/50 flex flex-col bg-card/30">
                {/* Logo */}
                <div className="h-14 flex items-center justify-center lg:justify-start lg:px-4 border-b border-border/50">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                            <Cpu className="w-4 h-4 text-white" />
                        </div>
                        <span className="hidden lg:block text-sm font-semibold">Orbit</span>
                    </div>
                </div>

                {/* Nav Items */}
                <nav className="flex-1 p-2 space-y-1">
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
    )
}

export type { PageId }

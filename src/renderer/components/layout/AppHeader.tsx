import {
    Container,
    Eraser,
    LayoutGrid,
    MessageSquare,
    Minus,
    Settings as SettingsIcon,
    Square,
    Users,
    X} from 'lucide-react'
import React from 'react'

import { useAuth } from '@/context/AuthContext'
import { useChat } from '@/context/ChatContext'
import { useTranslation } from '@/i18n'

interface AppHeaderProps {
    currentView: string
}

export const AppHeader: React.FC<AppHeaderProps> = ({
    currentView
}) => {
    const { chats, currentChatId, clearMessages } = useChat()
    const { language } = useAuth()
    const { t } = useTranslation(language || 'en')

    const currentChat = chats.find(c => c.id === currentChatId)

    const viewIcons: Record<string, React.ComponentType<{ className?: string }>> = {
        chat: MessageSquare,
        projects: LayoutGrid,
        settings: SettingsIcon,
        council: Users,
        mcp: Container
    }

    const Icon = viewIcons[currentView] || MessageSquare

    const handleMinimize = () => window.electron.minimize()
    const handleMaximize = () => window.electron.maximize()
    const handleClose = () => window.electron.close()

    return (
        <header className="h-14 border-b border-border/50 flex items-center justify-between px-6 bg-background/50 backdrop-blur-xl z-50 app-drag-region">
            <div className="flex items-center gap-4 no-drag">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Icon className="w-5 h-5" />
                </div>
                <div>
                    <h1 className="text-sm font-bold uppercase tracking-widest text-foreground/90 flex items-center gap-2">
                        {currentView === 'chat' && currentChat ? currentChat.title : t(`nav.${currentView}`)}
                    </h1>
                </div>
            </div>

            <div className="flex items-center gap-2 no-drag">
                {currentView === 'chat' && currentChatId && (
                    <button
                        onClick={clearMessages}
                        className="p-2 hover:bg-accent/50 rounded-xl transition-all text-muted-foreground hover:text-foreground group"
                        title={t('chat.clear')}
                    >
                        <Eraser className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                    </button>
                )}

                <div className="h-4 w-[1px] bg-border/50 mx-2" />

                <div className="flex items-center gap-1">
                    <button onClick={handleMinimize} className="p-2 hover:bg-accent/50 rounded-lg text-muted-foreground transition-colors">
                        <Minus className="w-4 h-4" />
                    </button>
                    <button onClick={handleMaximize} className="p-2 hover:bg-accent/50 rounded-lg text-muted-foreground transition-colors">
                        <Square className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={handleClose} className="p-2 hover:bg-rose-500/20 hover:text-rose-500 rounded-lg text-muted-foreground transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </header>
    )
}

export const MemoizedAppHeader = React.memo(AppHeader)

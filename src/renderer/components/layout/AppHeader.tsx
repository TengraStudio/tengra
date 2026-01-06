import React from 'react'
import {
    Eraser,
    X,
    Minus,
    Square,
    MessageSquare,
    LayoutGrid,
    Settings as SettingsIcon,
    Users,
    Container
} from 'lucide-react'

interface AppHeaderProps {
    currentView: string
    currentChatId: string | null
    chats: any[]
    onClearChat: () => void
    t: any
}

export const AppHeader: React.FC<AppHeaderProps> = ({
    currentView,
    currentChatId,
    chats,
    onClearChat,
    t
}) => {
    const currentChat = chats.find(c => c.id === currentChatId)

    const viewIcons: Record<string, any> = {
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
        <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-background/50 backdrop-blur-xl z-50">
            <div className="flex items-center gap-4">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Icon className="w-5 h-5" />
                </div>
                <div>
                    <h1 className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                        {currentView === 'chat' && currentChat ? currentChat.title : t(`nav.${currentView}`)}
                    </h1>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {currentView === 'chat' && currentChatId && (
                    <button
                        onClick={onClearChat}
                        className="p-2 hover:bg-white/5 rounded-xl transition-all text-muted-foreground hover:text-foreground group"
                        title={t('chat.clear')}
                    >
                        <Eraser className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                    </button>
                )}

                <div className="h-4 w-[1px] bg-white/10 mx-2" />

                <div className="flex items-center gap-1">
                    <button onClick={handleMinimize} className="p-2 hover:bg-white/5 rounded-lg text-muted-foreground transition-colors">
                        <Minus className="w-4 h-4" />
                    </button>
                    <button onClick={handleMaximize} className="p-2 hover:bg-white/5 rounded-lg text-muted-foreground transition-colors">
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

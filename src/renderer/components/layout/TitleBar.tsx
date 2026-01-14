import { Minus, Square, X } from 'lucide-react'
import { type CSSProperties,ReactNode } from 'react'

import { useTranslation } from '@/i18n'
import { cn } from '@/lib/utils'

interface TitleBarProps {
    children?: ReactNode
    leftContent?: ReactNode
    className?: string
}

export function TitleBar({ children, leftContent, className }: TitleBarProps) {
    const { t } = useTranslation()
    type AppRegionStyle = CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' }
    const dragStyle: AppRegionStyle = { WebkitAppRegion: 'drag' }
    const noDragStyle: AppRegionStyle = { WebkitAppRegion: 'no-drag' }
    return (
        <header
            className={cn(
                "h-12 border-b border-white/5 flex items-center justify-between px-6 bg-black/20 backdrop-blur-md z-40 select-none",
                className
            )}
            style={dragStyle}
        >
            <div className="flex items-center gap-4" style={noDragStyle}>
                <div className="flex items-center gap-2">
                    <img src="@renderer/assets/logo.png" alt="Orbit" className="w-5 h-5 object-contain" />
                    <span className="text-xs font-bold tracking-widest text-foreground/80 uppercase">Orbit</span>
                </div>
                {leftContent}
            </div>

            {/* Center Content (e.g. Token Counter) */}
            {children}

            <div className="flex items-center gap-2" style={noDragStyle}>
                <div className="flex gap-2 titlebar-controls px-2">
                    <button
                        onClick={() => window.electron.minimize()}
                        className="p-1.5 hover:bg-white/10 rounded-md transition-all duration-200 text-muted-foreground hover:text-foreground"
                        title={t('titleBar.minimize')}
                    >
                        <Minus className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => window.electron.maximize()}
                        className="p-1.5 hover:bg-white/10 rounded-md transition-all duration-200 text-muted-foreground hover:text-foreground"
                        title={t('titleBar.maximize')}
                    >
                        <Square className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => window.electron.close()}
                        className="p-1.5 hover:bg-red-500 hover:text-white rounded-md transition-all duration-200 text-muted-foreground"
                        title={t('titleBar.close')}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </header>
    )
}



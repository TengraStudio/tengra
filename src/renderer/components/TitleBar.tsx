import React from 'react'
import { Minus, Square, X } from 'lucide-react'

export function TitleBar() {
    return (
        <div className="h-8 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between select-none" style={{ WebkitAppRegion: 'drag' } as any}>
            <div className="flex items-center px-3 gap-2">
                <img src="./src/renderer/assets/logo.png" alt="Orbit Logo" className="w-4 h-4" />
                <span className="text-xs font-medium text-zinc-400">Orbit</span>
            </div>

            <div className="flex h-full" style={{ WebkitAppRegion: 'no-drag' } as any}>
                <button
                    onClick={() => window.electron.minimize()}
                    className="h-full px-4 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors flex items-center justify-center"
                >
                    <Minus className="w-4 h-4" />
                </button>
                <button
                    onClick={() => window.electron.maximize()}
                    className="h-full px-4 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors flex items-center justify-center"
                >
                    <Square className="w-3 h-3" />
                </button>
                <button
                    onClick={() => window.electron.close()}
                    className="h-full px-4 hover:bg-red-500 text-zinc-400 hover:text-white transition-colors flex items-center justify-center"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
}

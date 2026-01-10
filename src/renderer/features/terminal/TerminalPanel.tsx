import { useState, useEffect, useRef, memo, useCallback } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { TerminalTab } from '@/types'
import {
    Terminal, X, Plus, ChevronDown,
    Maximize2, Minimize2, TerminalSquare
} from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

interface TerminalPanelProps {
    isOpen: boolean
    onToggle: () => void
    height: number
    onHeightChange: (height: number) => void
    projectPath?: string
    tabs: TerminalTab[]
    activeTabId: string | null
    setTabs: (tabs: TerminalTab[] | ((prev: TerminalTab[]) => TerminalTab[])) => void
    setActiveTabId: (id: string | null) => void
}

// Single Terminal Session Component
const TerminalSession = memo(({
    tab,
    isActive,
    onClose,
    projectPath
}: {
    tab: TerminalTab,
    isActive: boolean,
    onClose: () => void,
    projectPath?: string
}) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const xtermRef = useRef<XTerm | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)
    const { theme } = useTheme()
    const [isReady, setIsReady] = useState(false)

    // Theme definitions
    const getTheme = useCallback((isDark: boolean) => ({
        background: isDark ? '#09090b' : '#ffffff',
        foreground: isDark ? '#e4e4e7' : '#18181b',
        cursor: isDark ? '#ffffff' : '#000000',
        selectionBackground: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)',
        black: isDark ? '#000000' : '#000000',
        red: isDark ? '#ef4444' : '#ef4444',
        green: isDark ? '#22c55e' : '#22c55e',
        yellow: isDark ? '#eab308' : '#eab308',
        blue: isDark ? '#3b82f6' : '#3b82f6',
        magenta: isDark ? '#ec4899' : '#ec4899',
        cyan: isDark ? '#06b6d4' : '#06b6d4',
        white: isDark ? '#ffffff' : '#ffffff',
        brightBlack: isDark ? '#71717a' : '#71717a',
        brightRed: isDark ? '#f87171' : '#f87171',
        brightGreen: isDark ? '#4ade80' : '#4ade80',
        brightYellow: isDark ? '#facc15' : '#facc15',
        brightBlue: isDark ? '#60a5fa' : '#60a5fa',
        brightMagenta: isDark ? '#f472b6' : '#f472b6',
        brightCyan: isDark ? '#22d3ee' : '#22d3ee',
        brightWhite: isDark ? '#ffffff' : '#ffffff'
    }), [])

    // Update theme on change
    useEffect(() => {
        if (xtermRef.current) {
            xtermRef.current.options.theme = getTheme(theme === 'dark')
        }
    }, [theme, getTheme])

    // Initialize xterm
    useEffect(() => {
        if (!containerRef.current) return

        const term = new XTerm({
            cursorBlink: true,
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
            theme: getTheme(theme === 'dark'),
            allowProposedApi: true,
            scrollback: 10000,
            cols: 80,
            rows: 24
        })

        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)
        term.open(containerRef.current)

        xtermRef.current = term
        fitAddonRef.current = fitAddon

        // Initialize backend session
        const initSession = async () => {
            // Give a moment for the DOM to settle
            await new Promise(resolve => setTimeout(resolve, 50))

            try {
                if (containerRef.current && (containerRef.current as HTMLElement).offsetParent) {
                    fitAddon.fit()
                }
            } catch (e) {
                console.warn('Initial terminal fit failed', e)
            }

            const cols = term.cols || 80
            const rows = term.rows || 24

            await window.electron.terminal.create({
                id: tab.id,
                shell: tab.type,
                cwd: projectPath,
                cols,
                rows
            })

            // Hook up resize
            term.onResize((size) => {
                window.electron.terminal.resize(tab.id, size.cols, size.rows)
            })

            // Hook up data input
            term.onData((data) => {
                window.electron.terminal.write(tab.id, data)
            })

            // Request initial buffer if any (re-attachment support)
            const buffer = await window.electron.terminal.readBuffer(tab.id)
            if (buffer) {
                term.write(buffer)
            }

            setIsReady(true)
        }

        initSession()

        // Cleanup
        return () => {
            // Note: We don't kill the backend session here to allow re-attachment if needed,
            // or we could kill it if that's the desired behavior.
            // Following the current pattern of 'kill on close' which is handled in closeTab
            term.dispose()
        }
    }, [tab.id, tab.type, projectPath, getTheme, theme])

    // Helper to safely fit terminal
    const safeFit = useCallback(() => {
        if (!fitAddonRef.current || !containerRef.current || !isActive) return
        try {
            // Check if element is actually visible and has dimensions
            const rect = containerRef.current.getBoundingClientRect()
            if (rect.width > 0 && rect.height > 0 && (containerRef.current as HTMLElement).offsetParent) {
                fitAddonRef.current.fit()
            }
        } catch (e) {
            console.warn('[TerminalSession] Fit failed:', e)
        }
    }, [isActive])

    // Handle incoming data via global multiplexer
    useEffect(() => {
        if (!isReady) return

        const handleData = (e: Event) => {
            const detail = (e as CustomEvent).detail
            if (detail.id === tab.id && xtermRef.current) {
                xtermRef.current.write(detail.data)
            }
        }

        const handleExit = (e: Event) => {
            const detail = (e as CustomEvent).detail
            if (detail.id === tab.id) {
                onClose()
            }
        }

        window.addEventListener('terminal-data-multiplex', handleData)
        window.addEventListener('terminal-exit-multiplex', handleExit)

        return () => {
            window.removeEventListener('terminal-data-multiplex', handleData)
            window.removeEventListener('terminal-exit-multiplex', handleExit)
        }
    }, [tab.id, isReady, onClose])

    // Handle fit on resize or visibility change
    useEffect(() => {
        if (isActive) {
            const timer = setTimeout(safeFit, 100)
            return () => clearTimeout(timer)
        }
        return undefined
    }, [isActive, safeFit])

    // Resize observer for container
    useEffect(() => {
        if (!containerRef.current) return

        const observer = new ResizeObserver(() => {
            if (isActive) {
                safeFit()
            }
        })

        observer.observe(containerRef.current)
        return () => observer.disconnect()
    }, [isActive, safeFit])

    return (
        <div
            className={cn("h-full w-full bg-zinc-950", isActive ? "block" : "hidden")}
            style={{ paddingLeft: '8px' }}
        >
            <div ref={containerRef} className="h-full w-full" />
        </div>
    )
})
TerminalSession.displayName = 'TerminalSession'

export function TerminalPanel({
    isOpen,
    onToggle,
    height,
    onHeightChange,
    projectPath,
    tabs,
    activeTabId,
    setTabs,
    setActiveTabId
}: TerminalPanelProps) {
    const [isResizing, setIsResizing] = useState(false)
    const [isMaximized, setIsMaximized] = useState(false)
    const [showNewTerminalMenu, setShowNewTerminalMenu] = useState(false)
    const [availableShells, setAvailableShells] = useState<{ id: string, name: string, path: string }[]>([])

    const createTerminal = useCallback((type: string) => {
        const id = Math.random().toString(36).substring(2, 9)
        const shellInfo = availableShells.find(s => s.id === type)
        const typeLabel = shellInfo?.name || type
        const count = tabs.filter(t => t.type === type).length + 1

        const newTab: TerminalTab = {
            id,
            name: `${typeLabel} ${count}`,
            type,
            cwd: projectPath || '',
            isRunning: true,
            status: 'idle',
            history: [],
            command: ''
        }

        setTabs(prev => [...prev, newTab])
        setActiveTabId(id)
        setShowNewTerminalMenu(false)
    }, [availableShells, tabs, projectPath, setTabs, setActiveTabId])

    useEffect(() => {
        const loadShells = async () => {
            const shells = await window.electron.terminal.getShells()
            setAvailableShells(shells)

            if (isOpen && tabs.length === 0 && shells.length > 0) {
                setTimeout(() => createTerminal(shells[0].id), 100)
            }
        }
        loadShells()
    }, [isOpen, createTerminal, tabs.length])

    const closeTab = (id: string) => {
        setTabs(prev => {
            const newTabs = prev.filter(t => t.id !== id)
            if (activeTabId === id && newTabs.length > 0) {
                setActiveTabId(newTabs[newTabs.length - 1].id)
            } else if (newTabs.length === 0) {
                setActiveTabId(null)
            }
            return newTabs
        })
    }

    // Centralized IPC Listeners to prevent MaxListenersExceeded
    useEffect(() => {
        const cleanupData = window.electron.terminal.onData((payload) => {
            window.dispatchEvent(new CustomEvent('terminal-data-multiplex', { detail: payload }))
        })
        const cleanupExit = window.electron.terminal.onExit((payload) => {
            window.dispatchEvent(new CustomEvent('terminal-exit-multiplex', { detail: payload }))
        })

        return () => {
            if (cleanupData) cleanupData()
            if (cleanupExit) cleanupExit()
        }
    }, [])

    // Resize logic
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return
            const newHeight = window.innerHeight - e.clientY
            onHeightChange(Math.min(Math.max(150, newHeight), window.innerHeight * 0.8))
        }
        const handleMouseUp = () => setIsResizing(false)

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isResizing, onHeightChange])

    return (
        <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            style={{ height: isMaximized ? '70vh' : height }}
            className="flex flex-col bg-zinc-950 border-t border-white/10 overflow-hidden shadow-2xl h-full"
        >
            {/* Resize Handle */}
            <div
                onMouseDown={(e) => { e.preventDefault(); setIsResizing(true) }}
                className={cn(
                    "h-1 cursor-ns-resize bg-transparent hover:bg-primary/50 transition-colors w-full relative z-10",
                    isResizing && "bg-primary"
                )}
            />

            {/* Header / Tabs */}
            <div className="flex items-center justify-between px-2 py-1.5 bg-zinc-900/80 border-b border-white/5 backdrop-blur-sm">
                <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar no-thumb">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTabId(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap border border-transparent",
                                activeTabId === tab.id
                                    ? "bg-zinc-800 text-white border-white/10 shadow-sm"
                                    : "text-muted-foreground hover:text-zinc-300 hover:bg-white/5"
                            )}
                        >
                            <TerminalSquare className={cn("w-3.5 h-3.5", activeTabId === tab.id ? "text-primary" : "opacity-70")} />
                            {tab.name}
                            <div
                                onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                                className="ml-1 p-0.5 rounded hover:bg-white/10 text-muted-foreground hover:text-red-400 transition-colors"
                            >
                                <X className="w-3 h-3" />
                            </div>
                        </button>
                    ))}

                    <div className="relative ml-1">
                        <button
                            onClick={() => setShowNewTerminalMenu(!showNewTerminalMenu)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                        <AnimatePresence>
                            {showNewTerminalMenu && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="absolute bottom-full left-0 mb-2 py-1 bg-[#18181b] border border-white/10 rounded-lg shadow-xl z-50 min-w-[140px] overflow-hidden"
                                >
                                    {availableShells.length > 0 ? availableShells.map(shell => (
                                        <button
                                            key={shell.id}
                                            onClick={() => createTerminal(shell.id)}
                                            className="w-full px-3 py-2 text-left text-xs font-medium hover:bg-white/5 transition-colors flex items-center gap-2 text-zinc-300"
                                        >
                                            <span className="opacity-50">&gt;_</span>
                                            {shell.name}
                                        </button>
                                    )) : (
                                        <div className="px-3 py-2 text-xs text-muted-foreground">No shells found</div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button onClick={() => setIsMaximized(!isMaximized)} className="p-1.5 text-muted-foreground hover:text-white transition-colors">
                        {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={onToggle} className="p-1.5 text-muted-foreground hover:text-white transition-colors">
                        <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Terminal Sessions Container */}
            <div className="flex-1 overflow-hidden relative bg-zinc-950">
                {tabs.map(tab => (
                    <TerminalSession
                        key={tab.id}
                        tab={tab}
                        isActive={activeTabId === tab.id}
                        onClose={() => closeTab(tab.id)}
                        projectPath={projectPath}
                    />
                ))}

                {tabs.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground opacity-50">
                        <Terminal className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-sm">No active terminal sessions</p>
                        <button
                            onClick={() => createTerminal(availableShells[0]?.id || 'powershell')}
                            className="mt-4 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-bold transition-colors"
                        >
                            Start New Session
                        </button>
                    </div>
                )}
            </div>
        </motion.div>
    )
}

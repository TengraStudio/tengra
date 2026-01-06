import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { TerminalTab } from '@/types'
import {
    Terminal, X, Plus, ChevronUp, ChevronDown,
    Maximize2, Minimize2, TerminalSquare
} from 'lucide-react'

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

const TERMINAL_TYPES = [
    { id: 'powershell', name: 'PowerShell', icon: 'ğŸ”·' },
    { id: 'cmd', name: 'CMD', icon: 'â¬›' },
    { id: 'bash', name: 'Bash', icon: 'ğŸŸ¢' },
]

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
    const panelRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const outputRef = useRef<HTMLDivElement>(null)

    const activeTab = tabs.find(t => t.id === activeTabId)

    // Create default terminal on first open
    useEffect(() => {
        if (isOpen && tabs.length === 0) {
            createTerminal('powershell')
        }
    }, [isOpen])

    // Focus input when tab changes
    useEffect(() => {
        if (activeTab && inputRef.current) {
            inputRef.current.focus()
        }
    }, [activeTabId])

    // Scroll to bottom on new content
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight
        }
    }, [activeTab?.content])

    const generateId = () => Math.random().toString(36).substr(2, 9)

    const createTerminal = (type: 'powershell' | 'cmd' | 'bash' | 'custom') => {
        const id = generateId()
        const typeLabel = TERMINAL_TYPES.find(t => t.id === type)?.name || 'Terminal'
        const tabCount = tabs.filter(t => t.type === type).length + 1

        const newTab: TerminalTab = {
            id,
            name: `${typeLabel} ${tabCount}`,
            type,
            content: [`[${typeLabel}] Oturum baÅŸlatÄ±ldÄ±...`, ''],
            inputHistory: [],
            historyIndex: -1,
            currentInput: '',
            cwd: projectPath || 'C:\\Users',
            isRunning: false
        }

        setTabs(prev => [...prev, newTab])
        setActiveTabId(id)
        setShowNewTerminalMenu(false)
    }

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

    const handleCommand = async (tabId: string, command: string) => {
        if (!command.trim()) return

        setTabs(prev => prev.map(t => {
            if (t.id !== tabId) return t
            return {
                ...t,
                content: [...t.content, `> ${command}`],
                inputHistory: [...t.inputHistory, command],
                historyIndex: -1,
                currentInput: '',
                isRunning: true
            }
        }))

        // Simulate command execution (real implementation would use electron IPC)
        try {
            const tab = tabs.find(t => t.id === tabId)
            if (!tab) return

            // Simulate some common commands
            let output = ''
            const cmd = command.toLowerCase().trim()

            if (cmd === 'cls' || cmd === 'clear') {
                setTabs(prev => prev.map(t => {
                    if (t.id !== tabId) return t
                    return { ...t, content: [], isRunning: false }
                }))
                return
            } else if (cmd === 'pwd' || cmd === 'cd') {
                output = tab.cwd
            } else if (cmd.startsWith('cd ')) {
                const newPath = command.slice(3).trim()
                setTabs(prev => prev.map(t => {
                    if (t.id !== tabId) return t
                    return {
                        ...t,
                        cwd: newPath || t.cwd,
                        content: [...t.content, `Dizin deÄŸiÅŸtirildi: ${newPath}`],
                        isRunning: false
                    }
                }))
                return
            } else if (cmd === 'help') {
                output = `KullanÄ±labilir komutlar:\n  cls/clear - EkranÄ± temizle\n  pwd/cd - Mevcut dizini gÃ¶ster\n  cd <path> - Dizin deÄŸiÅŸtir\n  help - YardÄ±m gÃ¶ster\n\nNot: Terminal henÃ¼z geliÅŸtirme aÅŸamasÄ±ndadÄ±r.`
            } else {
                output = `Komut simÃ¼le edildi: ${command}\n(GerÃ§ek terminal entegrasyonu yakÄ±nda eklenecek)`
            }

            setTabs(prev => prev.map(t => {
                if (t.id !== tabId) return t
                return {
                    ...t,
                    content: [...t.content, ...output.split('\n')],
                    isRunning: false
                }
            }))
        } catch (error: any) {
            setTabs(prev => prev.map(t => {
                if (t.id !== tabId) return t
                return {
                    ...t,
                    content: [...t.content, `Hata: ${error.message}`],
                    isRunning: false
                }
            }))
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent, tabId: string) => {
        const tab = tabs.find(t => t.id === tabId)
        if (!tab) return

        if (e.key === 'Enter') {
            e.preventDefault()
            handleCommand(tabId, tab.currentInput)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            if (tab.inputHistory.length > 0) {
                const newIndex = tab.historyIndex < tab.inputHistory.length - 1
                    ? tab.historyIndex + 1
                    : tab.historyIndex
                setTabs(prev => prev.map(t => {
                    if (t.id !== tabId) return t
                    return {
                        ...t,
                        historyIndex: newIndex,
                        currentInput: t.inputHistory[t.inputHistory.length - 1 - newIndex] || ''
                    }
                }))
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (tab.historyIndex > 0) {
                const newIndex = tab.historyIndex - 1
                setTabs(prev => prev.map(t => {
                    if (t.id !== tabId) return t
                    return {
                        ...t,
                        historyIndex: newIndex,
                        currentInput: t.inputHistory[t.inputHistory.length - 1 - newIndex] || ''
                    }
                }))
            } else if (tab.historyIndex === 0) {
                setTabs(prev => prev.map(t => {
                    if (t.id !== tabId) return t
                    return { ...t, historyIndex: -1, currentInput: '' }
                }))
            }
        }
    }

    const handleInputChange = (tabId: string, value: string) => {
        setTabs(prev => prev.map(t => {
            if (t.id !== tabId) return t
            return { ...t, currentInput: value }
        }))
    }

    // Resize handling
    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        setIsResizing(true)
    }, [])

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return
            const windowHeight = window.innerHeight
            const newHeight = windowHeight - e.clientY
            onHeightChange(Math.min(Math.max(150, newHeight), windowHeight * 0.7))
        }

        const handleMouseUp = () => {
            setIsResizing(false)
        }

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isResizing, onHeightChange])

    const toggleMaximize = () => {
        setIsMaximized(!isMaximized)
        onHeightChange(isMaximized ? 250 : window.innerHeight * 0.6)
    }

    if (!isOpen) {
        return (
            <button
                onClick={onToggle}
                className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-white/10 rounded-xl text-sm font-medium text-muted-foreground hover:text-white hover:border-white/20 transition-all shadow-xl"
            >
                <Terminal className="w-4 h-4" />
                Terminal
                <ChevronUp className="w-4 h-4" />
            </button>
        )
    }

    return (
        <motion.div
            ref={panelRef}
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            style={{ height: isMaximized ? '60vh' : height }}
            className="flex flex-col bg-zinc-950 border-t border-white/10 overflow-hidden"
        >
            {/* Resize Handle */}
            <div
                onMouseDown={handleResizeStart}
                className={cn(
                    "h-1 cursor-ns-resize bg-transparent hover:bg-primary/50 transition-colors",
                    isResizing && "bg-primary"
                )}
            />

            {/* Tab Bar */}
            <div className="flex items-center justify-between px-2 py-1 bg-zinc-900/50 border-b border-white/5">
                <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTabId(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                                activeTabId === tab.id
                                    ? "bg-zinc-800 text-white"
                                    : "text-muted-foreground hover:text-white hover:bg-zinc-800/50"
                            )}
                        >
                            <TerminalSquare className="w-3.5 h-3.5" />
                            {tab.name}
                            {tab.isRunning && (
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            )}
                            <button
                                onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                                className="p-0.5 rounded hover:bg-white/10 text-muted-foreground hover:text-white"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </button>
                    ))}

                    {/* New Terminal Button */}
                    <div className="relative">
                        <button
                            onClick={() => setShowNewTerminalMenu(!showNewTerminalMenu)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-zinc-800/50 transition-all"
                        >
                            <Plus className="w-4 h-4" />
                        </button>

                        <AnimatePresence>
                            {showNewTerminalMenu && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                    className="absolute top-full left-0 mt-1 py-1 bg-zinc-900 border border-white/10 rounded-lg shadow-xl z-50 min-w-[150px]"
                                >
                                    {TERMINAL_TYPES.map(type => (
                                        <button
                                            key={type.id}
                                            onClick={() => createTerminal(type.id as any)}
                                            className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-800 transition-colors flex items-center gap-2"
                                        >
                                            <span>{type.icon}</span>
                                            {type.name}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={toggleMaximize}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-zinc-800/50 transition-all"
                    >
                        {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={onToggle}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-zinc-800/50 transition-all"
                    >
                        <ChevronDown className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Terminal Content */}
            <div className="flex-1 overflow-hidden">
                {activeTab ? (
                    <div className="h-full flex flex-col bg-black/50 font-mono text-sm">
                        {/* Output */}
                        <div
                            ref={outputRef}
                            className="flex-1 overflow-auto p-3 text-zinc-300 leading-relaxed custom-scrollbar"
                        >
                            {activeTab.content.map((line, i) => (
                                <div key={i} className={cn(
                                    "whitespace-pre-wrap",
                                    line.startsWith('>') && "text-cyan-400",
                                    line.startsWith('Hata:') && "text-red-400"
                                )}>
                                    {line || '\u00A0'}
                                </div>
                            ))}
                        </div>

                        {/* Input */}
                        <div className="flex items-center gap-2 px-3 py-2 border-t border-white/5 bg-zinc-950">
                            <span className="text-emerald-400 font-bold shrink-0">
                                {activeTab.cwd.split('\\').pop() || activeTab.cwd} &gt;
                            </span>
                            <input
                                ref={inputRef}
                                type="text"
                                value={activeTab.currentInput}
                                onChange={(e) => handleInputChange(activeTab.id, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, activeTab.id)}
                                disabled={activeTab.isRunning}
                                className="flex-1 bg-transparent outline-none text-white placeholder:text-zinc-600"
                                placeholder={activeTab.isRunning ? "Ã‡alÄ±ÅŸÄ±yor..." : "Komut girin..."}
                                autoFocus
                            />
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                            <Terminal className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">Yeni terminal aÃ§mak iÃ§in + butonuna tÄ±klayÄ±n</p>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    )
}

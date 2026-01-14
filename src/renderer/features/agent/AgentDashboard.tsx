import { AgentChatRoom } from '@renderer/features/agent/AgentChatRoom'
import { AgentDefinition,CouncilSession } from '@shared/types/agent'
import { Bot, CheckCircle2, Clock, Pause,Play, RefreshCw, Sparkles } from 'lucide-react'
import React, { useCallback,useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export const AgentDashboard: React.FC = () => {
    const [goal, setGoal] = useState('')
    const [sessions, setSessions] = useState<CouncilSession[]>([])
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
    const [activeSession, setActiveSession] = useState<CouncilSession | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isRunning, setIsRunning] = useState(false)
    const logEndRef = useRef<HTMLDivElement>(null)

    const loadSessions = useCallback(async () => {
        try {
            const list = await window.electron.council.getSessions()
            setSessions(list || [])
            if (!activeSessionId && list && list.length > 0) {
                // Optionally select the latest one
                // setActiveSessionId(list[list.length - 1].id)
            }
        } catch (error) {
            console.error('Failed to load sessions:', error)
        }
    }, [activeSessionId])

    const loadSession = useCallback(async (id: string) => {
        try {
            const session = await window.electron.council.getSession(id)
            setActiveSession(session)
            if (session && (session.status === 'completed' || session.status === 'failed')) {
                setIsRunning(false)
            }
        } catch (error) {
            console.error('Failed to load session:', error)
        }
    }, [])

    // Load sessions on mount
    useEffect(() => {
        loadSessions()
    }, [loadSessions])

    // Poll active session details
    useEffect(() => {
        let interval: NodeJS.Timeout
        if (activeSessionId) {
            loadSession(activeSessionId)
            interval = setInterval(() => loadSession(activeSessionId), 1000)
        }
        return () => clearInterval(interval)
    }, [activeSessionId, loadSession])

    useEffect(() => {
        if (logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [activeSession?.logs?.length])

    const handleCreateSession = async () => {
        if (!goal.trim()) {return}
        setIsLoading(true)
        try {
            const session = await window.electron.council.createSession(goal)
            setSessions(prev => [...prev, session])
            setActiveSessionId(session.id)
            setGoal('')
            setIsRunning(false)
            // Auto-start step execution
            // window.electron.council.runStep(session.id)
        } catch (error) {
            console.error('Failed to create session:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleRunStep = () => {
        if (activeSessionId) {
            window.electron.council.runStep(activeSessionId)
        }
    }

    const toggleAutoRun = () => {
        if (!activeSessionId) {return}

        if (isRunning) {
            window.electron.council.stopLoop(activeSessionId)
            setIsRunning(false)
        } else {
            window.electron.council.startLoop(activeSessionId)
            setIsRunning(true)
        }
    }

    return (
        <div className="h-full flex flex-col bg-background/50 backdrop-blur-xl">
            {/* Header */}
            <div className="h-14 border-b border-border/40 flex items-center justify-between px-4 bg-muted/10 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Bot className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold flex items-center gap-2">
                            Council of Agents
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400">ALPHA</span>
                        </h2>
                        <p className="text-[10px] text-muted-foreground">Autonomous Task Execution System</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar: Sessions */}
                <div className="w-64 border-r border-border/40 bg-zinc-950/30 flex flex-col">
                    <div className="p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Sessions</div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {sessions.slice().reverse().map(session => (
                            <button
                                key={session.id}
                                onClick={() => setActiveSessionId(session.id)}
                                className={cn(
                                    "w-full text-left p-2 rounded-md text-xs transition-colors mb-1 truncate",
                                    activeSessionId === session.id ? "bg-primary/20 text-primary-foreground border border-primary/30" : "hover:bg-white/5 text-muted-foreground"
                                )}
                            >
                                <div className="font-medium truncate">{session.goal}</div>
                                <div className="text-[10px] opacity-70 flex items-center gap-1 mt-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(session.createdAt).toLocaleTimeString()}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Area */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Goal Input Area (shown if no active session or creating new) */}
                    <div className="p-4 border-b border-border/40 bg-card/30">
                        <div className="flex gap-2">
                            <Textarea
                                value={goal}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setGoal(e.target.value)}
                                placeholder="Describe a complex goal for the council..."
                                className="min-h-[60px] resize-none text-sm"
                                onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleCreateSession();
                                    }
                                }}
                            />
                            <Button
                                onClick={handleCreateSession}
                                disabled={isLoading || !goal.trim()}
                                className="h-auto shrink-0"
                            >
                                <Play className="w-4 h-4 mr-2" />
                                Start
                            </Button>
                        </div>
                    </div>

                    {/* Active Session View */}
                    {activeSession ? (
                        <div className="flex-1 flex flex-col overflow-hidden p-6 gap-6">
                            {/* Status Cards */}
                            <div className="grid grid-cols-3 gap-4 shrink-0">
                                <div className="bg-card/50 border border-border/40 rounded-xl p-4 flex items-center justify-between">
                                    <div>
                                        <div className="text-xs text-muted-foreground uppercase">Status</div>
                                        <div className={cn("text-lg font-bold capitalize",
                                            activeSession.status === 'completed' ? "text-green-400" :
                                                activeSession.status === 'failed' ? "text-red-400" :
                                                    "text-blue-400"
                                        )}>{activeSession.status}</div>
                                    </div>
                                    {(activeSession.status === 'executing' || isRunning) && <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />}
                                    {activeSession.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-green-400" />}
                                </div>

                                <div className="bg-card/50 border border-border/40 rounded-xl p-4">
                                    <div className="text-xs text-muted-foreground uppercase">Active Agents</div>
                                    <div className="flex -space-x-2 mt-2">
                                        {activeSession.agents?.map((agent: AgentDefinition) => ( // Explicit type if needed or infer
                                            <div key={agent.id} className="w-8 h-8 rounded-full bg-zinc-800 border-2 border-zinc-950 flex items-center justify-center text-xs font-bold" title={agent.name}>
                                                {agent.name[0]}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-card/50 border border-border/40 rounded-xl p-4 flex flex-col justify-center gap-2">
                                    {/* Controls */}
                                    <div className="flex gap-2">
                                        <Button size="sm"
                                            variant={isRunning ? "destructive" : "default"}
                                            onClick={toggleAutoRun}
                                            disabled={activeSession.status === 'completed' || activeSession.status === 'failed'}
                                            className="flex-1"
                                        >
                                            {isRunning ? (
                                                <>
                                                    <Pause className="w-3 h-3 mr-2" />
                                                    Stop Auto
                                                </>
                                            ) : (
                                                <>
                                                    <Play className="w-3 h-3 mr-2" />
                                                    Auto Run
                                                </>
                                            )}
                                        </Button>

                                        <Button size="sm" variant="outline" onClick={handleRunStep} disabled={activeSession.status === 'completed' || isRunning}>
                                            Step
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Plan View (if exists) */}
                            {activeSession.plan && (
                                <div className="bg-zinc-950/50 border border-border/40 rounded-xl p-4 shrink-0 max-h-[150px] overflow-y-auto">
                                    <div className="text-xs font-bold text-muted-foreground uppercase mb-2 flex items-center gap-2">
                                        <Sparkles className="w-3 h-3 text-purple-400" />
                                        Current Plan
                                    </div>
                                    <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-sans">{activeSession.plan}</pre>
                                </div>
                            )}

                            {/* Chat Room */}
                            <AgentChatRoom
                                sessionId={activeSession.id}
                                initialLogs={activeSession.logs || []}
                                isRunning={isRunning}
                            />
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                            <Bot className="w-12 h-12 opacity-20 mb-4" />
                            <p>Select a session or create a new one to begin.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

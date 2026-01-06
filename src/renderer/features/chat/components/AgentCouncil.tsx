import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@renderer/components/ui/card'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Badge } from '@renderer/components/ui/badge'
import { Brain, Terminal, User, Play } from 'lucide-react'

// Types aligned with backend CouncilSession
interface AgentConfig {
    id: string
    name: string
    role: string
    model: string
    provider: string
    status?: 'thinking' | 'working' | 'waiting'
}

interface LogEntry {
    timestamp: number
    agent: string
    message: string
    type?: 'thought' | 'tool' | 'chat' | 'system'
}

interface LocalCouncilSession {
    id: string
    projectId: string
    status: 'planning' | 'working' | 'reviewing' | 'waiting_for_approval' | 'completed' | 'failed'
    plan: any
    task: string
    agents: AgentConfig[]
    logs: LogEntry[]
}

const AgentCard = ({ agent, active }: { agent: AgentConfig; active: boolean }) => (
    <Card className={`w-64 transition-all duration-300 ${active ? 'ring-2 ring-primary border-primary' : 'opacity-80'}`}>
        <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                        <User className="w-4 h-4" />
                    </div>
                    <div>
                        <CardTitle className="text-sm font-bold">{agent.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{agent.role}</p>
                    </div>
                </div>
                {active && <Badge variant="default" className="text-[10px] animate-pulse">Active</Badge>}
            </div>
        </CardHeader>
        <CardContent className="pt-2">
            <div className="flex gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{agent.model}</Badge>
                <Badge variant="outline">{agent.provider}</Badge>
            </div>
        </CardContent>
    </Card>
)

export const AgentCouncil = () => {
    // const { project } = props
    const [session, setSession] = useState<LocalCouncilSession | null>(null)
    const [taskInput, setTaskInput] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)

    // Mock data for initial dev (replace with real IPC later)
    useEffect(() => {
        // Listen for IPC updates
        if (window.electron?.council) {
            window.electron.council.onUpdate((data: any) => {
                setSession(data)
            })
        }
    }, [])

    const handleStart = async () => {
        if (!taskInput) return
        setIsGenerating(true)
        // Call backend to start council
        await window.electron.council.runSession('project-id', taskInput) // 'project-id' should come from context
        setIsGenerating(false)
    }

    return (
        <div className="h-full flex flex-col gap-4 p-4">
            {/* Header / Control */}
            <div className="flex justify-between items-center bg-card p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                    <Brain className="w-6 h-6 text-primary" />
                    <h2 className="text-xl font-bold">Agent Council</h2>
                </div>
                {!session || session.status === 'completed' || session.status === 'failed' ? (
                    <div className="flex gap-2 w-1/2">
                        <input
                            type="text"
                            placeholder="Describe a task for the council..."
                            className="flex-1 px-3 py-2 bg-background border rounded-md text-sm"
                            value={taskInput}
                            onChange={(e) => setTaskInput(e.target.value)}
                        />
                        <Button onClick={handleStart} disabled={isGenerating}>
                            <Play className="w-4 h-4 mr-2" /> Start
                        </Button>
                    </div>
                ) : (
                    <Badge variant={(session.status as string) === 'failed' ? 'destructive' : 'secondary'}>
                        {(session.status as string) === 'failed' ? 'FAILED' : session.status.replace(/_/g, ' ').toUpperCase()}
                    </Badge>
                )}
            </div>

            {/* Agent Stage */}
            <div className="flex gap-4 overflow-x-auto pb-2">
                {session?.agents.map(agent => (
                    <AgentCard
                        key={agent.id}
                        agent={agent}
                        active={session.logs.length > 0 && session.logs[session.logs.length - 1].agent === agent.name}
                    />
                ))}
            </div>

            {/* Activity Stream */}
            <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Terminal className="w-4 h-4" /> Live Activity
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-0">
                    <ScrollArea className="h-full p-4">
                        <div className="space-y-4">
                            {session?.logs.map((log, i) => (
                                <div key={i} className={`flex gap-3 ${log.agent === 'System' ? 'opacity-70' : ''}`}>
                                    <div className={`mt-1 min-w-[3rem] text-xs font-bold ${log.agent === 'System' ? 'text-yellow-500' : 'text-primary'}`}>
                                        {log.agent}
                                    </div>
                                    <div className="flex-1 bg-muted/50 p-2 rounded-md text-sm font-mono whitespace-pre-wrap">
                                        {log.message}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                                        {new Date(log.timestamp).toLocaleTimeString()}
                                    </div>
                                </div>
                            ))}
                            {!session && (
                                <div className="text-center text-muted-foreground py-10">
                                    No active council session. Start a task to assemble the agents.
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    )
}

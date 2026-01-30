import { ProjectState } from '@shared/types/project-agent';
import { Bot, CheckCircle,Clock, Play, RefreshCw, Square, Terminal } from 'lucide-react';
import React, { useEffect,useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export const ProjectAgentView: React.FC = () => {
    const [state, setState] = useState<ProjectState>({
        status: 'idle',
        currentTask: '',
        plan: [],
        history: []
    });
    const [taskInput, setTaskInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Poll for status
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const status = await window.electron.ipcRenderer.invoke('project:get-status');
                setState(status as ProjectState);
            } catch (e) {
                const error = e instanceof Error ? e : new Error(String(e));
                window.electron.log.error('Failed to get status', error);
            }
        };

        void fetchStatus();
        const interval = setInterval(() => { void fetchStatus(); }, 2000);
        return () => clearInterval(interval);
    }, []);

    const handleStart = async () => {
        if (!taskInput.trim()) { return; }
        setIsLoading(true);
        try {
            await window.electron.ipcRenderer.invoke('project:start', taskInput);
            setTaskInput('');
        } catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            window.electron.log.error('Failed to start', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStop = async () => {
        try {
            await window.electron.ipcRenderer.invoke('project:stop');
        } catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            window.electron.log.error('Failed to stop', error);
        }
    };

    return (
        <div className="h-full flex flex-col p-6 space-y-6 overflow-hidden bg-background">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-xl text-primary">
                        <Bot size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Project Agent</h1>
                        <p className="text-muted-foreground">Autonomous project developer</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className={cn(
                        "px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2",
                        state.status === 'running' ? "bg-success/10 text-success" :
                            state.status === 'error' ? "bg-destructive/10 text-destructive" :
                                "bg-muted text-muted-foreground"
                    )}>
                        <div className={cn(
                            "w-2 h-2 rounded-full",
                            state.status === 'running' ? "bg-success animate-pulse" :
                                state.status === 'error' ? "bg-destructive" :
                                    "bg-muted-foreground"
                        )} />
                        {state.status.toUpperCase()}
                    </div>
                </div>
            </div>

            {/* Input Area */}
            {state.status === 'idle' || state.status === 'error' ? (
                <Card className="p-6 border-border/50 bg-card/50 backdrop-blur-sm">
                    <div className="flex gap-4">
                        <input
                            type="text"
                            value={taskInput}
                            onChange={(e) => setTaskInput(e.target.value)}
                            placeholder="Describe a coding task (e.g., 'Refactor the auth service to use JWT')..."
                            className="flex-1 bg-background border rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary outline-none"
                            onKeyDown={(e) => e.key === 'Enter' && void handleStart()}
                        />
                        <Button
                            onClick={() => void handleStart()}
                            disabled={!taskInput.trim() || isLoading}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6"
                        >
                            <Play size={18} className="mr-2" />
                            Start Task
                        </Button>
                    </div>
                </Card>
            ) : (
                <Card className="p-6 border-success/20 bg-success/5 backdrop-blur-sm flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <RefreshCw size={24} className="text-success animate-spin" />
                        <div>
                            <h3 className="font-semibold text-success">Agent Running</h3>
                            <p className="text-sm opacity-80">Current Task: {state.currentTask}</p>
                        </div>
                    </div>
                    <Button
                        onClick={() => void handleStop()}
                        variant="destructive"
                        className="bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/50"
                    >
                        <Square size={18} className="mr-2" />
                        Stop Agent
                    </Button>
                </Card>
            )}

            {/* Main Content Grid */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 min-h-0">
                {/* Plan & Status */}
                <div className="md:col-span-1 flex flex-col gap-6 min-h-0">
                    <Card className="flex-1 p-0 overflow-hidden flex flex-col border-border/50">
                        <div className="p-4 border-b bg-muted/30">
                            <h3 className="font-semibold flex items-center gap-2">
                                <CheckCircle size={18} />
                                Execution Plan
                            </h3>
                        </div>
                        <div className="flex-1 p-4 overflow-y-auto space-y-2">
                            {state.plan.length === 0 ? (
                                <p className="text-muted-foreground text-sm italic">No plan generated yet...</p>
                            ) : (
                                state.plan.map((item, i) => (
                                    <div key={i} className="flex gap-3 text-sm">
                                        <span className="text-muted-foreground font-mono">{i + 1}.</span>
                                        <span>{item}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </div>

                {/* Log / History */}
                <div className="md:col-span-2 flex flex-col min-h-0">
                    <Card className="flex-1 p-0 overflow-hidden flex flex-col border-border/50">
                        <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
                            <h3 className="font-semibold flex items-center gap-2">
                                <Terminal size={18} />
                                Activity Log
                            </h3>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock size={12} />
                                Live
                            </span>
                        </div>
                        <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-4 bg-black/50">
                            {state.history.slice().reverse().map((msg) => (
                                <div key={msg.id} className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2 opacity-50">
                                        <span className={cn(
                                            "uppercase font-bold text-[10px]",
                                            msg.role === 'user' ? "text-primary" :
                                                msg.role === 'assistant' ? "text-success" :
                                                    msg.role === 'system' ? "text-yellow" :
                                                        "text-purple"
                                        )}>
                                            {msg.role}
                                        </span>
                                        <span className="text-[10px]">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <div className="whitespace-pre-wrap pl-2 border-l-2 border-white/10">
                                        {typeof msg.content === 'string' ? msg.content : 'Complex content'}
                                        {msg.toolCalls && msg.toolCalls.length > 0 && (
                                            <div className="mt-2 space-y-1">
                                                {msg.toolCalls.map(tc => (
                                                    <div key={tc.id} className="bg-white/5 p-2 rounded text-cyan-300">
                                                        Attempting: {tc.function.name}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {state.history.length === 0 && (
                                <p className="text-muted-foreground italic">Waiting for activity...</p>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

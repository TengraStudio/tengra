import { AgentLog, AgentMessage } from '@shared/types/agent';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { Bot, Clock, Sparkles, Terminal } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import { motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';


interface AgentChatRoomProps {
    sessionId: string
    initialLogs: AgentLog[] // Load logs as initial history
    isRunning?: boolean
}

export const AgentChatRoom: React.FC<AgentChatRoomProps> = ({ sessionId, initialLogs, isRunning }) => {
    const [messages, setMessages] = useState<AgentMessage[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Initial load from logs
    useEffect(() => {
        const history: AgentMessage[] = initialLogs.map(log => ({
            id: log.id,
            sessionId: log.sessionId,
            sender: log.agentId,
            content: log.message,
            timestamp: log.timestamp,
            type: (log.type === 'plan' || log.type === 'action') ? 'code' : 'text'
        }));
        const timer = setTimeout(() => {
            setMessages(history);
        }, 0);
        return () => clearTimeout(timer);
    }, [initialLogs]);

    // WebSocket Connection
    useEffect(() => {
        if (!sessionId) { return; }

        // Get WebSocket URL from environment or use default
        // In production, this should use wss:// for secure connections
        // Note: For Vite, use import.meta.env.VITE_* prefix for env vars
        const wsUrl = (import.meta.env.VITE_WEBSOCKET_URL as string | undefined) ?? 'ws://localhost:3001';

        // Validate WebSocket URL
        if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
            console.error('[AgentChatRoom] Invalid WebSocket URL:', wsUrl);
            return;
        }

        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            // Join room
            socket.send(JSON.stringify({ type: 'join', sessionId }));
        };

        socket.onmessage = (event) => {
            try {
                const msg = safeJsonParse<AgentMessage>(event.data, {} as AgentMessage);
                if (!msg.id) { return; }
                // Deduping based on ID in case of overlapping log polls/WS
                setMessages(prev => {
                    if (prev.some(p => p.id === msg.id)) { return prev; }
                    return [...prev, msg];
                });
            } catch (e) {
                console.error('[AgentChatRoom] WS Parse error', e);
            }
        };

        socket.onerror = (error) => {
            console.error('[AgentChatRoom] WebSocket error:', error);
        };

        socket.onclose = () => {
            console.warn('[AgentChatRoom] WebSocket connection closed');
        };

        return () => {
            if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                socket.close();
            }
        };
    }, [sessionId]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages.length]);

    return (
        <div className="flex flex-col h-full bg-zinc-950/50 rounded-xl overflow-hidden border border-border/40 relative">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => {
                    const isSystem = msg.sender === 'system';
                    const isPlanner = msg.sender === 'planner';
                    const isExecutor = msg.sender === 'executor';

                    return (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={msg.id}
                            className={cn(
                                "flex gap-3 max-w-[90%]",
                                (isPlanner || isExecutor) ? "ml-0" : "mx-auto w-full justify-center" // Agents left, System centered? Or left too.
                            )}
                        >
                            {!isSystem && (
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-white/10 shadow-lg",
                                    isPlanner ? "bg-purple-900/20 text-purple" :
                                        isExecutor ? "bg-blue-900/20 text-primary" : "bg-zinc-800 text-muted-foreground"
                                )}>
                                    {isPlanner ? <Sparkles className="w-4 h-4" /> :
                                        isExecutor ? <Terminal className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                </div>
                            )}

                            <div className={cn(
                                "flex flex-col gap-1",
                                isSystem ? "w-full items-center" : "items-start"
                            )}>
                                {!isSystem && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{msg.sender}</span>
                                        <span className="text-[10px] opacity-40">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                )}

                                <div className={cn(
                                    "rounded-xl px-4 py-2.5 text-sm shadow-sm border border-transparent",
                                    isPlanner ? "bg-purple/10 border-purple/20 text-purple-100" :
                                        isExecutor ? "bg-primary/10 border-primary/20 text-blue-100" :
                                            isSystem ? "bg-muted/10 text-muted-foreground italic text-xs py-1" :
                                                "bg-zinc-800"
                                )}>
                                    {isSystem && msg.content.includes('loop') ? (
                                        <span className="flex items-center gap-2">
                                            <Clock className="w-3 h-3" /> {msg.content}
                                        </span>
                                    ) : (
                                        <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    );
                })}

                {isRunning && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 text-xs text-muted-foreground ml-12 animate-pulse"
                    >
                        <span className="w-2 h-2 rounded-full bg-success" />
                        Agents are collaborating...
                    </motion.div>
                )}

                <div ref={scrollRef} />
            </div>
        </div>
    );
};

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
    BrainCircuit,
    Bot,
    RotateCw,
    Terminal,
    Users
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export function CouncilView() {
    const [agents] = useState([
        { id: 'architect', name: 'Software Architect', role: 'System Design & Structure', icon: BrainCircuit, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', enabled: true },
        { id: 'tech-lead', name: 'Tech Lead', role: 'Code Quality & Standards', icon: Terminal, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', enabled: true },
        { id: 'product', name: 'Product Owner', role: 'User Experience & Requirements', icon: Users, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', enabled: true }
    ])

    return (
        <div className="h-full flex flex-col p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-black italic tracking-tighter uppercase mb-2 flex items-center gap-3">
                        <Users className="w-8 h-8 text-primary" />
                        AI Council
                    </h1>
                    <p className="text-muted-foreground">Orchestrate multi-agent collaboration for complex tasks.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {agents.map(agent => (
                    <motion.div
                        key={agent.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                            "relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 group hover:shadow-2xl",
                            agent.bg,
                            agent.border
                        )}
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className={cn("p-3 rounded-xl bg-black/20", agent.color)}>
                                <agent.icon className="w-6 h-6" />
                            </div>
                            <div className={cn("px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-black/20", agent.color, agent.border)}>
                                {agent.enabled ? 'Active' : 'Offline'}
                            </div>
                        </div>

                        <h3 className="text-lg font-bold mb-1">{agent.name}</h3>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide opacity-80">{agent.role}</p>
                    </motion.div>
                ))}
            </div>

            <div className="flex-1 bg-black/20 rounded-2xl border border-white/5 p-8 flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center animate-pulse">
                    <Bot className="w-10 h-10 text-muted-foreground" />
                </div>
                <div className="max-w-md space-y-2">
                    <h3 className="text-xl font-bold">Council Sessions</h3>
                    <p className="text-muted-foreground">Select a project to initiate a council session or run tasks directly from the project workspace.</p>
                </div>
                <Button variant="outline" className="gap-2">
                    <RotateCw className="w-4 h-4" />
                    Load Active Sessions
                </Button>
            </div>
        </div>
    )
}

import { DatabaseService, CouncilSession } from './database.service'
import { PLANNER_SYSTEM_PROMPT, EXECUTOR_SYSTEM_PROMPT } from './prompts/agent-prompts'
import { LLMService } from './llm.service'
import { FileSystemService } from './filesystem.service'
import { ProcessService } from './process.service'
import { CodeIntelligenceService } from './code-intelligence.service'
import { WebService } from './web.service'

import { CollaborationService } from './collaboration.service'

import { EmbeddingService } from './embedding.service'

export class CouncilService {
    constructor(
        private llm: LLMService,
        private db: DatabaseService,
        private fs: FileSystemService,
        private process: ProcessService,
        private _codeIntel: CodeIntelligenceService,
        private _web: WebService,
        private collaboration: CollaborationService,
        private embedding: EmbeddingService
    ) { }

    private activeLoops = new Set<string>()

    async startSessionLoop(sessionId: string) {
        if (this.activeLoops.has(sessionId)) return
        this.activeLoops.add(sessionId)

        // Run in background (fire and forget from caller's perspective, but we log errors)
        this.runLoop(sessionId).catch(async err => {
            console.error('Loop error:', err)
            await this.db.addCouncilLog(sessionId, 'system', `Loop crashed: ${err.message}`, 'error')
            this.activeLoops.delete(sessionId)
        })
    }

    async stopSessionLoop(sessionId: string) {
        this.activeLoops.delete(sessionId)
        await this.db.addCouncilLog(sessionId, 'system', 'Autonomous loop stopped by user.', 'info')
    }

    private async runLoop(sessionId: string) {
        let safetyLimit = 20
        while (this.activeLoops.has(sessionId) && safetyLimit > 0) {
            const session = await this.db.getCouncilSession(sessionId)
            if (!session) break

            if (session.status === 'completed' || session.status === 'failed') {
                this.activeLoops.delete(sessionId)
                break
            }

            try {
                await this.runSessionStep(sessionId)
            } catch (e: any) {
                await this.db.addCouncilLog(sessionId, 'system', `Step failed: ${e.message}`, 'error')
                // decide whether to stop or retry. for now stop.
                this.activeLoops.delete(sessionId)
                break
            }

            safetyLimit--

            // Artificial delay for reasonable pacing
            await new Promise(r => setTimeout(r, 2000))
        }

        if (safetyLimit === 0) {
            await this.db.addCouncilLog(sessionId, 'system', 'Loop safety limit reached (20 steps). Pausing.', 'error')
            this.activeLoops.delete(sessionId)
        }
    }

    async createSession(goal: string): Promise<CouncilSession> {
        return this.db.createCouncilSession(goal)
    }

    async getSession(id: string): Promise<CouncilSession | null> {
        return this.db.getCouncilSession(id)
    }

    async getSessions(): Promise<CouncilSession[]> {
        return this.db.getCouncilSessions()
    }

    async addLog(sessionId: string, agentId: string, message: string, type: 'info' | 'error' | 'success' | 'plan' | 'action' = 'info') {
        const log = await this.db.addCouncilLog(sessionId, agentId, message, type)

        // Broadcast via WebSocket for real-time "Chat"
        this.collaboration.broadcast(sessionId, {
            id: log.id,
            sessionId,
            sender: agentId,
            content: message,
            timestamp: new Date(log.timestamp).getTime(),
            type: type === 'plan' || type === 'action' ? 'code' : 'text'
        })

        return log
    }

    // Core Agent Loop (Foundation)
    async runSessionStep(sessionId: string) {
        const session = await this.db.getCouncilSession(sessionId)
        if (!session) throw new Error('Session not found')

        if (session.status === 'completed' || session.status === 'failed') return

        // Default Model/Provider (TODO: Pass in session)
        const model = 'gpt-4o'
        const provider = 'openai'

        // 1. Planner Agent Logic
        if (!session.plan) {
            await this.db.addCouncilLog(sessionId, 'planner', `Analyzing goal: "${session.goal}"...`, 'info')

            // Memory Recall: Search for similar past sessions
            let memoryContext = ''
            try {
                const memories = await this.embedding.search(session.goal, 3)
                if (memories.length > 0) {
                    const relevantMemories = memories
                        .filter((m: any) => m.score > 0.8) // Only high relevance
                        .map((m: any) => `- Past Goal: "${m.metadata.goal}"\n  Plan Used: ${m.content}`)
                        .join('\n\n')

                    if (relevantMemories) {
                        memoryContext = `\n\n**Reliable Memory (Use this experience):**\n${relevantMemories}`
                        await this.addLog(sessionId, 'planner', 'Recalled relevant past experience.', 'success')
                    }
                }
            } catch (err) {
                console.warn('Memory recall failed:', err)
            }

            try {
                const response = await this.llm.chat([
                    { role: 'system', content: PLANNER_SYSTEM_PROMPT },
                    { role: 'user', content: `Goal: ${session.goal}${memoryContext}` }
                ], model, undefined, provider)

                const plan = response.content || 'Failed to generate plan.'

                // Broadcast Plan to Chat
                await this.addLog(sessionId, 'planner', plan, 'plan')

                await this.db.updateCouncilStatus(sessionId, 'executing', plan)
            } catch (error: any) {
                await this.db.addCouncilLog(sessionId, 'planner', `Planning failed: ${error.message}`, 'error')
                await this.db.updateCouncilStatus(sessionId, 'failed')
            }
            return
        }

        // 2. Executor Agent Logic
        if (session.status === 'executing') {
            await this.db.addCouncilLog(sessionId, 'executor', 'Processing next step...', 'info')

            try {
                // Build robust context from goals + logs
                const recentLogs = session.logs.slice(-10).map(l => `[${l.agentId}]: ${l.message}`).join('\n')
                const context = `Goal: ${session.goal}\nPlan:\n${session.plan}\n\nRecent History:\n${recentLogs}\n\nCurrent Task: Execute the next logical step. If you need to run a tool, Output the JSON block.`

                const response = await this.llm.chat([
                    { role: 'system', content: EXECUTOR_SYSTEM_PROMPT },
                    { role: 'user', content: context }
                ], model, undefined, provider)

                const content = response.content || ''
                const toolCalls = this.extractToolCalls(content)

                if (toolCalls.length > 0) {
                    const toolCall = toolCalls[0] // Backward compatibility for this block
                    // In future we should loop over toolCalls like in the other block below
                    await this.db.addCouncilLog(sessionId, 'executor', `Calling tool: ${toolCall.tool}`, 'action')

                    try {
                        const result = await this.executeTool(toolCall.tool, toolCall.args)
                        await this.db.addCouncilLog(sessionId, 'system', `Tool Output:\n${result.slice(0, 500)}${result.length > 500 ? '...' : ''}`, 'success')

                        // Continue loop logic here if we were running automously.
                        // For now we stop to let user trigger next step.
                    } catch (err: any) {
                        await this.db.addCouncilLog(sessionId, 'system', `Tool Execution Failed: ${err.message}`, 'error')
                    }
                } else {
                    // No tool call, just text
                    await this.addLog(sessionId, 'executor', content, 'action')

                    // Detect Help Request
                    if (content.includes('ASK_PLANNER') || content.includes('@planner')) {
                        await this.addLog(sessionId, 'system', 'Executor requested help. Triggering Plan Revision...', 'info')
                        await this.db.updateCouncilStatus(sessionId, 'planning') // Switch back to planning mode
                        // The loop will pick this up in the next tick and run the Planner Logic
                        return
                    }

                    if (content.includes('[DONE]') || content.toLowerCase().includes('task completed')) {
                        await this.db.updateCouncilStatus(sessionId, 'completed', undefined, 'Task completed by agent.')
                        await this.addLog(sessionId, 'system', 'Session completed.', 'success')

                        // Memory Indexing: Learn from this session
                        try {
                            const memoryContent = session.plan || ''
                            // We use a virtual path to store this memory
                            await this.db.storeVector(
                                `memory://session/${sessionId}`,
                                memoryContent,
                                await this.embedding.generateEmbedding(session.goal),
                                { type: 'session', goal: session.goal, timestamp: Date.now() }
                            )
                            await this.addLog(sessionId, 'system', 'Experience memorized for future tasks.', 'success')
                        } catch (err) {
                            console.error('Failed to index memory', err)
                        }
                    }
                }

            } catch (error: any) {
                await this.db.addCouncilLog(sessionId, 'executor', `Execution failed: ${error.message}`, 'error')
            }
        }
    }

    private extractToolCalls(content: string): { tool: string, args: any }[] {
        const results: { tool: string, args: any }[] = []
        try {
            // Find all JSON blocks
            const jsonRegex = /```json\n([\s\S]*?)\n```/g
            let match
            while ((match = jsonRegex.exec(content)) !== null) {
                if (match && match[1]) {
                    try {
                        const parsed = JSON.parse(match[1])
                        if (parsed.tool && parsed.args) results.push(parsed)
                    } catch (e) {
                        console.error('Failed to parse inner JSON block:', e)
                    }
                }
            }
            // Fallback: if no blocks but raw JSON, try parsing entire content
            if (results.length === 0 && content.trim().startsWith('{')) {
                try {
                    const parsed = JSON.parse(content)
                    if (parsed.tool && parsed.args) results.push(parsed)
                } catch (e) { }
            }
        } catch (e) {
            console.error('Failed to parse tool calls:', e)
        }
        return results
    }

    private async executeTool(name: string, args: any): Promise<string> {
        switch (name) {
            case 'runCommand':
                if (!args.command) throw new Error('Missing command argument')
                // Use execute instead of spawn to get output directly for the agent
                return await this.process.execute(args.command, args.cwd || process.cwd())

            case 'readFile':
                if (!args.path) throw new Error('Missing path argument')
                const readRes = await this.fs.readFile(args.path)
                if (!readRes.success) throw new Error(readRes.error || 'Failed to read file')
                return readRes.content || ''

            case 'writeFile':
                if (!args.path || !args.content) throw new Error('Missing path or content')
                const writeRes = await this.fs.writeFile(args.path, args.content)
                if (!writeRes.success) throw new Error(writeRes.error || 'Failed to write file')
                return `File written to ${args.path}`

            case 'runScript':
                if (!args.code || !args.language) throw new Error('Missing code or language (node/python)')
                const ext = args.language === 'python' ? 'py' : 'js'
                const scriptPath = `.orbit/temp/agent_script_${Date.now()}.${ext}`

                // Ensure temp dir exists
                await this.fs.createDirectory('.orbit/temp')
                const writeScript = await this.fs.writeFile(scriptPath, args.code)
                if (!writeScript.success) throw new Error(`Failed to write script: ${writeScript.error}`)

                const cmd = args.language === 'python' ? `python "${scriptPath}"` : `node "${scriptPath}"`
                const output = await this.process.execute(cmd, process.cwd())

                // Cleanup (optional, maybe keep for debugging)
                // await this.fs.deleteFile(scriptPath)

                return `Script Output:\n${output}`

            case 'listDir':
                if (!args.path) throw new Error('Missing path argument')
                const listRes = await this.fs.listDirectory(args.path)
                if (!listRes.success) throw new Error(listRes.error || 'Failed to list directory')
                const files = listRes.files || []
                return files.map((f: any) => f.name).join('\n')

            case 'callSystem':
                if (!args.service || !args.method) throw new Error('Missing service or method')

                // Construct a service map dynamically (or typed if we want strictness)
                const services: any = {
                    llm: this.llm,
                    db: this.db,
                    fs: this.fs,
                    process: this.process,
                    codeIntel: this._codeIntel,
                    web: this._web,
                    collaboration: this.collaboration
                }

                const serviceInstance = services[args.service]
                if (!serviceInstance) throw new Error(`Service ${args.service} not found available for agents.`)

                if (typeof serviceInstance[args.method] !== 'function') {
                    throw new Error(`Method ${args.method} not found on service ${args.service}`)
                }

                // Call the method with spread args
                // args.args should be an array
                const methodArgs = Array.isArray(args.args) ? args.args : []
                const result = await serviceInstance[args.method](...methodArgs)

                // Serialize result
                return JSON.stringify(result, null, 2)

            default:
                throw new Error(`Unknown tool: ${name}`)
        }
    }
}

import { DatabaseService, CouncilSession } from './data/database.service'
import { v4 as uuidv4 } from 'uuid'
import { PLANNER_SYSTEM_PROMPT, EXECUTOR_SYSTEM_PROMPT, REVIEWER_SYSTEM_PROMPT } from './prompts/agent-prompts'
import { LLMService } from './llm/llm.service'
import { FileSystemService } from './data/filesystem.service'
import { ProcessService } from './process.service'
import { CodeIntelligenceService } from './code-intelligence.service'
import { WebService } from './web.service'

import { CollaborationService } from './collaboration.service'

import { EmbeddingService } from './llm/embedding.service'
import { JsonValue } from '../../shared/types/common'
import { getErrorMessage } from '../../shared/utils/error.util'

interface ToolCallArgs {
    command?: string;
    cwd?: string;
    path?: string;
    content?: string;
    code?: string;
    language?: 'node' | 'python';
    service?: string;
    method?: string;
    args?: JsonValue[];
}

interface ParsedToolCall {
    tool: string;
    args: ToolCallArgs;
}

/**
 * orchestrates the autonomous "Council of Agents" system.
 * 
 * Manages the lifecycle of agent sessions, executes the planning-execution loop,
 * and handles tool execution and memory retrieval.
 */
export class AgentCouncilService {
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

    /**
     * Starts an autonomous execution loop for a given session.
     * 
     * Runs in the background (fire-and-forget).
     * Enforces a safety limit of 20 steps to prevent infinite loops.
     * 
     * @param sessionId - The ID of the session to activate
     */
    async startSessionLoop(sessionId: string) {
        if (this.activeLoops.has(sessionId)) return
        this.activeLoops.add(sessionId)

        // Run in background (fire and forget from caller's perspective, but we log errors)
        this.runLoop(sessionId).catch(async (err) => {
            const message = getErrorMessage(err as Error)
            console.error('Loop error:', message)
            await this.db.addCouncilLog(sessionId, 'system', `Loop crashed: ${message}`, 'error')
            this.activeLoops.delete(sessionId)
        })
    }

    /**
     * Stops an active autonomous loop.
     * 
     * @param sessionId - The ID of the session to stop
     */
    async stopSessionLoop(sessionId: string) {
        this.activeLoops.delete(sessionId)
        await this.db.addCouncilLog(sessionId, 'system', 'Autonomous loop stopped by user.', 'info')
    }

    /**
     * Internal loop driver.
     * Executes steps sequentially until completion, failure, or safety limit.
     * @private
     */
    private async runLoop(sessionId: string) {
        const MAX_SESSION_ITERATIONS = 20;
        let safetyLimit = MAX_SESSION_ITERATIONS
        let iterations = 0;
        while (this.activeLoops.has(sessionId) && safetyLimit > 0 && iterations < MAX_SESSION_ITERATIONS) {
            const session = await this.db.getCouncilSession(sessionId)
            if (!session) break

            if (session.status === 'completed' || session.status === 'failed') {
                this.activeLoops.delete(sessionId)
                break
            }

            try {
                await this.runSessionStep(sessionId)
            } catch (e) {
                const msg = getErrorMessage(e as Error)
                await this.db.addCouncilLog(sessionId, 'system', `Step failed: ${msg}`, 'error')
                // decide whether to stop or retry. for now stop.
                this.activeLoops.delete(sessionId)
                break
            }

            safetyLimit--
            iterations++

            // Artificial delay for reasonable pacing
            await new Promise(r => setTimeout(r, 2000))
        }

        if (safetyLimit === 0 || iterations >= MAX_SESSION_ITERATIONS) {
            await this.db.addCouncilLog(sessionId, 'system', `Loop safety limit reached (${MAX_SESSION_ITERATIONS} steps). Pausing.`, 'error')
            this.activeLoops.delete(sessionId)
        }
    }

    /**
     * Initializes a new Council session with a specified goal.
     * 
     * @param goal - High-level objective
     * @returns Created session object
     */
    async createSession(goal: string): Promise<CouncilSession> {
        return this.db.createCouncilSession(goal)
    }

    /**
     * Retrieves a session by ID.
     */
    async getSession(id: string): Promise<CouncilSession | null> {
        return this.db.getCouncilSession(id)
    }

    /**
     * Retrieves all sessions.
     */
    async getSessions(): Promise<CouncilSession[]> {
        return this.db.getCouncilSessions()
    }

    /**
     * Appends a log entry and broadcasts it via WebSocket.
     * 
     * @param sessionId - Session to update
     * @param agentId - Sender ID
     * @param message - Content
     * @param type - Log type
     * @returns The created log entry
     */
    async addLog(sessionId: string, agentId: string, message: string, type: 'info' | 'error' | 'success' | 'plan' | 'action' = 'info') {
        const log = await this.db.addCouncilLog(sessionId, agentId, message, type)

        if (log) {
            // Broadcast via WebSocket for real-time "Chat"
            this.collaboration.broadcast(sessionId, {
                id: log.id,
                sessionId,
                sender: agentId,
                content: message,
                timestamp: new Date(log.timestamp).getTime(),
                type: type === 'plan' || type === 'action' ? 'code' : 'text'
            })
        }

        return log
    }

    /**
     * Executes a single step of the agent loop.
     * 
     * Logic:
     * 1. If PLANNING -> Planner.
     * 2. If EXECUTING -> Executor.
     * 3. If REVIEWING -> Reviewer.
     * 
     * @param sessionId - Active session ID
     */
    async runSessionStep(sessionId: string) {
        const session = await this.db.getCouncilSession(sessionId)
        if (!session) throw new Error('Session not found')

        if (session.status === 'completed' || session.status === 'failed') return

        // Default Model/Provider (TODO: Pass in session)
        const model = 'gpt-4o'
        const provider = 'openai'

        // 1. Planner Agent Logic
        if (!session.plan || session.status === 'planning') {
            await this.db.addCouncilLog(sessionId, 'planner', `Analyzing goal: "${session.goal}"...`, 'info')

            // Memory Recall (Deprecated: EmbeddingService.search removed)
            // TODO: Use ContextRetrievalService or new DatabaseService search methods
            const memoryContext = '' // Default to empty
            /*
            try {
                // ... logic removed ...
            } catch (err) {
                console.warn('Memory recall failed:', getErrorMessage(err as Error))
            }
            */

            try {
                const response = await this.llm.chat([
                    { role: 'system', content: PLANNER_SYSTEM_PROMPT },
                    { role: 'user', content: `Goal: ${session.goal}${memoryContext}` }
                ], model, undefined, provider)

                const plan = response.content || 'Failed to generate plan.'
                await this.addLog(sessionId, 'planner', plan, 'plan')
                await this.db.updateCouncilStatus(sessionId, 'executing', plan)
            } catch (error) {
                const msg = getErrorMessage(error as Error)
                await this.db.addCouncilLog(sessionId, 'planner', `Planning failed: ${msg}`, 'error')
                await this.db.updateCouncilStatus(sessionId, 'failed')
            }
            return
        }

        // 2. Executor Agent Logic
        if (session.status === 'executing') {
            await this.db.addCouncilLog(sessionId, 'executor', 'Processing next step...', 'info')

            try {
                const recentLogs = session.logs.slice(-15).map(l => `[${l.agentId}]: ${l.message}`).join('\n')
                const context = `Goal: ${session.goal}\nPlan:\n${session.plan}\n\nRecent History:\n${recentLogs}\n\nCurrent Task: Execute the next logical step. If you need to run a tool, Output the JSON block.`

                const response = await this.llm.chat([
                    { role: 'system', content: EXECUTOR_SYSTEM_PROMPT },
                    { role: 'user', content: context }
                ], model, undefined, provider)

                const content = response.content || ''
                const toolCalls = this.extractToolCalls(content)

                if (toolCalls.length > 0) {
                    const toolCall = toolCalls[0]
                    await this.db.addCouncilLog(sessionId, 'executor', `Calling tool: ${toolCall.tool}`, 'action')

                    try {
                        const result = await this.executeTool(toolCall.tool, toolCall.args)
                        await this.db.addCouncilLog(sessionId, 'system', `Tool Output:\n${result.slice(0, 500)}${result.length > 500 ? '...' : ''}`, 'success')
                    } catch (err) {
                        const msg = getErrorMessage(err as Error)
                        await this.db.addCouncilLog(sessionId, 'system', `Tool Execution Failed: ${msg}`, 'error')
                    }
                } else {
                    await this.addLog(sessionId, 'executor', content, 'action')

                    if (content.includes('ASK_PLANNER') || content.includes('@planner')) {
                        await this.addLog(sessionId, 'system', 'Executor requested help. Triggering Plan Revision...', 'info')
                        await this.db.updateCouncilStatus(sessionId, 'planning')
                        return
                    }

                    if (content.includes('[DONE]') || content.toLowerCase().includes('task completed')) {
                        // Check if Reviewer is active (assuming yes for now or based on session agents)
                        const reviewerActive = session.agents.some(a => a.id === '3' || a.role.toLowerCase() === 'reviewer') || true // Default to true for now to force usage

                        if (reviewerActive) {
                            await this.db.updateCouncilStatus(sessionId, 'reviewing')
                            await this.addLog(sessionId, 'system', 'Task marked as done. Requesting Review...', 'info')
                        } else {
                            await this.completeSession(sessionId, session)
                        }
                    }
                }

            } catch (error) {
                const msg = getErrorMessage(error as Error)
                await this.db.addCouncilLog(sessionId, 'executor', `Execution failed: ${msg}`, 'error')
            }
            return
        }

        // 3. Reviewer Agent Logic
        if (session.status === 'reviewing') {
            await this.db.addCouncilLog(sessionId, 'reviewer', 'Reviewing execution...', 'info')

            try {
                const recentLogs = session.logs.slice(-20).map(l => `[${l.agentId}]: ${l.message}`).join('\n')
                const context = `Goal: ${session.goal}\nPlan:\n${session.plan}\n\nSession Context:\n${recentLogs}\n\nTask: Verify if the goal is met and code is correct.`

                const response = await this.llm.chat([
                    { role: 'system', content: REVIEWER_SYSTEM_PROMPT },
                    { role: 'user', content: context }
                ], model, undefined, provider)

                const content = response.content || ''
                // Parse JSON output
                let verdict: { status: string, feedback: string } | null = null
                try {
                    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/{[\s\S]*}/)
                    if (jsonMatch) {
                        verdict = JSON.parse(jsonMatch[1] || jsonMatch[0])
                    }
                } catch (e) {
                    console.error('Failed to parse reviewer output', e)
                }

                if (verdict) {
                    await this.addLog(sessionId, 'reviewer', `Verdict: ${verdict.status.toUpperCase()}\nFeedback: ${verdict.feedback}`, 'action')

                    if (verdict.status === 'approved') {
                        await this.completeSession(sessionId, session)
                    } else {
                        // Rejected
                        await this.db.updateCouncilStatus(sessionId, 'executing')
                        await this.addLog(sessionId, 'system', 'Review rejected. Returning to Executor.', 'error')
                    }
                } else {
                    // Fallback if no JSON
                    await this.addLog(sessionId, 'reviewer', content, 'action')
                    // Assume rejection if unstructured? Or ask to retry? 
                    // For safety, assume rejection and go back to executing to fix or ask.
                    await this.db.updateCouncilStatus(sessionId, 'executing')
                    await this.addLog(sessionId, 'system', 'Review format invalid. Returning to Executor to clarify.', 'error')
                }

            } catch (error) {
                const msg = getErrorMessage(error as Error)
                await this.db.addCouncilLog(sessionId, 'reviewer', `Review failed: ${msg}`, 'error')
            }
        }
    }

    private async completeSession(sessionId: string, session: CouncilSession) {
        await this.db.updateCouncilStatus(sessionId, 'completed', undefined, 'Task completed and approved.')
        await this.addLog(sessionId, 'system', 'Session completed successfully.', 'success')

        try {
            const memoryContent = session.plan || ''
            await this.db.storeEpisodicMemory({
                id: uuidv4(),
                title: `Council Session: ${session.goal.slice(0, 50)}`,
                summary: memoryContent,
                embedding: await this.embedding.generateEmbedding(session.goal),
                startDate: session.createdAt,
                endDate: Date.now(),
                chatId: sessionId,
                participants: session.agents.map(a => a.name),
                createdAt: Date.now()
            })
            await this.addLog(sessionId, 'system', 'Experience memorized.', 'success')
        } catch (err) {
            console.error('Failed to index memory', getErrorMessage(err as Error))
        }
    }

    /**
     * Extracts tool call requests from LLM text response.
     * 
     * Supports markdown code blocks (```json) and raw JSON objects.
     * 
     * @param content - LLM output text
     * @returns Array of parsed tool calls
     */
    private extractToolCalls(content: string): ParsedToolCall[] {
        const results: ParsedToolCall[] = []
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
                } catch (e) {
                    console.error('Failed to parse tool calls raw:', e)
                }
            }
        } catch (e) {
            console.error('Failed to parse tool calls:', e)
        }
        return results
    }

    /**
     * Executes a specific tool with provided arguments.
     * 
     * @param name - Tool name
     * @param args - Tool arguments
     * @returns Tool execution logic
     */
    private async executeTool(name: string, args: ToolCallArgs): Promise<string> {
        switch (name) {
            case 'runCommand': {
                if (!args.command) throw new Error('Missing command argument')
                return await this.process.execute(args.command, args.cwd || process.cwd())
            }

            case 'readFile': {
                if (!args.path) throw new Error('Missing path argument')
                const readRes = await this.fs.readFile(args.path)
                if (!readRes.success) throw new Error(readRes.error || 'Failed to read file')
                return readRes.data || ''
            }

            case 'writeFile': {
                if (!args.path || !args.content) throw new Error('Missing path or content')
                const writeRes = await this.fs.writeFile(args.path, args.content)
                if (!writeRes.success) throw new Error(writeRes.error || 'Failed to write file')
                return `File written to ${args.path}`
            }

            case 'runScript': {
                if (!args.code || !args.language) throw new Error('Missing code or language (node/python)')
                const ext = args.language === 'python' ? 'py' : 'js'
                const scriptPath = `.orbit/temp/agent_script_${Date.now()}.${ext}`

                await this.fs.createDirectory('.orbit/temp')
                const writeScript = await this.fs.writeFile(scriptPath, args.code)
                if (!writeScript.success) throw new Error(`Failed to write script: ${writeScript.error}`)

                const cmd = args.language === 'python' ? `python "${scriptPath}"` : `node "${scriptPath}"`
                const output = await this.process.execute(cmd, process.cwd())
                return `Script Output:\n${output}`
            }

            case 'listDir': {
                if (!args.path) throw new Error('Missing path argument')
                const listRes = await this.fs.listDirectory(args.path)
                if (!listRes.success) throw new Error(listRes.error || 'Failed to list directory')
                const files = listRes.data || []
                return files.map((f: { name: string }) => f.name).join('\n')
            }

            case 'callSystem': {
                if (!args.service || !args.method) throw new Error('Missing service or method')

                const services = {
                    llm: this.llm,
                    db: this.db,
                    fs: this.fs,
                    process: this.process,
                    codeIntel: this._codeIntel,
                    web: this._web,
                    collaboration: this.collaboration
                }

                const serviceKey = args.service as keyof typeof services
                const serviceInstance = services[serviceKey]
                if (!serviceInstance) throw new Error(`Service ${args.service} not found available for agents.`)

                const methodName = args.method as keyof typeof serviceInstance
                const method = serviceInstance[methodName]
                if (typeof method !== 'function') {
                    throw new Error(`Method ${args.method} not found on service ${args.service}`)
                }

                const methodArgs = Array.isArray(args.args) ? args.args : []
                const result = await (method as (...fnArgs: JsonValue[]) => Promise<JsonValue> | JsonValue)(...methodArgs)

                return JSON.stringify(result, null, 2)
            }

            default:
                throw new Error(`Unknown tool: ${name}`)
        }
    }
}

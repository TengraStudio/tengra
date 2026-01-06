import { LLMService } from './llm.service'
import { DatabaseService } from './database.service'

export interface AgentConfig {
    id: string
    name: string
    role: string
    model: string
    provider: string
}

export interface CouncilSession {
    id: string
    projectId: string
    taskId: string
    agents: AgentConfig[]
    status: 'planning' | 'waiting_for_approval' | 'working' | 'reviewing' | 'completed' | 'failed'
    logs: { timestamp: number; agent: string; message: string }[]
    plan?: string
    solution?: string
}

import { FileSystemService } from './filesystem.service'
import { ProcessService } from './process.service'
import { CodeIntelligenceService } from './code-intelligence.service'

import { WebService } from './web.service'

export class CouncilService {
    private llmService: LLMService
    private databaseService?: DatabaseService
    private fileService?: FileSystemService
    private processService?: ProcessService
    private codeService?: CodeIntelligenceService
    private webService?: WebService
    private pendingApprovals: Map<string, (approved: boolean, editedPlan?: string) => void> = new Map()

    constructor(
        llmService: LLMService,
        databaseService?: DatabaseService,
        fileService?: FileSystemService,
        processService?: ProcessService,
        codeService?: CodeIntelligenceService,
        webService?: WebService
    ) {
        this.llmService = llmService
        this.databaseService = databaseService
        this.fileService = fileService
        this.processService = processService
        this.codeService = codeService
        this.webService = webService
        console.log('CouncilService initialized with full capabilities')
    }

    async runCouncil(projectId: string, taskDescription: string, agents: AgentConfig[], onUpdate: (data: any) => void): Promise<void> {
        const sessionId = Math.random().toString(36).substring(2, 10)
        const session: CouncilSession = {
            id: sessionId,
            projectId,
            taskId: taskDescription,
            agents,
            status: 'planning',
            logs: []
        }

        const log = (agent: string, message: string) => {
            const entry = { timestamp: Date.now(), agent, message }
            session.logs.push(entry)
            onUpdate({ sessionId, ...session })
            if (this.databaseService) {
                this.databaseService.addCouncilLog(sessionId, agent, message)
            }
            console.log(`[Council] ${agent}: ${message}`)
        }

        try {
            if (this.databaseService) {
                this.databaseService.saveCouncilSession({
                    id: sessionId,
                    projectId: session.projectId,
                    taskId: session.taskId,
                    status: session.status,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                }, agents.map(a => ({ ...a, sessionId })))
            }

            log('System', 'Starting council session...')

            // 1. Planning Stage
            session.status = 'planning'
            this.databaseService?.updateCouncilStatus(sessionId, 'planning')
            log('System', 'Consulting the Planner agent...')
            const planner = agents.find(a => a.role.toLowerCase().includes('planner')) || agents[0]

            const planningMessages = [
                { role: 'system', content: `You are a Planner. Create a detailed execution plan for the task: "${taskDescription}". Use 'read_file', 'search_files', or 'search_web' if you need to understand the codebase or external docs first.` },
                { role: 'user', content: taskDescription }
            ]
            const plan = await this.runAgentLoop(planner, session, planningMessages, 5) // Limited turns for planning

            session.plan = plan
            this.databaseService?.updateCouncilStatus(sessionId, 'planning', plan)
            log(planner.name, `Proposed Plan: ${plan}`)

            // 1.5 Waiting for Approval Stage (HITL)
            session.status = 'waiting_for_approval'
            this.databaseService?.updateCouncilStatus(sessionId, 'waiting_for_approval')
            log('System', 'Waiting for user approval of the plan...')

            const approved = await new Promise<boolean>((resolve) => {
                this.pendingApprovals.set(sessionId, (isApproved, editedPlan) => {
                    if (isApproved) {
                        if (editedPlan) {
                            session.plan = editedPlan
                            log('System', 'User approved the plan with modifications.')
                        } else {
                            log('System', 'User approved the plan.')
                        }
                    } else {
                        log('System', 'User rejected the plan.')
                    }
                    resolve(isApproved)
                })
            })

            this.pendingApprovals.delete(sessionId)

            if (!approved) {
                session.status = 'failed'
                this.databaseService?.updateCouncilStatus(sessionId, 'failed')
                log('System', 'Council execution aborted by user.')
                return
            }

            // 2. Working Stage
            session.status = 'working'
            this.databaseService?.updateCouncilStatus(sessionId, 'working')
            log('System', 'Executing the plan...')

            const builders = agents.filter(a => a.role.toLowerCase().includes('builder') || a.role.toLowerCase().includes('developer'))
            if (builders.length === 0) builders.push(agents[0])

            let currentSolution = ""
            for (const builder of builders) {
                log(builder.name, `Starting work on task...`)
                const builderMessages = [
                    {
                        role: 'system', content: `You are a Builder. You must execute the approved plan.
Task: "${taskDescription}"
Plan:
${session.plan}

You have access to tools: read_file, edit_file, run_command, search_files, find_usage, get_outline, search_web, read_page, ask_peer.
Peers available: ${session.agents.filter(a => a.id !== builder.id).map(a => `${a.name} (${a.role})`).join(', ')}.
Use 'ask_peer' to consult them if you get stuck or need a second opinion.
Use them to verify your work. When finished, summarize your changes.` },
                    { role: 'user', content: "Please start executing the plan." }
                ]

                const contribution = await this.runAgentLoop(builder, session, builderMessages, 15) // More turns for execution
                currentSolution += `\n\n--- ${builder.name}'s Contribution ---\n${contribution}`
                log(builder.name, `Work completed.`)
            }

            // 3. Reviewing Stage
            session.status = 'reviewing'
            this.databaseService?.updateCouncilStatus(sessionId, 'reviewing', undefined, currentSolution)
            log('System', 'Reviewing the final solution...')
            const reviewer = agents.find(a => a.role.toLowerCase().includes('reviewer')) || agents[agents.length - 1]

            const reviewerMessages = [
                {
                    role: 'system', content: `You are a Reviewer. Review the work done by the builders.
Task: "${taskDescription}"
Plan: ${session.plan}
Solution Context: ${currentSolution}

Check if the changes match the plan and if there are obvious errors. You can use 'read_file' to check the actual files.` },
                { role: 'user', content: "Please review the implementation." }
            ]

            const review = await this.runAgentLoop(reviewer, session, reviewerMessages, 5)
            log(reviewer.name, `Review: ${review}`)

            session.status = 'completed'
            session.solution = currentSolution + `\n\nReview: ${review}`
            this.databaseService?.updateCouncilStatus(sessionId, 'completed', undefined, session.solution)
            log('System', 'Council session finished successfully.')
            onUpdate({ sessionId, ...session, finalResult: session.solution })

        } catch (error: any) {
            session.status = 'failed'
            log('System', `Error: ${error.message}`)
            onUpdate({ sessionId, ...session, error: error.message })
        }
    }

    approvePlan(sessionId: string, approved: boolean, editedPlan?: string) {
        const waiter = this.pendingApprovals.get(sessionId)
        if (waiter) {
            waiter(approved, editedPlan)
            return true
        }
        return false
    }

    async generateAgentsForTask(taskDescription: string): Promise<AgentConfig[]> {
        const prompt = `You are a Principal Architect. Your goal is to assemble the perfect team of AI agents for the following task:
"${taskDescription}"

Select exactly 3-4 agents. For each agent, provide:
1. Name
2. Role (e.g., Planner, UI/UX Designer, Frontend Developer, Backend Engineer, QA Reviewer)
3. Specialized Knowledge (Briefly)

Only return a valid JSON array of objects with keys: name, role, model, provider.
Use 'gpt-4o' or 'claude-3-5-sonnet' for complex roles, and 'gemini-1.5-flash' for faster roles.
Provider should be 'antigravity'.

Example format:
[
  {"name": "Stratis", "role": "Planning Architect", "model": "gpt-4o", "provider": "antigravity"},
  ...
]`

        try {
            const res = await this.llmService.chat([{ role: 'user', content: prompt }], 'gpt-4o', [], 'antigravity')
            const content = res.content.replace(/```json|```/g, '').trim()
            const agents = JSON.parse(content)
            return agents.map((a: any) => ({ ...a, id: Math.random().toString(36).substring(2, 10) }))
        } catch (e) {
            console.error('Failed to generate agents:', e)
            // Fallback to default team
            return [
                { id: '1', name: 'Planner', role: 'Strategic Planner', model: 'gpt-4o', provider: 'antigravity' },
                { id: '2', name: 'Developer', role: 'Builder', model: 'claude-3-5-sonnet', provider: 'antigravity' },
                { id: '3', name: 'Reviewer', role: 'Code Reviewer', model: 'gemini-1.5-flash', provider: 'antigravity' }
            ]
        }
    }

    // Phase 3: Autonomous Agent Loop
    private async runAgentLoop(agent: AgentConfig, session: CouncilSession, messages: any[], maxTurns: number = 10): Promise<string> {
        let turn = 0
        let finalResponse = ""
        console.log(`[AgentLoop] Starting loop for agent ${agent.name} in session ${session.id}`)

        // Define Tool Definitions
        const tools = [
            {
                type: 'function',
                function: {
                    name: 'read_file',
                    description: 'Read the contents of a file at the given path.',
                    parameters: {
                        type: 'object',
                        properties: { path: { type: 'string', description: 'Absolute path to file' } },
                        required: ['path']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'edit_file',
                    description: 'Replace a specific range of lines in a file with new content. Use this for surgical edits.',
                    parameters: {
                        type: 'object',
                        properties: {
                            path: { type: 'string', description: 'Absolute path to file' },
                            startLine: { type: 'integer', description: 'Line number to start replacing (1-indexed)' },
                            endLine: { type: 'integer', description: 'Line number to end replacing (1-indexed, inclusive)' },
                            replacement: { type: 'string', description: 'New content to insert' }
                        },
                        required: ['path', 'startLine', 'endLine', 'replacement']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'run_command',
                    description: 'Run a shell command (e.g. npm test, ls, git status).',
                    parameters: {
                        type: 'object',
                        properties: {
                            command: { type: 'string', description: 'Command to run' },
                            cwd: { type: 'string', description: 'WorkingDirectory (optional, defaults to project root)' }
                        },
                        required: ['command']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'search_files',
                    description: 'Search for files containing specific text or matching a regex.',
                    parameters: {
                        type: 'object',
                        properties: {
                            rootPath: { type: 'string', description: 'Directory to search in' },
                            query: { type: 'string', description: 'Text or regex to search for' },
                            isRegex: { type: 'boolean', description: 'Treat query as regex' }
                        },
                        required: ['query']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'read_page',
                    description: 'Read the content of a web page.',
                    parameters: {
                        type: 'object',
                        properties: {
                            url: { type: 'string', description: 'URL to read' },
                        },
                        required: ['url']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'ask_peer',
                    description: 'Ask another agent for help or information. Use this to consult experts (e.g. Developer asking Reviewer).',
                    parameters: {
                        type: 'object',
                        properties: {
                            peerRole: { type: 'string', description: 'Role of the agent to ask (e.g., "Reviewer", "Planner")' },
                            question: { type: 'string', description: 'The question or request for the peer.' }
                        },
                        required: ['peerRole', 'question']
                    }
                }
            }
        ]

        while (turn < maxTurns) {
            turn++
            console.log(`[AgentLoop] ${agent.name} Turn ${turn}`)

            try {
                // 1. Think
                const res = await this.llmService.chat(messages, agent.model, tools, agent.provider)

                // 2. Act (or Finish)
                if (res.tool_calls && res.tool_calls.length > 0) {
                    messages.push({ role: 'assistant', content: res.content || null, tool_calls: res.tool_calls })

                    for (const call of res.tool_calls) {
                        const fn = call.function.name
                        const args = JSON.parse(call.function.arguments)
                        let result: any = "Success"

                        console.log(`[AgentLoop] Invoking ${fn} with`, args)

                        try {
                            if (fn === 'read_file') {
                                const res = await this.fileService?.readFile(args.path)
                                result = res?.success ? res.content : `Error: ${res?.error}`
                            } else if (fn === 'edit_file') {
                                const res = await this.fileService?.applyEdits(args.path, [{
                                    startLine: args.startLine,
                                    endLine: args.endLine,
                                    replacement: args.replacement
                                }])
                                result = res?.success ? res.message : `Error: ${res?.error}`
                            } else if (fn === 'run_command') {
                                const res = await this.processService?.execute(args.command, args.cwd || args.path)
                                result = res
                            } else if (fn === 'search_files') {
                                const res = await this.codeService?.searchFiles(args.rootPath || args.path, args.query, args.isRegex)
                                result = JSON.stringify(res)
                            } else if (fn === 'find_usage') {
                                const res = await this.codeService?.findUsage(args.rootPath || args.path, args.symbol)
                                result = JSON.stringify(res)
                            } else if (fn === 'get_outline') {
                                const res = await this.codeService?.getFileDimensions(args.path)
                                result = JSON.stringify(res)
                            } else if (fn === 'search_web') {
                                if (this.webService) {
                                    const res = await this.webService.searchWeb(args.query)
                                    result = JSON.stringify(res)
                                } else {
                                    result = "Error: WebService not available."
                                }
                            } else if (fn === 'read_page') {
                                if (this.webService) {
                                    const res = await this.webService.fetchWebPage(args.url)
                                    result = JSON.stringify(res)
                                } else {
                                    result = "Error: WebService not available."
                                }
                            } else if (fn === 'ask_peer') {
                                const targetRole = args.peerRole.toLowerCase()
                                const peer = session.agents.find(a => a.role.toLowerCase().includes(targetRole))

                                if (peer && peer.id !== agent.id) {
                                    console.log(`[AgentLoop] ${agent.name} asking ${peer.name}: ${args.question}`)
                                    // Recursive call to runAgentLoop for the peer
                                    // We give the peer a specific task: Answer the question
                                    const peerMessages = [
                                        { role: 'system', content: `You are ${peer.name} (${peer.role}). Your colleague ${agent.name} (${agent.role}) is asking for your help.\ncontext of the main task: "${session.taskId}"\n\nQuestion: "${args.question}"\n\nProvide a helpful, direct answer.` },
                                        { role: 'user', content: args.question }
                                    ]
                                    const peerResponse = await this.runAgentLoop(peer, session, peerMessages, 3) // Short loop for questions
                                    result = `Answer from ${peer.name}: ${peerResponse}`
                                } else {
                                    result = `Error: Could not find a peer with role "${args.peerRole}" (or you tried to ask yourself). Available peers: ${session.agents.map(a => a.role).join(', ')}`
                                }
                            } else {
                                result = `Unknown tool: ${fn}`
                            }
                        } catch (err: any) {
                            result = `Error executing ${fn}: ${err.message}`
                        }

                        messages.push({
                            role: 'tool',
                            tool_call_id: call.id,
                            name: fn,
                            content: typeof result === 'string' ? result : JSON.stringify(result)
                        })
                    }
                } else {
                    // No tool calls, just response
                    messages.push({ role: 'assistant', content: res.content })
                    finalResponse = res.content
                    break
                }

            } catch (e: any) {
                console.error(`[AgentLoop] Error:`, e)
                messages.push({ role: 'system', content: `Error encountered: ${e.message}` })
                break;
            }
        }

        return finalResponse
    }
}

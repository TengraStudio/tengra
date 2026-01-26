import { CouncilLog, CouncilSession, DatabaseService } from '@main/services/data/database.service';
import { FileSystemService } from '@main/services/data/filesystem.service';
import { CollaborationService } from '@main/services/external/collaboration.service';
import { WebService } from '@main/services/external/web.service';
import { BrainService } from '@main/services/llm/brain.service';
import { EmbeddingService } from '@main/services/llm/embedding.service';
import { LLMService } from '@main/services/llm/llm.service';
import { CodeIntelligenceService } from '@main/services/project/code-intelligence.service';
import { EXECUTOR_SYSTEM_PROMPT, PLANNER_SYSTEM_PROMPT, REVIEWER_SYSTEM_PROMPT } from '@main/services/prompts/agent-prompts';
import { ProcessService } from '@main/services/system/process.service';
import { JsonValue } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { v4 as uuidv4 } from 'uuid';

/** Tool permission levels */
type ToolPermission = 'allowed' | 'restricted' | 'forbidden';

/** Tool permission configuration */
interface ToolPermissions {
    runCommand: ToolPermission;
    readFile: ToolPermission;
    writeFile: ToolPermission;
    runScript: ToolPermission;
    listDir: ToolPermission;
    callSystem: ToolPermission;
}

/** Default tool permissions (secure defaults) */
const DEFAULT_TOOL_PERMISSIONS: ToolPermissions = {
    runCommand: 'restricted',  // Requires path validation
    readFile: 'allowed',
    writeFile: 'restricted',   // Requires path validation
    runScript: 'restricted',   // Sandboxed execution
    listDir: 'allowed',
    callSystem: 'forbidden'    // Disabled by default - too powerful
};

/** Allowed services for callSystem tool (whitelist) */
const ALLOWED_SYSTEM_SERVICES = ['codeIntel', 'web'] as const;

/** Protected paths that cannot be modified */
const PROTECTED_PATHS = [
    /node_modules/i,
    /\.git/i,
    /\.env/i,
    /package-lock\.json/i,
    /yarn\.lock/i,
    /pnpm-lock\.yaml/i
];

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
export interface AgentCouncilDependencies {
    llm: LLMService;
    db: DatabaseService;
    fs: FileSystemService;
    process: ProcessService;
    codeIntel: CodeIntelligenceService;
    web: WebService;
    collaboration: CollaborationService;
    embedding: EmbeddingService;
    brain: BrainService;
}

export class AgentCouncilService {
    private activeLoops = new Set<string>();
    private currentSessionId: string | null = null;
    private toolPermissions: ToolPermissions = { ...DEFAULT_TOOL_PERMISSIONS };

    constructor(private deps: AgentCouncilDependencies) { }

    /**
     * Configure tool permissions for the council.
     * @param permissions - Partial permission overrides
     */
    setToolPermissions(permissions: Partial<ToolPermissions>): void {
        this.toolPermissions = { ...this.toolPermissions, ...permissions };
    }

    /**
     * Starts an autonomous execution loop for a given session.
     * 
     * Runs in the background (fire-and-forget).
     * Enforces a safety limit of 20 steps to prevent infinite loops.
     * 
     * @param sessionId - The ID of the session to activate
     */
    async startSessionLoop(sessionId: string) {
        if (this.activeLoops.has(sessionId)) { return; }
        this.activeLoops.add(sessionId);

        // Run in background (fire and forget from caller's perspective, but we log errors)
        this.runLoop(sessionId).catch(async (err) => {
            const message = getErrorMessage(err as Error);
            console.error('Loop error:', message);
            await this.deps.db.addCouncilLog(sessionId, 'system', `Loop crashed: ${message}`, 'error');
            this.activeLoops.delete(sessionId);
        });
    }

    /**
     * Stops an active autonomous loop.
     * 
     * @param sessionId - The ID of the session to stop
     */
    async stopSessionLoop(sessionId: string) {
        this.activeLoops.delete(sessionId);
        await this.deps.db.addCouncilLog(sessionId, 'system', 'Autonomous loop stopped by user.', 'info');
    }

    /**
     * Internal loop driver.
     * Executes steps sequentially until completion, failure, or safety limit.
     * Includes retry logic with exponential backoff for transient failures.
     * @private
     */
    private async runLoop(sessionId: string) {
        // Set current session context for diff tracking
        this.currentSessionId = sessionId;

        const MAX_SESSION_ITERATIONS = 20;
        const MAX_RETRIES = 3;
        let safetyLimit = MAX_SESSION_ITERATIONS;
        let iterations = 0;
        let consecutiveErrors = 0;

        while (this.activeLoops.has(sessionId) && safetyLimit > 0 && iterations < MAX_SESSION_ITERATIONS) {
            const session = await this.deps.db.getCouncilSession(sessionId);
            if (!session) { break; }

            if (session.status === 'completed' || session.status === 'failed') {
                this.activeLoops.delete(sessionId);
                this.currentSessionId = null;
                break;
            }

            try {
                await this.runSessionStep(sessionId);
                consecutiveErrors = 0; // Reset on success
            } catch (e) {
                const msg = getErrorMessage(e as Error);
                consecutiveErrors++;

                // Check if error is retryable (rate limits, network issues)
                const isRetryable = this.isRetryableError(msg);

                if (isRetryable && consecutiveErrors < MAX_RETRIES) {
                    const backoffMs = Math.min(1000 * Math.pow(2, consecutiveErrors), 30000);
                    await this.deps.db.addCouncilLog(
                        sessionId, 'system',
                        `Step failed (attempt ${consecutiveErrors}/${MAX_RETRIES}): ${msg}. Retrying in ${backoffMs / 1000}s...`,
                        'error'
                    );
                    await new Promise(r => setTimeout(r, backoffMs));
                    continue; // Retry without incrementing iterations
                }

                // Non-retryable or max retries exceeded
                await this.deps.db.addCouncilLog(
                    sessionId, 'system',
                    `Step failed permanently after ${consecutiveErrors} attempts: ${msg}`,
                    'error'
                );
                this.activeLoops.delete(sessionId);
                this.currentSessionId = null;
                break;
            }

            safetyLimit--;
            iterations++;

            // Artificial delay for reasonable pacing
            await new Promise(r => setTimeout(r, 2000));
        }

        if (safetyLimit === 0 || iterations >= MAX_SESSION_ITERATIONS) {
            await this.deps.db.addCouncilLog(sessionId, 'system', `Loop safety limit reached (${MAX_SESSION_ITERATIONS} steps). Pausing.`, 'error');
            this.activeLoops.delete(sessionId);
        }

        // Clear session context
        this.currentSessionId = null;
    }

    /**
     * Determines if an error is retryable (transient failures).
     */
    private isRetryableError(errorMsg: string): boolean {
        const retryablePatterns = [
            /rate.?limit/i,
            /429/i,
            /quota/i,
            /timeout/i,
            /ECONNRESET/i,
            /ETIMEDOUT/i,
            /network/i,
            /temporarily.?unavailable/i
        ];
        return retryablePatterns.some(pattern => pattern.test(errorMsg));
    }

    /**
     * Initializes a new Council session with a specified goal.
     * 
     * @param goal - High-level objective
     * @param model - Optional model override (default: gpt-4o)
     * @param provider - Optional provider override (default: openai)
     * @returns Created session object
     */
    async createSession(goal: string, model?: string, provider?: string): Promise<CouncilSession> {
        return (await this.deps.db.createCouncilSession(goal, model, provider)) as CouncilSession;
    }

    /**
     * Retrieves a session by ID.
     */
    async getSession(id: string): Promise<CouncilSession | null> {
        return (await this.deps.db.getCouncilSession(id)) ?? null;
    }

    /**
     * Retrieves all sessions.
     */
    async getSessions(): Promise<CouncilSession[]> {
        return this.deps.db.getCouncilSessions();
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
        const log = (await this.deps.db.addCouncilLog(sessionId, agentId, message, type)) as CouncilLog | undefined;

        if (log) {
            // Broadcast via WebSocket for real-time "Chat"
            this.deps.collaboration.broadcast(sessionId, {
                id: log.id,
                sessionId,
                sender: agentId,
                content: message,
                timestamp: new Date(log.timestamp).getTime(),
                type: type === 'plan' || type === 'action' ? 'code' : 'text'
            });
        }

        return log;
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
        const session = await this.deps.db.getCouncilSession(sessionId);
        if (!session) { throw new Error('Session not found'); }

        if (session.status === 'completed' || session.status === 'failed') { return; }

        // Use session-configured model/provider or defaults
        const model = session.model ?? 'gpt-4o';
        const provider = session.provider ?? 'openai';

        if (!session.plan || session.status === 'planning') {
            await this.handlePlanningStep(sessionId, session, model, provider);
            return;
        }

        if (session.status === 'executing') {
            await this.handleExecutionStep(sessionId, session, model, provider);
            return;
        }

        if (session.status === 'reviewing') {
            await this.handleReviewStep(sessionId, session, model, provider);
        }
    }

    private async handlePlanningStep(sessionId: string, session: CouncilSession, model: string, provider: string) {
        await this.deps.db.addCouncilLog(sessionId, 'planner', `Analyzing goal: "${session.goal}"...`, 'info');

        try {
            // Get brain context about the user
            const brainContext = await this.deps.brain.getBrainContext(session.goal);
            const formattedBrain = this.deps.brain.formatBrainContext(brainContext);

            const systemPrompt = formattedBrain
                ? `${PLANNER_SYSTEM_PROMPT}\n\n${formattedBrain}`
                : PLANNER_SYSTEM_PROMPT;

            const response = await this.deps.llm.chat([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Goal: ${session.goal}` }
            ], model, undefined, provider);

            const plan = response.content;
            await this.addLog(sessionId, 'planner', plan, 'plan');
            await this.deps.db.updateCouncilStatus(sessionId, 'executing', plan);
        } catch (error) {
            const msg = getErrorMessage(error as Error);
            await this.deps.db.addCouncilLog(sessionId, 'planner', `Planning failed: ${msg}`, 'error');
            await this.deps.db.updateCouncilStatus(sessionId, 'failed');
        }
    }

    private async handleExecutionStep(sessionId: string, session: CouncilSession, model: string, provider: string) {
        await this.deps.db.addCouncilLog(sessionId, 'executor', 'Processing next step...', 'info');

        try {
            const recentLogs = session.logs.slice(-15).map(l => `[${l.agentId}]: ${l.message}`).join('\n');
            const context = `Goal: ${session.goal}\nPlan:\n${session.plan}\n\nRecent History:\n${recentLogs}\n\nCurrent Task: Execute the next logical step. If you need to run a tool, Output the JSON block.`;

            // Get brain context about the user
            const brainContext = await this.deps.brain.getBrainContext(session.goal);
            const formattedBrain = this.deps.brain.formatBrainContext(brainContext);

            const systemPrompt = formattedBrain
                ? `${EXECUTOR_SYSTEM_PROMPT}\n\n${formattedBrain}`
                : EXECUTOR_SYSTEM_PROMPT;

            const response = await this.deps.llm.chat([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: context }
            ], model, undefined, provider);

            const content = response.content;
            const toolCalls = this.extractToolCalls(content);

            if (toolCalls.length > 0) {
                await this.handleToolCalls(sessionId, toolCalls);
            } else {
                await this.handleTerminalContent(sessionId, session, content);
            }
        } catch (error) {
            const msg = getErrorMessage(error as Error);
            await this.deps.db.addCouncilLog(sessionId, 'executor', `Execution failed: ${msg}`, 'error');
        }
    }

    private async handleToolCalls(sessionId: string, toolCalls: ParsedToolCall[]) {
        const toolCall = toolCalls[0];
        await this.deps.db.addCouncilLog(sessionId, 'executor', `Calling tool: ${toolCall.tool}`, 'action');

        try {
            const result = await this.executeTool(toolCall.tool, toolCall.args);
            const summary = result.length > 500 ? `${result.slice(0, 500)}...` : result;
            await this.deps.db.addCouncilLog(sessionId, 'system', `Tool Output:\n${summary}`, 'success');
        } catch (err) {
            const msg = getErrorMessage(err as Error);
            await this.deps.db.addCouncilLog(sessionId, 'system', `Tool Execution Failed: ${msg}`, 'error');
        }
    }

    private async handleTerminalContent(sessionId: string, session: CouncilSession, content: string) {
        await this.addLog(sessionId, 'executor', content, 'action');

        if (content.includes('ASK_PLANNER') || content.includes('@planner')) {
            await this.addLog(sessionId, 'system', 'Executor requested help. Triggering Plan Revision...', 'info');
            await this.deps.db.updateCouncilStatus(sessionId, 'planning');
            return;
        }

        if (content.includes('[DONE]') || content.toLowerCase().includes('task completed')) {
            const reviewerActive = session.agents.some(a => a.id === '3' || a.role.toLowerCase() === 'reviewer');
            if (reviewerActive) {
                await this.deps.db.updateCouncilStatus(sessionId, 'reviewing');
                await this.addLog(sessionId, 'system', 'Task marked as done. Requesting Review...', 'info');
            } else {
                await this.completeSession(sessionId, session);
            }
        }
    }

    private async handleReviewStep(sessionId: string, session: CouncilSession, model: string, provider: string) {
        await this.deps.db.addCouncilLog(sessionId, 'reviewer', 'Reviewing execution...', 'info');

        try {
            const recentLogs = session.logs.slice(-20).map(l => `[${l.agentId}]: ${l.message}`).join('\n');
            const context = `Goal: ${session.goal}\nPlan:\n${session.plan}\n\nSession Context:\n${recentLogs}\n\nTask: Verify if the goal is met and code is correct.`;

            // Get brain context about the user
            const brainContext = await this.deps.brain.getBrainContext(session.goal);
            const formattedBrain = this.deps.brain.formatBrainContext(brainContext);

            const systemPrompt = formattedBrain
                ? `${REVIEWER_SYSTEM_PROMPT}\n\n${formattedBrain}`
                : REVIEWER_SYSTEM_PROMPT;

            const response = await this.deps.llm.chat([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: context }
            ], model, undefined, provider);

            const content = response.content;
            const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) ?? content.match(/{[\s\S]*}/);
            const verdict = jsonMatch
                ? safeJsonParse<{ status: string, feedback: string } | null>(jsonMatch[1] ?? jsonMatch[0], null)
                : null;

            if (verdict) {
                await this.addLog(sessionId, 'reviewer', `Verdict: ${verdict.status.toUpperCase()}\nFeedback: ${verdict.feedback}`, 'action');

                if (verdict.status === 'approved') {
                    await this.completeSession(sessionId, session);
                } else {
                    await this.deps.db.updateCouncilStatus(sessionId, 'executing');
                    await this.addLog(sessionId, 'system', 'Review rejected. Returning to Executor.', 'error');
                }
            } else {
                await this.addLog(sessionId, 'reviewer', content, 'action');
                await this.deps.db.updateCouncilStatus(sessionId, 'executing');
                await this.addLog(sessionId, 'system', 'Review format invalid. Returning to Executor to clarify.', 'error');
            }
        } catch (error) {
            const msg = getErrorMessage(error as Error);
            await this.deps.db.addCouncilLog(sessionId, 'reviewer', `Review failed: ${msg}`, 'error');
        }
    }

    private async completeSession(sessionId: string, session: CouncilSession) {
        await this.deps.db.updateCouncilStatus(sessionId, 'completed', undefined, 'Task completed and approved.');
        await this.addLog(sessionId, 'system', 'Session completed successfully.', 'success');

        try {
            const memoryContent = session.plan ?? '';
            await this.deps.db.storeEpisodicMemory({
                id: uuidv4(),
                title: `Council Session: ${session.goal.slice(0, 50)}`,
                summary: memoryContent,
                embedding: await this.deps.embedding.generateEmbedding(session.goal),
                startDate: session.createdAt,
                endDate: Date.now(),
                chatId: sessionId,
                participants: session.agents.map(a => a.name),
                createdAt: Date.now(),
                timestamp: Date.now()
            });
            await this.addLog(sessionId, 'system', 'Experience memorized.', 'success');
        } catch (err) {
            console.error('Failed to index memory', getErrorMessage(err as Error));
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
        const blocks = this.parseJsonBlocks(content);
        if (blocks.length > 0) { return blocks; }
        return this.parseRawJson(content);
    }

    private parseJsonBlocks(content: string): ParsedToolCall[] {
        const results: ParsedToolCall[] = [];
        const jsonRegex = /```json\n([\s\S]*?)\n```/g;
        let match;
        while ((match = jsonRegex.exec(content)) !== null) {
            const inner = match[1];
            if (inner) {
                const parsed = safeJsonParse<{ tool?: string; args?: ToolCallArgs } | null>(inner, null);
                if (parsed?.tool && parsed.args) {
                    results.push(parsed as { tool: string; args: ToolCallArgs });
                }
            }
        }
        return results;
    }

    private parseRawJson(content: string): ParsedToolCall[] {
        if (content.trim().startsWith('{')) {
            const parsed = safeJsonParse<{ tool?: string; args?: ToolCallArgs } | null>(content, null);
            if (parsed?.tool && parsed.args) {
                return [parsed as { tool: string; args: ToolCallArgs }];
            }
        }
        return [];
    }

    /**
     * Checks if a path is protected from modification.
     */
    private isProtectedPath(filePath: string): boolean {
        return PROTECTED_PATHS.some(pattern => pattern.test(filePath));
    }

    /**
     * Validates tool permission before execution.
     */
    private validateToolPermission(toolName: keyof ToolPermissions, args?: ToolCallArgs): void {
        const permission = this.toolPermissions[toolName];

        if (permission === 'forbidden') {
            throw new Error(`Tool '${toolName}' is disabled for security reasons`);
        }

        if (permission === 'restricted') {
            // Additional validation for restricted tools
            if (toolName === 'writeFile' && args?.path && this.isProtectedPath(args.path)) {
                throw new Error(`Cannot modify protected path: ${args.path}`);
            }
            if (toolName === 'runCommand' && args?.command) {
                // Block potentially dangerous commands
                const dangerousPatterns = [/rm\s+-rf/i, /del\s+\/s/i, /format\s+/i, /mkfs/i];
                if (dangerousPatterns.some(p => p.test(args.command!))) {
                    throw new Error('Potentially dangerous command blocked');
                }
            }
        }
    }

    /**
     * Executes a specific tool with provided arguments.
     * Includes permission validation before execution.
     * 
     * @param name - Tool name
     * @param args - Tool arguments
     * @returns Tool execution result
     */
    private async executeTool(name: string, args: ToolCallArgs): Promise<string> {
        // Validate permission before executing
        if (name in this.toolPermissions) {
            this.validateToolPermission(name as keyof ToolPermissions, args);
        }

        switch (name) {
            case 'runCommand': return this.toolRunCommand(args);
            case 'readFile': return this.toolReadFile(args);
            case 'writeFile': return this.toolWriteFile(args);
            case 'runScript': return this.toolRunScript(args);
            case 'listDir': return this.toolListDir(args);
            case 'callSystem': return this.toolCallSystem(args);
            default: throw new Error(`Unknown tool: ${name}`);
        }
    }

    private async toolRunCommand(args: ToolCallArgs): Promise<string> {
        if (!args.command) { throw new Error('Missing command argument'); }
        return await this.deps.process.execute(args.command, args.cwd ?? process.cwd());
    }

    private async toolReadFile(args: ToolCallArgs): Promise<string> {
        if (!args.path) { throw new Error('Missing path argument'); }
        const readRes = await this.deps.fs.readFile(args.path);
        if (!readRes.success) { throw new Error(readRes.error ?? 'Failed to read file'); }
        return readRes.data ?? '';
    }

    private async toolWriteFile(args: ToolCallArgs): Promise<string> {
        if (!args.path || !args.content) { throw new Error('Missing path or content'); }

        // Use tracking-enabled writeFile for Council system
        const writeRes = await this.deps.fs.writeFileWithTracking(args.path, args.content, {
            aiSystem: 'council',
            chatSessionId: this.currentSessionId ?? undefined,
            changeReason: 'Council agent file modification',
            metadata: {
                toolName: 'writeFile',
                councilSessionId: this.currentSessionId
            }
        });

        if (!writeRes.success) { throw new Error(writeRes.error ?? 'Failed to write file'); }
        return `File written to ${args.path}`;
    }

    private async toolRunScript(args: ToolCallArgs): Promise<string> {
        if (!args.code || !args.language) { throw new Error('Missing code or language (node/python)'); }
        const ext = args.language === 'python' ? 'py' : 'js';
        const scriptPath = `.orbit/temp/agent_script_${Date.now()}.${ext}`;
        await this.deps.fs.createDirectory('.orbit/temp');
        const writeScript = await this.deps.fs.writeFile(scriptPath, args.code);
        if (!writeScript.success) { throw new Error(`Failed to write script: ${writeScript.error}`); }
        const cmd = args.language === 'python' ? `python "${scriptPath}"` : `node "${scriptPath}"`;
        const output = await this.deps.process.execute(cmd, process.cwd());
        return `Script Output:\n${output}`;
    }

    private async toolListDir(args: ToolCallArgs): Promise<string> {
        if (!args.path) { throw new Error('Missing path argument'); }
        const listRes = await this.deps.fs.listDirectory(args.path);
        if (!listRes.success) { throw new Error(listRes.error ?? 'Failed to list directory'); }
        const files = listRes.data ?? [];
        return files.map((f: { name: string }) => f.name).join('\n');
    }

    private async toolCallSystem(args: ToolCallArgs): Promise<string> {
        if (!args.service || !args.method) { throw new Error('Missing service or method'); }

        // Security: Only allow whitelisted services
        if (!ALLOWED_SYSTEM_SERVICES.includes(args.service as typeof ALLOWED_SYSTEM_SERVICES[number])) {
            throw new Error(`Service '${args.service}' is not allowed. Permitted services: ${ALLOWED_SYSTEM_SERVICES.join(', ')}`);
        }

        const services = {
            codeIntel: this.deps.codeIntel,
            web: this.deps.web
        };
        const serviceInstance = (services as Record<string, unknown>)[args.service];
        if (!serviceInstance) { throw new Error(`Service ${args.service} not found available for agents.`); }
        const methodName = args.method as keyof typeof serviceInstance;
        const method = serviceInstance[methodName];
        if (typeof method !== 'function') { throw new Error(`Method ${args.method} not found on service ${args.service}`); }
        const methodArgs = Array.isArray(args.args) ? args.args : [];
        const result = await (method as (...fnArgs: import('@shared/types/common').JsonValue[]) => Promise<import('@shared/types/common').JsonValue> | import('@shared/types/common').JsonValue)(...methodArgs);
        return JSON.stringify(result, null, 2);
    }
}

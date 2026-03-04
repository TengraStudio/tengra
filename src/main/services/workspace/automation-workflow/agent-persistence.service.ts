/**
 * Agent Persistence Service
 * 
 * Handles atomic database operations for agent state persistence
 * NASA Rule #7: All return values must be checked
 */

import { randomUUID } from 'crypto';

import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import {
    AgentError,
    AgentEventRecord,
    AgentState,
    AgentTaskState,
    ExecutionPlan,
    ProviderAttempt,
    ProviderConfig,
    ToolCallExecution,
    ToolExecutionStatus
} from '@shared/types/agent-state';
import { Message } from '@shared/types/chat';
import { getErrorMessage } from '@shared/utils/error.util';

/**
 * Database row type for agent_tasks table
 */
interface TaskRow {
    id: string;
    project_id: string;
    description: string;
    state: string;
    current_step: number;
    total_steps: number;
    execution_plan: string | null;
    context: string;
    current_provider: string;
    recovery_attempts: number;
    total_tokens_used: number;
    total_llm_calls: number;
    total_tool_calls: number;
    created_at: string;
    updated_at: string;
    started_at: string | null;
    completed_at: string | null;
    result: string | null;
    estimated_cost: number | null;
}

/**
 * Database row type for agent_messages table
 */
interface MessageRow {
    id: string;
    task_id: string;
    role: string;
    content: string | null;
    tool_calls: string | null;
    images: string | null;
    sequence_number: number;
    timestamp: string;
}

/**
 * Database row type for agent_tool_executions table
 */
interface ToolExecutionRow {
    id: string;
    task_id: string;
    tool_name: string;
    arguments: string | null;
    status: string;
    result: string | null;
    error: string | null;
    started_at: string;
    completed_at: string | null;
    duration_ms: number | null;
}

/**
 * Database row type for agent_provider_history table
 */
interface ProviderHistoryRow {
    id: string;
    task_id: string;
    provider: string;
    model: string;
    attempt_number: number;
    status: string;
    error: string | null;
    timestamp: string;
}

/**
 * Database row type for agent_checkpoints table
 */
interface CheckpointRow {
    id: string;
    task_id: string;
    step_index: number;
    state_snapshot: string;
    created_at: string;
}

/**
 * Checkpoint record
 */
export interface Checkpoint {
    id: string;
    taskId: string;
    stepIndex: number;
    state: AgentTaskState;
    createdAt: Date;
}

/**
 * Persistence service for agent state
 * Provides transactional operations for zero-loss task resumption
 */
export class AgentPersistenceService extends BaseService {
    private writeQueue: Promise<void> = Promise.resolve();

    constructor(private databaseService: DatabaseService) {
        super('AgentPersistenceService');
    }

    /**
     * Initialize service and run schema migrations
     * NASA Rule #7: Check return value
     */
    async initialize(): Promise<void> {
        this.logInfo('Initializing agent persistence...');

        try {
            await this.runMigrations();
            const staleTasks = await this.scanStaleTasks();
            if (staleTasks.length > 0) {
                this.logWarn(`Found ${staleTasks.length} stale task(s) on startup: ${staleTasks.join(', ')}`);
            }
            this.logInfo('Agent persistence initialized successfully');
        } catch (error) {
            this.logError('Failed to initialize agent persistence', error as Error);
            throw error;
        }
    }

    // ========================================================================
    // Task Operations
    // ========================================================================

    /**
     * Create a new agent task in the database
     *
     * @param state The initial task state
     * @throws Error if database insertion fails
     */
    async createTask(state: AgentTaskState): Promise<void> {
        this.logInfo(`Creating task ${state.taskId}`);

        try {
            const db = this.databaseService.getDatabase();
            await db.prepare(
                `INSERT INTO agent_tasks (
                    id, project_id, description, state, current_step, total_steps,
                    execution_plan, context, current_provider, recovery_attempts,
                    total_tokens_used, total_llm_calls, total_tool_calls,
                    created_at, updated_at, started_at, estimated_cost
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
                state.taskId,
                state.projectId,
                state.description,
                state.state,
                state.currentStep,
                state.totalSteps,
                JSON.stringify(state.plan),
                JSON.stringify(state.context),
                JSON.stringify(state.currentProvider),
                state.recoveryAttempts,
                state.metrics.tokensUsed,
                state.metrics.llmCalls,
                state.metrics.toolCalls,
                state.createdAt.toISOString(),
                state.updatedAt.toISOString(),
                state.startedAt?.toISOString() ?? null,
                state.metrics.estimatedCost ?? 0
            );

            this.logDebug(`Task ${state.taskId} created successfully`);
        } catch (error) {
            this.logError(`Failed to create task ${state.taskId}`, error as Error);
            throw new Error(`Task creation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Update existing task state (atomic transaction)
     *
     * @param taskId Unique identifier of the task
     * @param state Partial state updates to apply
     * @throws Error if database update fails
     */
    async updateTaskState(taskId: string, state: Partial<AgentTaskState>): Promise<void> {
        // AGENT-001-4: Use queue to prevent race conditions during concurrent updates
        const queuedUpdate = this.writeQueue
            .catch(() => undefined)
            .then(async () => {
                await this.executeTaskUpdate(taskId, state);
            });

        this.writeQueue = queuedUpdate.catch(() => undefined);
        return queuedUpdate;
    }

    private async executeTaskUpdate(taskId: string, state: Partial<AgentTaskState>): Promise<void> {
        this.logDebug(`Executing atomic update for task ${taskId}`);

        try {
            const updates: string[] = [];
            const values: unknown[] = [];

            this.collectBasicUpdates(state, updates, values);
            this.collectMetricUpdates(state, updates, values);

            if (updates.length === 0) {
                return; // Nothing to update
            }

            updates.push('updated_at = ?');
            values.push(new Date().toISOString());
            values.push(taskId);

            const db = this.databaseService.getDatabase();
            await db.prepare(
                `UPDATE agent_tasks SET ${updates.join(', ')} WHERE id = ?`
            ).run(...(values as (string | number | boolean | null)[]));
        } catch (error) {
            this.logError(`Failed to update task ${taskId}`, error as Error);
            throw error;
        }
    }

    /**
     * Collect basic state updates for SQL query
     */
    private collectBasicUpdates(state: Partial<AgentTaskState>, updates: string[], values: unknown[]): void {
        const directFields: Record<string, keyof AgentTaskState> = {
            'state = ?': 'state',
            'current_step = ?': 'currentStep',
            'recovery_attempts = ?': 'recoveryAttempts'
        };

        const jsonFields: Record<string, keyof AgentTaskState> = {
            'execution_plan = ?': 'plan',
            'current_provider = ?': 'currentProvider',
            'context = ?': 'context',
            'result = ?': 'result'
        };

        // Handle direct fields
        Object.entries(directFields).forEach(([sql, key]) => {
            if (state[key] !== undefined) {
                updates.push(sql);
                values.push(state[key]);
            }
        });

        // Handle JSON fields
        Object.entries(jsonFields).forEach(([sql, key]) => {
            if (state[key] !== undefined) {
                updates.push(sql);
                values.push(JSON.stringify(state[key]));
            }
        });

        if (state.completedAt !== undefined && state.completedAt !== null) {
            updates.push('completed_at = ?');
            values.push(state.completedAt.toISOString());
        }
    }

    /**
     * Collect metric-related updates for SQL query
     */
    private collectMetricUpdates(state: Partial<AgentTaskState>, updates: string[], values: unknown[]): void {
        if (state.metrics !== undefined) {
            updates.push('total_tokens_used = ?');
            values.push(state.metrics.tokensUsed);
            updates.push('total_llm_calls = ?');
            values.push(state.metrics.llmCalls);
            updates.push('total_tool_calls = ?');
            values.push(state.metrics.toolCalls);

            if (state.metrics.estimatedCost !== undefined) {
                updates.push('estimated_cost = ?');
                values.push(state.metrics.estimatedCost);
            }
        }
    }

    /**
     * Load task state from database
     *
     * @param taskId Unique identifier of the task
     * @returns Deserialized task state or null if not found
     */
    async loadTask(taskId: string): Promise<AgentTaskState | null> {
        this.logDebug(`Loading task ${taskId}`);

        try {
            const db = this.databaseService.getDatabase();
            const row = await db.prepare(
                `SELECT * FROM agent_tasks WHERE id = ?`
            ).get(taskId) as TaskRow | undefined;

            if (!row) {
                return null;
            }

            // Load messages and event history for this task
            const [messages, eventHistory] = await Promise.all([
                this.loadMessages(taskId),
                this.loadEventHistory(taskId)
            ]);

            const task = this.deserializeTask(row, messages);
            task.eventHistory = eventHistory;
            return task;
        } catch (error) {
            this.logError(`Failed to load task ${taskId}`, error as Error);
            throw error;
        }
    }

    /**
     * Get all tasks for a project (lightweight - no message loading)
     * For full task details including messages, use loadTask()
     *
     * @param projectId ID of the project
     * @param limit Maximum number of tasks to return (capped at 100)
     */
    async getTasksByProject(projectId: string, limit: number = 50): Promise<AgentTaskState[]> {
        try {
            const db = this.databaseService.getDatabase();
            const rows = await db.prepare(
                `SELECT * FROM agent_tasks WHERE project_id = ? ORDER BY created_at DESC LIMIT ?`
            ).all(projectId, Math.min(limit, 100)) as TaskRow[];

            // Don't load messages for history list - it's too slow
            // Messages will be loaded on-demand when task is selected
            return rows.map(row => this.deserializeTask(row, []));
        } catch (error) {
            this.logError(`Failed to get tasks for project ${projectId}`, error as Error);
            throw error;
        }
    }

    /**
     * Delete task and all related data (cascading)
     *
     * @param taskId Unique identifier of the task
     */
    async deleteTask(taskId: string): Promise<void> {
        this.logInfo(`Deleting task ${taskId}`);

        try {
            const db = this.databaseService.getDatabase();

            // Delete in order due to foreign key constraints
            await db.prepare(`DELETE FROM agent_tool_executions WHERE task_id = ?`).run(taskId);
            await db.prepare(`DELETE FROM agent_messages WHERE task_id = ?`).run(taskId);
            await db.prepare(`DELETE FROM agent_tasks WHERE id = ?`).run(taskId);

            this.logDebug(`Task ${taskId} deleted successfully`);
        } catch (error) {
            this.logError(`Failed to delete task ${taskId}`, error as Error);
            throw error;
        }
    }

    // ========================================================================
    // Message History Operations
    // ========================================================================

    /**
     * Append message to task history
     * NASA Rule #6: Minimal variable scope
     */
    async appendMessage(taskId: string, message: Message, sequenceNumber: number): Promise<void> {
        try {
            const messageId = randomUUID();
            const db = this.databaseService.getDatabase();

            // Handle content which can be string or array
            const contentStr = typeof message.content === 'string'
                ? message.content
                : JSON.stringify(message.content);

            await db.prepare(
                `INSERT INTO agent_messages (id, task_id, role, content, tool_calls, images, sequence_number, timestamp)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
                messageId,
                taskId,
                message.role,
                contentStr,
                message.toolCalls ? JSON.stringify(message.toolCalls) : null,
                message.images ? JSON.stringify(message.images) : null,
                sequenceNumber,
                new Date().toISOString()
            );
        } catch (error) {
            this.logError(`Failed to append message to task ${taskId}`, error as Error);
            throw error;
        }
    }

    /**
     * Load all messages for a task in sequence order
     * NASA Rule #2: Fixed limit for safety
     */
    async loadMessages(taskId: string, limit: number = 100): Promise<Message[]> {
        try {
            const db = this.databaseService.getDatabase();
            const rows = await db.prepare(
                `SELECT * FROM agent_messages WHERE task_id = ? ORDER BY sequence_number ASC LIMIT ?`
            ).all(taskId, Math.min(limit, 500)) as MessageRow[];

            return rows.map(row => this.deserializeMessage(row));
        } catch (error) {
            this.logError(`Failed to load messages for task ${taskId}`, error as Error);
            throw error;
        }
    }

    // ========================================================================
    // Tool Execution Telemetry
    // ========================================================================

    /**
     * Record tool execution start
     */
    async recordToolStart(taskId: string, toolCall: ToolCallExecution): Promise<void> {
        try {
            const db = this.databaseService.getDatabase();

            await db.prepare(
                `INSERT INTO agent_tool_executions (id, task_id, tool_name, arguments, status, started_at)
                 VALUES (?, ?, ?, ?, 'running', ?)`
            ).run(
                toolCall.id,
                taskId,
                toolCall.name,
                JSON.stringify(toolCall.arguments),
                new Date().toISOString()
            );
        } catch (error) {
            this.logError(`Failed to record tool start for ${toolCall.name}`, error as Error);
            // Don't throw - telemetry failures shouldn't break execution
        }
    }

    /**
     * Record tool execution completion
     */
    async recordToolComplete(
        taskId: string,
        toolCallId: string,
        success: boolean,
        result: unknown,
        duration: number
    ): Promise<void> {
        try {
            const db = this.databaseService.getDatabase();
            const status = success ? 'success' : 'error';

            await db.prepare(
                `UPDATE agent_tool_executions
                 SET status = ?, result = ?, completed_at = ?, duration_ms = ?
                 WHERE id = ? AND task_id = ?`
            ).run(
                status,
                JSON.stringify(result),
                new Date().toISOString(),
                duration,
                toolCallId,
                taskId
            );
        } catch (error) {
            this.logError(`Failed to record tool completion for ${toolCallId}`, error as Error);
            // Don't throw
        }
    }

    /**
     * Get recent tool executions for real-time UI
     * NASA Rule #2: Fixed limit for query results
     */
    async getRecentToolExecutions(taskId: string, limit: number = 50): Promise<ToolCallExecution[]> {
        try {
            const db = this.databaseService.getDatabase();
            const rows = await db.prepare(
                `SELECT * FROM agent_tool_executions
                 WHERE task_id = ?
                 ORDER BY started_at DESC
                 LIMIT ?`
            ).all(taskId, Math.min(limit, 100)) as ToolExecutionRow[];

            return rows.map(row => this.deserializeToolExecution(row));
        } catch (error) {
            this.logError(`Failed to get tool executions for task ${taskId}`, error as Error);
            return [];
        }
    }

    // ========================================================================
    // Event History Persistence
    // ========================================================================

    /**
     * Save event to history
     */
    async saveEvent(taskId: string, event: AgentEventRecord): Promise<void> {
        try {
            const db = this.databaseService.getDatabase();
            await db.prepare(
                `INSERT INTO agent_events (id, task_id, event_type, payload, state_before, state_after, timestamp)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).run(
                event.id,
                taskId,
                event.type,
                JSON.stringify(event.payload ?? null),
                event.stateBeforeTransition,
                event.stateAfterTransition,
                event.timestamp.toISOString()
            );
        } catch (error) {
            this.logError(`Failed to save event for task ${taskId}`, error as Error);
            // Don't throw - event persistence failures shouldn't break execution
        }
    }

    /**
     * Load event history for a task
     */
    async loadEventHistory(taskId: string, limit: number = 1000): Promise<AgentEventRecord[]> {
        try {
            const db = this.databaseService.getDatabase();
            const rows = await db.prepare(
                `SELECT * FROM agent_events WHERE task_id = ? ORDER BY timestamp ASC LIMIT ?`
            ).all(taskId, Math.min(limit, 2000)) as Array<{
                id: string;
                task_id: string;
                event_type: string;
                payload: string;
                state_before: string;
                state_after: string;
                timestamp: string;
            }>;

            return rows.map(row => ({
                id: row.id,
                timestamp: new Date(row.timestamp),
                type: row.event_type as AgentEventRecord['type'],
                payload: row.payload ? JSON.parse(row.payload) : undefined,
                stateBeforeTransition: row.state_before as AgentState,
                stateAfterTransition: row.state_after as AgentState
            }));
        } catch (error) {
            this.logError(`Failed to load event history for task ${taskId}`, error as Error);
            return [];
        }
    }

    // ========================================================================
    // Provider Tracking
    // ========================================================================

    /**
     * Record provider attempt
     */
    async recordProviderAttempt(taskId: string, attempt: ProviderAttempt): Promise<void> {
        try {
            const db = this.databaseService.getDatabase();

            // Get last attempt number for this task to increment it
            const lastAttempt = await db.prepare(
                'SELECT MAX(attempt_number) as max_attempt FROM agent_provider_history WHERE task_id = ?'
            ).get<{ max_attempt: number | null }>(taskId);

            const nextAttemptNumber = (lastAttempt?.max_attempt ?? 0) + 1;
            const id = randomUUID();

            await db.prepare(
                `INSERT INTO agent_provider_history (id, task_id, provider, model, attempt_number, status, error, timestamp)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
                id,
                taskId,
                attempt.provider,
                attempt.model,
                nextAttemptNumber,
                attempt.status,
                attempt.error ?? null,
                new Date().toISOString()
            );
        } catch (error) {
            this.logError(`Failed to record provider attempt`, error as Error);
        }
    }

    /**
     * Get provider rotation history for analytics
     */
    async getProviderHistory(taskId: string): Promise<ProviderAttempt[]> {
        try {
            const db = this.databaseService.getDatabase();
            const rows = await db.prepare(
                `SELECT * FROM agent_provider_history WHERE task_id = ? ORDER BY timestamp ASC`
            ).all(taskId) as ProviderHistoryRow[];

            return rows.map(row => ({
                provider: row.provider,
                model: row.model,
                accountIndex: 0, // Not explicitly stored in history yet, but required by interface
                startedAt: new Date(row.timestamp),
                status: row.status as ProviderAttempt['status'],
                error: row.error ?? undefined,
                requestCount: 1 // Default for individual attempts
            }));
        } catch (error) {
            this.logError(`Failed to get provider history for task ${taskId}`, error as Error);
            return [];
        }
    }

    // ========================================================================
    // Error Tracking
    // ========================================================================

    /**
     * Record agent error
     */
    async recordError(taskId: string, error: AgentError): Promise<void> {
        try {
            const db = this.databaseService.getDatabase();
            await db.prepare(
                `INSERT INTO agent_errors (id, task_id, error_type, message, state_when_occurred, timestamp)
                 VALUES (?, ?, ?, ?, ?, ?)`
            ).run(
                error.id,
                taskId,
                error.type,
                error.message,
                JSON.stringify(error.state),
                new Date().toISOString()
            );
        } catch (err) {
            this.logError(`Failed to record error`, err as Error);
        }
    }

    // ========================================================================
    // Checkpoint Operations
    // ========================================================================

    /**
     * Save a checkpoint of the agent state
     */
    async saveCheckpoint(taskId: string, stepIndex: number, state: AgentTaskState): Promise<void> {
        this.logDebug(`Saving checkpoint for task ${taskId} at step ${stepIndex}`);

        try {
            const id = randomUUID();
            const db = this.databaseService.getDatabase();

            await db.prepare(
                `INSERT INTO agent_checkpoints (id, task_id, step_index, state_snapshot, created_at)
                 VALUES (?, ?, ?, ?, ?)`
            ).run(
                id,
                taskId,
                stepIndex,
                JSON.stringify(state),
                new Date().toISOString()
            );
        } catch (error) {
            this.logError(`Failed to save checkpoint for task ${taskId}`, error as Error);
            throw error;
        }
    }

    /**
     * Get all checkpoints for a task
     */
    async getCheckpoints(taskId: string): Promise<Checkpoint[]> {
        try {
            const db = this.databaseService.getDatabase();
            const rows = await db.prepare(
                `SELECT * FROM agent_checkpoints WHERE task_id = ? ORDER BY step_index ASC`
            ).all(taskId) as CheckpointRow[];

            return rows.map(row => ({
                id: row.id,
                taskId: row.task_id,
                stepIndex: row.step_index,
                state: JSON.parse(row.state_snapshot),
                createdAt: new Date(row.created_at)
            }));
        } catch (error) {
            this.logError(`Failed to get checkpoints for task ${taskId}`, error as Error);
            throw error;
        }
    }

    /**
     * Load a specific checkpoint
     */
    async loadCheckpoint(checkpointId: string): Promise<AgentTaskState | null> {
        try {
            const db = this.databaseService.getDatabase();
            const row = await db.prepare(
                `SELECT * FROM agent_checkpoints WHERE id = ?`
            ).get(checkpointId) as CheckpointRow | undefined;

            if (!row) {
                return null;
            }

            const state = JSON.parse(row.state_snapshot) as AgentTaskState;
            // Ensure dates are parsed back to Date objects if needed (JSON.parse leaves them as strings)
            // The state will be used by the system which might expect Date objects.
            // A full deserialization helper might be needed if AgentTaskState has Date objects.
            // For now, we assume standard JSON parsing is sufficient or we need to map dates.
            return this.hydrateStateDates(state);
        } catch (error) {
            this.logError(`Failed to load checkpoint ${checkpointId}`, error as Error);
            throw error;
        }
    }

    /**
     * Get the latest checkpoint for a task
     */


    async getLatestCheckpoint(taskId: string): Promise<AgentTaskState | null> {
        try {
            const db = this.databaseService.getDatabase();
            const row = await db.prepare(
                `SELECT * FROM agent_checkpoints WHERE task_id = ? ORDER BY step_index DESC LIMIT 1`
            ).get(taskId) as CheckpointRow | undefined;

            if (!row) {
                return null;
            }

            return this.hydrateStateDates(JSON.parse(row.state_snapshot));
        } catch (error) {
            this.logError(`Failed to get latest checkpoint for task ${taskId}`, error as Error);
            throw error;
        }
    }

    /**
     * Helper to restore Date objects in state
     */
    private hydrateStateDates(state: AgentTaskState): AgentTaskState {
        return {
            ...state,
            createdAt: new Date(state.createdAt),
            updatedAt: new Date(state.updatedAt),
            startedAt: state.startedAt ? new Date(state.startedAt) : null,
            completedAt: state.completedAt ? new Date(state.completedAt) : null,
            eventHistory: state.eventHistory.map(e => ({
                ...e,
                timestamp: new Date(e.timestamp)
            })),
            errors: state.errors.map(e => ({
                ...e,
                timestamp: new Date(e.timestamp)
            })),
            providerHistory: state.providerHistory.map(p => ({
                ...p,
                startedAt: new Date(p.startedAt),
                endedAt: p.endedAt ? new Date(p.endedAt) : undefined
            }))
        };
    }

    // ========================================================================
    // Stale Task Detection
    // ========================================================================

    /**
     * Scans for tasks that appear stale (no checkpoint update within timeout).
     * Called on app startup to detect tasks that were interrupted.
     * @param timeoutMs Maximum age in ms before a running task is considered stale (default: 5 min)
     * @returns Array of stale task IDs
     */
    async scanStaleTasks(timeoutMs: number = 300_000): Promise<string[]> {
        this.logInfo('Scanning for stale tasks...');

        try {
            const db = this.databaseService.getDatabase();
            const activeStates = ['executing', 'waiting_llm', 'waiting_tool', 'recovering', 'rotating_provider', 'fallback'];
            const placeholders = activeStates.map(() => '?').join(', ');
            const cutoff = new Date(Date.now() - timeoutMs).toISOString();

            const rows = await db.prepare(
                `SELECT t.id, t.state, t.updated_at,
                        (SELECT MAX(c.created_at) FROM agent_checkpoints c WHERE c.task_id = t.id) as last_checkpoint_at
                 FROM agent_tasks t
                 WHERE t.state IN (${placeholders})
                 ORDER BY t.updated_at ASC`
            ).all(...activeStates) as Array<{
                id: string;
                state: string;
                updated_at: string;
                last_checkpoint_at: string | null;
            }>;

            const staleIds: string[] = [];

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const latestActivity = row.last_checkpoint_at ?? row.updated_at;

                if (latestActivity < cutoff) {
                    staleIds.push(row.id);
                    this.logWarn(`Stale task detected: ${row.id} (state=${row.state}, lastActivity=${latestActivity})`);
                }
            }

            this.logInfo(`Stale task scan complete: ${staleIds.length} stale out of ${rows.length} active`);
            return staleIds;
        } catch (error) {
            this.logError('Failed to scan for stale tasks', error as Error);
            return [];
        }
    }

    // ========================================================================
    // Private Helpers
    // ========================================================================

    /**
     * Run database schema migrations
     */
    async runMigrations(): Promise<void> {
        this.logInfo('Running agent schema migrations...');

        const db = this.databaseService.getDatabase();

        // Check if tables exist
        const tableExists = await db.prepare(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='agent_tasks'`
        ).all();

        if (tableExists.length > 0) {
            this.logInfo('Agent tables already exist, skipping migration');
            return;
        }

        // Create tables
        await db.exec(`
            CREATE TABLE IF NOT EXISTS agent_tasks (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                description TEXT NOT NULL,
                current_step INTEGER DEFAULT 0,
                total_steps INTEGER DEFAULT 0,
                execution_plan TEXT,
                context TEXT,
                current_provider TEXT,
                recovery_attempts INTEGER DEFAULT 0,
                total_tokens_used INTEGER DEFAULT 0,
                total_llm_calls INTEGER DEFAULT 0,
                total_tool_calls INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                started_at TEXT,
                completed_at TEXT,
                result TEXT,
                estimated_cost REAL DEFAULT 0
            )
        `);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS agent_messages (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT,
                tool_calls TEXT,
                images TEXT,
                sequence_number INTEGER NOT NULL,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
            )
        `);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS agent_tool_executions (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                tool_name TEXT NOT NULL,
                arguments TEXT,
                status TEXT NOT NULL,
                result TEXT,
                error TEXT,
                started_at TEXT NOT NULL,
                completed_at TEXT,
                duration_ms INTEGER,
                FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
            )
        `);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS agent_events (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                payload TEXT,
                state_before TEXT NOT NULL,
                state_after TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
            )
        `);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS agent_provider_history (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                attempt_number INTEGER NOT NULL,
                status TEXT NOT NULL,
                error TEXT,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
            )
        `);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS agent_errors (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                error_type TEXT NOT NULL,
                message TEXT NOT NULL,
                state_when_occurred TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
            )
        `);

        // Checkpoint table
        await db.exec(`
            CREATE TABLE IF NOT EXISTS agent_checkpoints (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                step_index INTEGER NOT NULL,
                state_snapshot TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
            )
        `);

        // Create indexes
        await db.exec(
            `CREATE INDEX IF NOT EXISTS idx_agent_checkpoints_task ON agent_checkpoints(task_id, step_index)`
        );

        // Create indexes (existing ones)
        await db.exec(
            `CREATE INDEX IF NOT EXISTS idx_agent_messages_task ON agent_messages(task_id, sequence_number)`
        );

        await db.exec(
            `CREATE INDEX IF NOT EXISTS idx_agent_events_task ON agent_events(task_id, timestamp)`
        );
        await db.exec(
            `CREATE INDEX IF NOT EXISTS idx_agent_tasks_project ON agent_tasks(project_id)`
        );

        await db.exec(
            `CREATE INDEX IF NOT EXISTS idx_agent_tools_task ON agent_tool_executions(task_id)`
        );

        await this.tryAddColumn(db, 'agent_tasks', 'estimated_cost', 'ALTER TABLE agent_tasks ADD COLUMN estimated_cost REAL DEFAULT 0');
        await this.tryAddColumn(db, 'agent_messages', 'images', 'ALTER TABLE agent_messages ADD COLUMN images TEXT');

        this.logInfo('Agent schema migrations completed');
    }

    private async tryAddColumn(
        db: ReturnType<DatabaseService['getDatabase']>,
        tableName: string,
        columnName: string,
        sql: string
    ): Promise<void> {
        try {
            await db.exec(sql);
        } catch (error) {
            const message = getErrorMessage(error as Error);
            if (message.includes('duplicate column') || message.includes('already exists')) {
                this.logInfo(`Column ${tableName}.${columnName} already exists, skipping`);
                return;
            }
            this.logWarn(`Failed to add column ${tableName}.${columnName}: ${message} `);
        }
    }

    /**
     * Deserialize database row to AgentTaskState
     */
    private deserializeTask(row: TaskRow, messages: Message[]): AgentTaskState {
        const parseJson = <T>(str: string | null, fallback: T): T => {
            if (!str) {
                return fallback;
            }
            try {
                return JSON.parse(str) as T;
            } catch {
                return fallback;
            }
        };

        const plan = parseJson<ExecutionPlan | null>(row.execution_plan, null);
        const context = parseJson(row.context, {
            projectPath: '',
            projectName: '',
            workspace: { rootPath: '', hasGit: false, hasDependencies: false },
            constraints: { maxIterations: 100, maxDuration: 1800000, maxToolCalls: 500, allowedTools: [] }
        });
        const currentProvider = parseJson<ProviderConfig>(row.current_provider, {
            provider: 'openai',
            model: 'gpt-4',
            accountIndex: 0,
            status: 'active'
        });
        const result = parseJson(row.result, null);

        return {
            taskId: row.id,
            projectId: row.project_id,
            description: row.description,
            state: row.state as AgentState,
            currentStep: row.current_step,
            totalSteps: row.total_steps,
            plan,
            context,
            messageHistory: messages,
            eventHistory: [],
            currentProvider,
            providerHistory: [],
            errors: [],
            recoveryAttempts: row.recovery_attempts,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
            startedAt: row.started_at ? new Date(row.started_at) : null,
            completedAt: row.completed_at ? new Date(row.completed_at) : null,
            metrics: {
                duration: row.completed_at && row.started_at
                    ? new Date(row.completed_at).getTime() - new Date(row.started_at).getTime()
                    : 0,
                llmCalls: row.total_llm_calls,
                toolCalls: row.total_tool_calls,
                tokensUsed: row.total_tokens_used,
                estimatedCost: row.estimated_cost ?? 0,
                providersUsed: [], // Recalculated if needed
                errorCount: 0, // Recalculated if needed
                recoveryCount: row.recovery_attempts
            },
            result
        };
    }

    /**
     * Deserialize database row to Message
     */
    private deserializeMessage(row: MessageRow): Message {
        const message: Message = {
            id: row.id,
            role: row.role as Message['role'],
            content: row.content ?? '',
            timestamp: new Date(row.timestamp)
        };

        if (row.images) {
            try {
                message.images = JSON.parse(row.images);
            } catch {
                // Ignore parse errors
            }
        }

        if (row.tool_calls) {
            try {
                message.toolCalls = JSON.parse(row.tool_calls);
            } catch {
                // Ignore parse errors
            }
        }

        return message;
    }

    /**
     * Deserialize database row to ToolCallExecution
     */
    private deserializeToolExecution(row: ToolExecutionRow): ToolCallExecution {
        const parseJson = <T>(str: string | null, fallback: T): T => {
            if (!str) {
                return fallback;
            }
            try {
                return JSON.parse(str) as T;
            } catch {
                return fallback;
            }
        };

        return {
            id: row.id,
            name: row.tool_name,
            arguments: parseJson<Record<string, unknown>>(row.arguments, {}),
            status: row.status as ToolExecutionStatus,
            startedAt: row.started_at ? new Date(row.started_at) : undefined,
            completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
            duration: row.duration_ms ?? undefined
        };
    }
}

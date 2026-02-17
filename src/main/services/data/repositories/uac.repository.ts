import { DatabaseAdapter, SqlValue } from '@shared/types/database';
import { ProjectStep } from '@shared/types/project-agent';
import { v4 as uuidv4 } from 'uuid';

export interface UacTaskRecord {
    id: string;
    project_path: string;
    description: string;
    status: string;
    created_at: number;
    updated_at: number;
    metadata?: string;
    node_id?: string;
    parent_task_id?: string; // For plan lineage tracking
}

export interface UacStepRecord {
    id: string;
    task_id: string;
    index_num: number; // 'index' is a reserved keyword in some DBs
    text: string;
    status: string;
    created_at: number;
    updated_at: number;
}

export interface UacLogRecord {
    id: string;
    task_id: string;
    step_id?: string;
    role: string;
    content: string;
    tool_call_id?: string;
    created_at: number;
}

export interface UacCanvasNodeRecord {
    id: string;
    type: string;
    position_x: number;
    position_y: number;
    data: string; // JSON stringified TaskNodeData
    created_at: number;
    updated_at: number;
}

export interface UacCanvasEdgeRecord {
    id: string;
    source: string;
    target: string;
    source_handle?: string;
    target_handle?: string;
    created_at: number;
}

export interface UacCheckpointRecord {
    id: string;
    task_id: string;
    step_index: number;
    trigger: string;
    snapshot: string;
    created_at: number;
}

export interface UacPlanVersionRecord {
    id: string;
    task_id: string;
    version_number: number;
    reason: string;
    plan_snapshot: string;
    created_at: number;
}

/** AGT-PLN-03: Plan pattern record for learning from past plans */
export interface UacPlanPatternRecord {
    id: string;
    task_keywords: string;
    step_pattern: string;
    outcome: 'success' | 'failure' | 'partial';
    success_count: number;
    failure_count: number;
    last_used_at: number;
    created_at: number;
}

export interface CreateUacTaskInput {
    projectId: string;
    description: string;
    status?: string;
    nodeId?: string;
    metadata?: Record<string, unknown>;
    parentTaskId?: string;
}

export class UacRepository {
    constructor(private db: DatabaseAdapter) { }

    async ensureTables(): Promise<void> {
        // Enable foreign key constraints for CASCADE deletes
        await this.db.exec(`PRAGMA foreign_keys = ON;`);

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS uac_tasks (
                id TEXT PRIMARY KEY,
                project_path TEXT NOT NULL,
                description TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                metadata TEXT,
                node_id TEXT
            );
        `);

        // Migration: Add node_id column if it doesn't exist (for existing databases)
        try {
            await this.db.exec(`ALTER TABLE uac_tasks ADD COLUMN node_id TEXT;`);
        } catch {
            // Column already exists, ignore error
        }

        // Migration: Add parent_task_id to track plan lineage
        try {
            await this.db.exec(`ALTER TABLE uac_tasks ADD COLUMN parent_task_id TEXT;`);
        } catch {
            // Column already exists, ignore error
        }

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS uac_steps (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                index_num INTEGER NOT NULL,
                text TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                FOREIGN KEY(task_id) REFERENCES uac_tasks(id) ON DELETE CASCADE
            );
        `);

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS uac_logs (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                step_id TEXT,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                tool_call_id TEXT,
                created_at BIGINT NOT NULL,
                FOREIGN KEY(task_id) REFERENCES uac_tasks(id) ON DELETE CASCADE
            );
        `);

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS uac_checkpoints (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                step_index INTEGER NOT NULL,
                trigger TEXT NOT NULL,
                snapshot TEXT NOT NULL,
                created_at BIGINT NOT NULL,
                FOREIGN KEY(task_id) REFERENCES uac_tasks(id) ON DELETE CASCADE
            );
        `);

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS uac_plan_versions (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                version_number INTEGER NOT NULL,
                reason TEXT NOT NULL,
                plan_snapshot TEXT NOT NULL,
                created_at BIGINT NOT NULL,
                FOREIGN KEY(task_id) REFERENCES uac_tasks(id) ON DELETE CASCADE
            );
        `);

        // Canvas persistence tables
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS uac_canvas_nodes (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL DEFAULT 'task',
                position_x REAL NOT NULL DEFAULT 0,
                position_y REAL NOT NULL DEFAULT 0,
                data TEXT NOT NULL,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            );
        `);

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS uac_canvas_edges (
                id TEXT PRIMARY KEY,
                source TEXT NOT NULL,
                target TEXT NOT NULL,
                source_handle TEXT,
                target_handle TEXT,
                created_at BIGINT NOT NULL,
                FOREIGN KEY(source) REFERENCES uac_canvas_nodes(id) ON DELETE CASCADE,
                FOREIGN KEY(target) REFERENCES uac_canvas_nodes(id) ON DELETE CASCADE
            );
        `);

        // AGT-PLN-03: Plan patterns table for learning from past plans
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS uac_plan_patterns (
                id TEXT PRIMARY KEY,
                task_keywords TEXT NOT NULL,
                step_pattern TEXT NOT NULL,
                outcome TEXT NOT NULL,
                success_count INTEGER NOT NULL DEFAULT 0,
                failure_count INTEGER NOT NULL DEFAULT 0,
                last_used_at BIGINT NOT NULL,
                created_at BIGINT NOT NULL
            );
        `);

        // AGENT-08: Performance metrics table for tracking agent performance
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS uac_performance_metrics (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                metrics_json TEXT NOT NULL,
                created_at BIGINT NOT NULL,
                FOREIGN KEY(task_id) REFERENCES uac_tasks(id) ON DELETE CASCADE
            );
        `);

        await this.db.exec(
            `CREATE INDEX IF NOT EXISTS idx_uac_plan_patterns_keywords ON uac_plan_patterns(task_keywords);`
        );

        await this.db.exec(
            `CREATE INDEX IF NOT EXISTS idx_uac_tasks_project_status ON uac_tasks(project_path, status, updated_at DESC);`
        );
        await this.db.exec(
            `CREATE INDEX IF NOT EXISTS idx_uac_tasks_node_id ON uac_tasks(node_id);`
        );
        await this.db.exec(
            `CREATE INDEX IF NOT EXISTS idx_uac_steps_task_index ON uac_steps(task_id, index_num);`
        );
        await this.db.exec(
            `CREATE INDEX IF NOT EXISTS idx_uac_logs_task_created ON uac_logs(task_id, created_at ASC);`
        );
        await this.db.exec(
            `CREATE INDEX IF NOT EXISTS idx_uac_checkpoints_task_created ON uac_checkpoints(task_id, created_at DESC);`
        );
        await this.db.exec(
            `CREATE INDEX IF NOT EXISTS idx_uac_checkpoints_task_step ON uac_checkpoints(task_id, step_index DESC);`
        );
        await this.db.exec(
            `CREATE INDEX IF NOT EXISTS idx_uac_plan_versions_task_version ON uac_plan_versions(task_id, version_number DESC);`
        );
        await this.db.exec(
            `CREATE INDEX IF NOT EXISTS idx_uac_canvas_nodes_updated ON uac_canvas_nodes(updated_at DESC);`
        );
        await this.db.exec(
            `CREATE INDEX IF NOT EXISTS idx_uac_canvas_edges_source_target ON uac_canvas_edges(source, target);`
        );
        await this.db.exec(
            `CREATE INDEX IF NOT EXISTS idx_uac_performance_metrics_task_created ON uac_performance_metrics(task_id, created_at DESC);`
        );
    }

    async createTask({
        projectId,
        description,
        status = 'idle',
        nodeId,
        metadata,
        parentTaskId,
    }: CreateUacTaskInput): Promise<string> {
        const id = uuidv4();
        const now = Date.now();
        const metadataJson = metadata ? JSON.stringify(metadata) : null;
        await this.db
            .prepare(
                `INSERT INTO uac_tasks (id, project_path, description, status, created_at, updated_at, node_id, metadata, parent_task_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .run(
                id,
                projectId,
                description,
                status,
                now,
                now,
                nodeId ?? null,
                metadataJson,
                parentTaskId ?? null
            );
        return id;
    }

    async updateTaskMetadata(id: string, metadata: Record<string, unknown>): Promise<void> {
        await this.db
            .prepare(`UPDATE uac_tasks SET metadata = ?, updated_at = ? WHERE id = ?`)
            .run(JSON.stringify(metadata), Date.now(), id);
    }

    async updateTaskStatus(id: string, status: string): Promise<void> {
        await this.db
            .prepare(`UPDATE uac_tasks SET status = ?, updated_at = ? WHERE id = ?`)
            .run(status, Date.now(), id);
    }

    async updateTaskNodeId(id: string, nodeId: string): Promise<void> {
        await this.db
            .prepare(`UPDATE uac_tasks SET node_id = ?, updated_at = ? WHERE id = ?`)
            .run(nodeId, Date.now(), id);
    }

    async getTask(id: string): Promise<UacTaskRecord | undefined> {
        return this.db.prepare(`SELECT * FROM uac_tasks WHERE id = ?`).get<UacTaskRecord>(id);
    }

    async getTaskByNodeId(nodeId: string): Promise<UacTaskRecord | undefined> {
        return this.db
            .prepare(`SELECT * FROM uac_tasks WHERE node_id = ? ORDER BY updated_at DESC LIMIT 1`)
            .get<UacTaskRecord>(nodeId);
    }

    async getActiveTask(projectPath: string): Promise<UacTaskRecord | undefined> {
        return this.db
            .prepare(
                `SELECT * FROM uac_tasks WHERE project_path = ? AND status IN ('running', 'planning', 'paused', 'waiting_for_approval') ORDER BY updated_at DESC LIMIT 1`
            )
            .get<UacTaskRecord>(projectPath);
    }

    async getTasks(projectPath: string, limit: number = 50): Promise<UacTaskRecord[]> {
        return this.db
            .prepare(
                `SELECT * FROM uac_tasks WHERE project_path = ? ORDER BY created_at DESC LIMIT ?`
            )
            .all<UacTaskRecord>(projectPath, limit);
    }

    /**
     * Get any active task across all projects for app restart resumption
     * Returns the most recently updated active task from any project
     */
    async getAnyActiveTask(): Promise<UacTaskRecord | undefined> {
        return this.db
            .prepare(
                `SELECT * FROM uac_tasks WHERE status IN ('running', 'planning', 'paused', 'waiting_for_approval') ORDER BY updated_at DESC LIMIT 1`
            )
            .get<UacTaskRecord>();
    }

    async deleteTask(taskId: string): Promise<void> {
        // Ensure foreign keys are enabled for CASCADE to work
        await this.db.exec(`PRAGMA foreign_keys = ON;`);

        // Log before delete for debugging
        const task = await this.db.prepare(`SELECT * FROM uac_tasks WHERE id = ?`).get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        // Delete task (CASCADE will delete related steps, logs, checkpoints)
        await this.db.prepare(`DELETE FROM uac_tasks WHERE id = ?`).run(taskId);

        // Verify deletion
        const verifyTask = await this.db
            .prepare(`SELECT * FROM uac_tasks WHERE id = ?`)
            .get(taskId);
        if (verifyTask) {
            throw new Error(`Task ${taskId} was not deleted`);
        }
    }

    /**
     * Creates multiple steps for a task using batch insert for better performance
     * @param taskId - Task ID to associate steps with
     * @param steps - Array of steps to create
     */
    async createSteps(taskId: string, steps: ProjectStep[]): Promise<void> {
        const now = Date.now();
        // PERF-003-3: Use batch insert with VALUES clause instead of loop
        if (steps.length === 0) {
            return;
        }

        const placeholders = steps.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
        const params: SqlValue[] = [];

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            params.push(step.id, taskId, i, step.text, step.status, now, now);
        }

        await this.db
            .prepare(
                `INSERT INTO uac_steps (id, task_id, index_num, text, status, created_at, updated_at) VALUES ${placeholders}`
            )
            .run(...params);
    }

    async updateStepStatus(id: string, status: string): Promise<void> {
        await this.db
            .prepare(`UPDATE uac_steps SET status = ?, updated_at = ? WHERE id = ?`)
            .run(status, Date.now(), id);
    }

    async getSteps(taskId: string): Promise<UacStepRecord[]> {
        return this.db
            .prepare(`SELECT * FROM uac_steps WHERE task_id = ? ORDER BY index_num ASC`)
            .all<UacStepRecord>(taskId);
    }

    async deleteStepsByTask(taskId: string): Promise<void> {
        await this.db.prepare(`DELETE FROM uac_steps WHERE task_id = ?`).run(taskId);
    }

    async addLog(
        taskId: string,
        role: string,
        content: string,
        stepId?: string,
        toolCallId?: string
    ): Promise<void> {
        const id = uuidv4();
        await this.db
            .prepare(
                `INSERT INTO uac_logs (id, task_id, step_id, role, content, tool_call_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
            )
            .run(id, taskId, stepId, role, content, toolCallId, Date.now());
    }

    async getLogs(taskId: string): Promise<UacLogRecord[]> {
        return this.db
            .prepare(`SELECT * FROM uac_logs WHERE task_id = ? ORDER BY created_at ASC`)
            .all<UacLogRecord>(taskId);
    }

    async createCheckpoint(
        taskId: string,
        stepIndex: number,
        trigger: string,
        snapshot: string
    ): Promise<string> {
        const id = uuidv4();
        const now = Date.now();
        await this.db
            .prepare(
                `INSERT INTO uac_checkpoints (id, task_id, step_index, trigger, snapshot, created_at) VALUES (?, ?, ?, ?, ?, ?)`
            )
            .run(id, taskId, stepIndex, trigger, snapshot, now);
        return id;
    }

    async getCheckpoints(taskId: string): Promise<UacCheckpointRecord[]> {
        return this.db
            .prepare(`SELECT * FROM uac_checkpoints WHERE task_id = ? ORDER BY created_at ASC`)
            .all<UacCheckpointRecord>(taskId);
    }

    async getCheckpoint(id: string): Promise<UacCheckpointRecord | undefined> {
        return this.db
            .prepare(`SELECT * FROM uac_checkpoints WHERE id = ?`)
            .get<UacCheckpointRecord>(id);
    }

    async getLatestCheckpoint(taskId: string): Promise<UacCheckpointRecord | undefined> {
        return this.db
            .prepare(
                `SELECT * FROM uac_checkpoints WHERE task_id = ? ORDER BY created_at DESC LIMIT 1`
            )
            .get<UacCheckpointRecord>(taskId);
    }

    async createPlanVersion(
        taskId: string,
        versionNumber: number,
        reason: string,
        planSnapshot: string
    ): Promise<string> {
        const id = uuidv4();
        const now = Date.now();
        await this.db
            .prepare(
                `INSERT INTO uac_plan_versions (id, task_id, version_number, reason, plan_snapshot, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
            )
            .run(id, taskId, versionNumber, reason, planSnapshot, now);
        return id;
    }

    async getPlanVersions(taskId: string): Promise<UacPlanVersionRecord[]> {
        return this.db
            .prepare(
                `SELECT * FROM uac_plan_versions WHERE task_id = ? ORDER BY version_number DESC`
            )
            .all<UacPlanVersionRecord>(taskId);
    }

    async getLatestPlanVersion(taskId: string): Promise<UacPlanVersionRecord | undefined> {
        return this.db
            .prepare(
                `SELECT * FROM uac_plan_versions WHERE task_id = ? ORDER BY version_number DESC LIMIT 1`
            )
            .get<UacPlanVersionRecord>(taskId);
    }

    // ==================== Canvas Node Operations ====================

    async saveCanvasNode(node: {
        id: string;
        type: string;
        position: { x: number; y: number };
        data: Record<string, unknown>;
    }): Promise<void> {
        const now = Date.now();
        await this.db
            .prepare(
                `
            INSERT INTO uac_canvas_nodes (id, type, position_x, position_y, data, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                type = EXCLUDED.type,
                position_x = EXCLUDED.position_x,
                position_y = EXCLUDED.position_y,
                data = EXCLUDED.data,
                updated_at = EXCLUDED.updated_at
        `
            )
            .run(
                node.id,
                node.type,
                node.position.x,
                node.position.y,
                JSON.stringify(node.data),
                now,
                now
            );
    }

    async saveCanvasNodes(
        nodes: Array<{
            id: string;
            type: string;
            position: { x: number; y: number };
            data: Record<string, unknown>;
        }>
    ): Promise<void> {
        if (nodes.length === 0) {
            return;
        }
        for (const node of nodes) {
            await this.saveCanvasNode({ ...node, data: node.data });
        }
    }

    async getCanvasNodes(): Promise<UacCanvasNodeRecord[]> {
        return this.db
            .prepare(`SELECT * FROM uac_canvas_nodes ORDER BY created_at ASC`)
            .all<UacCanvasNodeRecord>();
    }

    async getCanvasNodeById(id: string): Promise<UacCanvasNodeRecord | undefined> {
        return this.db
            .prepare(`SELECT * FROM uac_canvas_nodes WHERE id = ?`)
            .get<UacCanvasNodeRecord>(id);
    }

    async deleteCanvasNode(id: string): Promise<void> {
        await this.db.prepare(`DELETE FROM uac_canvas_nodes WHERE id = ?`).run(id);
    }

    async clearCanvasNodes(): Promise<void> {
        await this.db.prepare(`DELETE FROM uac_canvas_nodes`).run();
    }

    // ==================== Canvas Edge Operations ====================

    async saveCanvasEdge(edge: {
        id: string;
        source: string;
        target: string;
        sourceHandle?: string;
        targetHandle?: string;
    }): Promise<void> {
        const now = Date.now();
        await this.db
            .prepare(
                `
            INSERT INTO uac_canvas_edges (id, source, target, source_handle, target_handle, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                source = EXCLUDED.source,
                target = EXCLUDED.target,
                source_handle = EXCLUDED.source_handle,
                target_handle = EXCLUDED.target_handle
        `
            )
            .run(
                edge.id,
                edge.source,
                edge.target,
                edge.sourceHandle ?? null,
                edge.targetHandle ?? null,
                now
            );
    }

    async saveCanvasEdges(
        edges: Array<{
            id: string;
            source: string;
            target: string;
            sourceHandle?: string;
            targetHandle?: string;
        }>
    ): Promise<void> {
        if (edges.length === 0) {
            return;
        }
        for (const edge of edges) {
            await this.saveCanvasEdge(edge);
        }
    }

    async getCanvasEdges(): Promise<UacCanvasEdgeRecord[]> {
        return this.db
            .prepare(`SELECT * FROM uac_canvas_edges ORDER BY created_at ASC`)
            .all<UacCanvasEdgeRecord>();
    }

    async deleteCanvasEdge(id: string): Promise<void> {
        await this.db.prepare(`DELETE FROM uac_canvas_edges WHERE id = ?`).run(id);
    }

    async clearCanvasEdges(): Promise<void> {
        await this.db.prepare(`DELETE FROM uac_canvas_edges`).run();
    }

    // --- AGT-PLN-03: Plan Pattern Learning Methods ---

    /**
     * Store a plan pattern for future learning
     */
    async savePlanPattern(
        taskKeywords: string,
        stepPattern: string,
        outcome: 'success' | 'failure' | 'partial'
    ): Promise<string> {
        const now = Date.now();

        // Check if a similar pattern exists
        const existing = await this.db
            .prepare(`SELECT * FROM uac_plan_patterns WHERE task_keywords = ? AND step_pattern = ?`)
            .get<UacPlanPatternRecord>(taskKeywords, stepPattern);

        if (existing) {
            // Update existing pattern
            const successCount = outcome === 'success' ? existing.success_count + 1 : existing.success_count;
            const failureCount = outcome === 'failure' ? existing.failure_count + 1 : existing.failure_count;

            await this.db
                .prepare(`UPDATE uac_plan_patterns SET success_count = ?, failure_count = ?, outcome = ?, last_used_at = ? WHERE id = ?`)
                .run(successCount, failureCount, outcome, now, existing.id);

            return existing.id;
        }

        // Create new pattern
        const id = uuidv4();
        await this.db
            .prepare(`INSERT INTO uac_plan_patterns (id, task_keywords, step_pattern, outcome, success_count, failure_count, last_used_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(
                id,
                taskKeywords,
                stepPattern,
                outcome,
                outcome === 'success' ? 1 : 0,
                outcome === 'failure' ? 1 : 0,
                now,
                now
            );

        return id;
    }

    /**
     * Find similar plan patterns based on task keywords
     */
    async findSimilarPatterns(taskKeywords: string, limit: number = 5): Promise<UacPlanPatternRecord[]> {
        // Simple keyword matching - in production, could use FTS or vector similarity
        const keywords = taskKeywords.toLowerCase().split(/\s+/).filter(k => k.length > 3);

        if (keywords.length === 0) {
            return [];
        }

        // Build LIKE conditions for each keyword
        const conditions = keywords.map(() => `LOWER(task_keywords) LIKE ?`).join(' OR ');
        const params = keywords.map(k => `%${k}%`);

        const patterns = await this.db
            .prepare(`
                SELECT * FROM uac_plan_patterns
                WHERE ${conditions}
                ORDER BY (success_count - failure_count) DESC, last_used_at DESC
                LIMIT ?
            `)
            .all<UacPlanPatternRecord>(...params, limit);

        return patterns;
    }

    /**
     * Get successful patterns for learning
     */
    async getSuccessfulPatterns(limit: number = 10): Promise<UacPlanPatternRecord[]> {
        return this.db
            .prepare(`
                SELECT * FROM uac_plan_patterns
                WHERE success_count > failure_count
                ORDER BY success_count DESC, last_used_at DESC
                LIMIT ?
            `)
            .all<UacPlanPatternRecord>(limit);
    }

    /**
     * Get patterns to avoid (high failure rate)
     */
    async getFailedPatterns(limit: number = 10): Promise<UacPlanPatternRecord[]> {
        return this.db
            .prepare(`
                SELECT * FROM uac_plan_patterns
                WHERE failure_count > success_count
                ORDER BY failure_count DESC, last_used_at DESC
                LIMIT ?
            `)
            .all<UacPlanPatternRecord>(limit);
    }
}

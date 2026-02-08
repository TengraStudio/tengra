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

export class UacRepository {
    constructor(private db: DatabaseAdapter) { }

    async ensureTables(): Promise<void> {
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
    }

    async createTask(projectId: string, description: string, status: string = 'idle', nodeId?: string, metadata?: Record<string, unknown>): Promise<string> {
        const id = uuidv4();
        const now = Date.now();
        const metadataJson = metadata ? JSON.stringify(metadata) : null;
        await this.db.prepare(
            `INSERT INTO uac_tasks (id, project_path, description, status, created_at, updated_at, node_id, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(id, projectId, description, status, now, now, nodeId ?? null, metadataJson);
        return id;
    }

    async updateTaskMetadata(id: string, metadata: Record<string, unknown>): Promise<void> {
        await this.db.prepare(
            `UPDATE uac_tasks SET metadata = ?, updated_at = ? WHERE id = ?`
        ).run(JSON.stringify(metadata), Date.now(), id);
    }

    async updateTaskStatus(id: string, status: string): Promise<void> {
        await this.db.prepare(
            `UPDATE uac_tasks SET status = ?, updated_at = ? WHERE id = ?`
        ).run(status, Date.now(), id);
    }

    async updateTaskNodeId(id: string, nodeId: string): Promise<void> {
        await this.db.prepare(
            `UPDATE uac_tasks SET node_id = ?, updated_at = ? WHERE id = ?`
        ).run(nodeId, Date.now(), id);
    }

    async getTask(id: string): Promise<UacTaskRecord | undefined> {
        return this.db.prepare(`SELECT * FROM uac_tasks WHERE id = ?`).get<UacTaskRecord>(id);
    }

    async getActiveTask(projectPath: string): Promise<UacTaskRecord | undefined> {
        return this.db.prepare(
            `SELECT * FROM uac_tasks WHERE project_path = ? AND status IN ('running', 'planning', 'paused', 'waiting_for_approval') ORDER BY updated_at DESC LIMIT 1`
        ).get<UacTaskRecord>(projectPath);
    }

    async getTasks(projectPath: string, limit: number = 50): Promise<UacTaskRecord[]> {
        return this.db.prepare(
            `SELECT * FROM uac_tasks WHERE project_path = ? ORDER BY created_at DESC LIMIT ?`
        ).all<UacTaskRecord>(projectPath, limit);
    }

    /**
     * Get any active task across all projects for app restart resumption
     * Returns the most recently updated active task from any project
     */
    async getAnyActiveTask(): Promise<UacTaskRecord | undefined> {
        return this.db.prepare(
            `SELECT * FROM uac_tasks WHERE status IN ('running', 'planning', 'paused', 'waiting_for_approval') ORDER BY updated_at DESC LIMIT 1`
        ).get<UacTaskRecord>();
    }

    /**
     * Creates multiple steps for a task using batch insert for better performance
     * @param taskId - Task ID to associate steps with
     * @param steps - Array of steps to create
     */
    async createSteps(taskId: string, steps: ProjectStep[]): Promise<void> {
        const now = Date.now();
        // PERF-003-3: Use batch insert with VALUES clause instead of loop
        if (steps.length === 0) { return; }

        const placeholders = steps.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
        const params: SqlValue[] = [];

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            params.push(step.id, taskId, i, step.text, step.status, now, now);
        }

        await this.db.prepare(
            `INSERT INTO uac_steps (id, task_id, index_num, text, status, created_at, updated_at) VALUES ${placeholders}`
        ).run(...params);
    }

    async updateStepStatus(id: string, status: string): Promise<void> {
        await this.db.prepare(
            `UPDATE uac_steps SET status = ?, updated_at = ? WHERE id = ?`
        ).run(status, Date.now(), id);
    }

    async getSteps(taskId: string): Promise<UacStepRecord[]> {
        return this.db.prepare(`SELECT * FROM uac_steps WHERE task_id = ? ORDER BY index_num ASC`).all<UacStepRecord>(taskId);
    }

    async deleteStepsByTask(taskId: string): Promise<void> {
        await this.db.prepare(`DELETE FROM uac_steps WHERE task_id = ?`).run(taskId);
    }

    async addLog(taskId: string, role: string, content: string, stepId?: string, toolCallId?: string): Promise<void> {
        const id = uuidv4();
        await this.db.prepare(
            `INSERT INTO uac_logs (id, task_id, step_id, role, content, tool_call_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(id, taskId, stepId, role, content, toolCallId, Date.now());
    }

    async getLogs(taskId: string): Promise<UacLogRecord[]> {
        return this.db.prepare(`SELECT * FROM uac_logs WHERE task_id = ? ORDER BY created_at ASC`).all<UacLogRecord>(taskId);
    }

    // ==================== Canvas Node Operations ====================

    async saveCanvasNode(node: { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }): Promise<void> {
        const now = Date.now();
        await this.db.prepare(`
            INSERT INTO uac_canvas_nodes (id, type, position_x, position_y, data, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                type = EXCLUDED.type,
                position_x = EXCLUDED.position_x,
                position_y = EXCLUDED.position_y,
                data = EXCLUDED.data,
                updated_at = EXCLUDED.updated_at
        `).run(node.id, node.type, node.position.x, node.position.y, JSON.stringify(node.data), now, now);
    }

    async saveCanvasNodes(nodes: Array<{ id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }>): Promise<void> {
        if (nodes.length === 0) { return; }
        for (const node of nodes) {
            await this.saveCanvasNode({ ...node, data: node.data });
        }
    }

    async getCanvasNodes(): Promise<UacCanvasNodeRecord[]> {
        return this.db.prepare(`SELECT * FROM uac_canvas_nodes ORDER BY created_at ASC`).all<UacCanvasNodeRecord>();
    }

    async deleteCanvasNode(id: string): Promise<void> {
        await this.db.prepare(`DELETE FROM uac_canvas_nodes WHERE id = ?`).run(id);
    }

    async clearCanvasNodes(): Promise<void> {
        await this.db.prepare(`DELETE FROM uac_canvas_nodes`).run();
    }

    // ==================== Canvas Edge Operations ====================

    async saveCanvasEdge(edge: { id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string }): Promise<void> {
        const now = Date.now();
        await this.db.prepare(`
            INSERT INTO uac_canvas_edges (id, source, target, source_handle, target_handle, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                source = EXCLUDED.source,
                target = EXCLUDED.target,
                source_handle = EXCLUDED.source_handle,
                target_handle = EXCLUDED.target_handle
        `).run(edge.id, edge.source, edge.target, edge.sourceHandle ?? null, edge.targetHandle ?? null, now);
    }

    async saveCanvasEdges(edges: Array<{ id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string }>): Promise<void> {
        if (edges.length === 0) { return; }
        for (const edge of edges) {
            await this.saveCanvasEdge(edge);
        }
    }

    async getCanvasEdges(): Promise<UacCanvasEdgeRecord[]> {
        return this.db.prepare(`SELECT * FROM uac_canvas_edges ORDER BY created_at ASC`).all<UacCanvasEdgeRecord>();
    }

    async deleteCanvasEdge(id: string): Promise<void> {
        await this.db.prepare(`DELETE FROM uac_canvas_edges WHERE id = ?`).run(id);
    }

    async clearCanvasEdges(): Promise<void> {
        await this.db.prepare(`DELETE FROM uac_canvas_edges`).run();
    }
}

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
                metadata TEXT
            );
        `);

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
    }

    async createTask(projectId: string, description: string, status: string = 'idle'): Promise<string> {
        const id = uuidv4();
        const now = Date.now();
        await this.db.prepare(
            `INSERT INTO uac_tasks (id, project_path, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).run(id, projectId, description, status, now, now);
        return id;
    }

    async updateTaskStatus(id: string, status: string): Promise<void> {
        await this.db.prepare(
            `UPDATE uac_tasks SET status = ?, updated_at = ? WHERE id = ?`
        ).run(status, Date.now(), id);
    }

    async getTask(id: string): Promise<UacTaskRecord | undefined> {
        return this.db.prepare(`SELECT * FROM uac_tasks WHERE id = ?`).get<UacTaskRecord>(id);
    }

    async getActiveTask(projectPath: string): Promise<UacTaskRecord | undefined> {
        return this.db.prepare(
            `SELECT * FROM uac_tasks WHERE project_path = ? AND status IN ('running', 'planning', 'paused', 'waiting_for_approval') ORDER BY updated_at DESC LIMIT 1`
        ).get<UacTaskRecord>(projectPath);
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

    async addLog(taskId: string, role: string, content: string, stepId?: string, toolCallId?: string): Promise<void> {
        const id = uuidv4();
        await this.db.prepare(
            `INSERT INTO uac_logs (id, task_id, step_id, role, content, tool_call_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(id, taskId, stepId, role, content, toolCallId, Date.now());
    }

    async getLogs(taskId: string): Promise<UacLogRecord[]> {
        return this.db.prepare(`SELECT * FROM uac_logs WHERE task_id = ? ORDER BY created_at ASC`).all<UacLogRecord>(taskId);
    }
}

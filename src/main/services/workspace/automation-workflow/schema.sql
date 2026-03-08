/**
 * Canonical database schema for agent persistence.
 * Runtime migrations preserve legacy persisted identifiers separately.
 */

CREATE TABLE IF NOT EXISTS agent_tasks (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    description TEXT NOT NULL,
    state TEXT NOT NULL,
    current_step INTEGER DEFAULT 0,
    total_steps INTEGER DEFAULT 0,
    execution_plan JSON,
    context JSON NOT NULL,
    current_provider JSON NOT NULL,
    recovery_attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    result JSON
);

CREATE TABLE IF NOT EXISTS agent_messages (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT,
    tool_calls JSON,
    sequence_number INTEGER NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_tool_executions (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    arguments JSON,
    status TEXT NOT NULL,
    result JSON,
    error TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER
);



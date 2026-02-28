# Database Schema Reference

> **Last Updated**: 2025-01-20
> **Database Engine**: SQLite (via standalone Rust db-service)
> **Source of Truth**: `src/native/db-service/src/database.rs` (core tables), TypeScript repositories (runtime tables)

## Overview

Tengra uses a standalone Rust-based database service that communicates over HTTP with the Electron main process. The schema is organized across two layers:

1. **Core tables** — Created by the Rust db-service via numbered migrations (`src/native/db-service/src/database.rs`)
2. **Runtime tables** — Created on-demand by TypeScript services (UAC agent orchestration, agent persistence, etc.)

Additionally, a `migration_history` table is managed by the TypeScript `DatabaseService` for application-level index migrations.

---

## Table of Contents

- [Chat Domain](#chat-domain)
- [Project Domain](#project-domain)
- [Knowledge & Memory Domain](#knowledge--memory-domain)
- [System & Operations Domain](#system--operations-domain)
- [Agent Domain](#agent-domain)
- [UAC (Unified Agent Controller) Domain](#uac-unified-agent-controller-domain)
- [Marketplace Domain](#marketplace-domain)
- [Migration Tracking](#migration-tracking)
- [Index Summary](#index-summary)
- [Relationships Diagram](#relationships-diagram)

---

## Chat Domain

### `chats`

Stores chat conversations. Each chat can belong to a folder and/or project.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Unique chat identifier (UUID) |
| `title` | TEXT | NOT NULL | Chat display title |
| `is_Generating` | INTEGER | DEFAULT 0 | Whether AI is currently generating a response |
| `model` | TEXT | | LLM model used for this chat |
| `backend` | TEXT | | LLM backend/provider identifier |
| `folder_id` | TEXT | | FK → `folders.id` (logical, no constraint) |
| `project_id` | TEXT | | FK → `projects.id` (logical, no constraint) |
| `is_pinned` | INTEGER | DEFAULT 0 | Whether chat is pinned to top |
| `is_favorite` | INTEGER | DEFAULT 0 | Whether chat is marked as favorite |
| `is_archived` | INTEGER | DEFAULT 0 | Whether chat is archived |
| `metadata` | TEXT | | JSON object with extra metadata |
| `created_at` | INTEGER | NOT NULL | Creation timestamp (epoch ms) |
| `updated_at` | INTEGER | NOT NULL | Last update timestamp (epoch ms) |

**Defined in**: Rust migration 1 (`initial_schema`)

---

### `messages`

Stores individual messages within chats.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Unique message identifier (UUID) |
| `chat_id` | TEXT | NOT NULL, FK → `chats.id` ON DELETE CASCADE | Parent chat |
| `role` | TEXT | NOT NULL | Message role (`user`, `assistant`, `system`) |
| `content` | TEXT | NOT NULL | Message content |
| `timestamp` | INTEGER | NOT NULL | Message timestamp (epoch ms) |
| `provider` | TEXT | | LLM provider that generated this message |
| `model` | TEXT | | LLM model that generated this message |
| `metadata` | TEXT | | JSON object (bookmarks, reactions, etc.) |
| `vector` | BLOB | | Message embedding for semantic search (added in migration 4) |

**Defined in**: Rust migration 1 (`initial_schema`), migration 4 (vector column)

---

### `folders`

Organizes chats into named folders.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Unique folder identifier (UUID) |
| `name` | TEXT | NOT NULL | Folder display name |
| `color` | TEXT | | Folder color code |
| `created_at` | INTEGER | NOT NULL | Creation timestamp (epoch ms) |
| `updated_at` | INTEGER | NOT NULL | Last update timestamp (epoch ms) |

**Defined in**: Rust migration 1 (`initial_schema`)

---

## Project Domain

### `projects`

Stores development project configurations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Unique project identifier (UUID) |
| `title` | TEXT | NOT NULL | Project display name |
| `description` | TEXT | | Project description |
| `path` | TEXT | NOT NULL | Filesystem path to project root |
| `logo` | TEXT | | Project logo/icon path |
| `mounts` | TEXT | DEFAULT '[]' | JSON array of mounted directories |
| `chat_ids` | TEXT | DEFAULT '[]' | JSON array of associated chat IDs |
| `council_config` | TEXT | | JSON config for AI council sessions |
| `status` | TEXT | DEFAULT 'active' | Project status (`active`, `archived`) |
| `metadata` | TEXT | | JSON object with extra metadata |
| `created_at` | INTEGER | NOT NULL | Creation timestamp (epoch ms) |
| `updated_at` | INTEGER | NOT NULL | Last update timestamp (epoch ms) |

**Defined in**: Rust migration 1 (`initial_schema`)

---

### `council_sessions`

Stores AI council deliberation sessions for a project.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Session identifier (UUID) |
| `goal` | TEXT | NOT NULL | Council session goal/objective |
| `status` | TEXT | NOT NULL | Session status |
| `logs` | TEXT | DEFAULT '[]' | JSON array of session log entries |
| `agents` | TEXT | DEFAULT '[]' | JSON array of participating agents |
| `plan` | TEXT | | JSON execution plan |
| `solution` | TEXT | | Final solution/output |
| `model` | TEXT | | LLM model used |
| `provider` | TEXT | | LLM provider used |
| `created_at` | INTEGER | NOT NULL | Creation timestamp (epoch ms) |
| `updated_at` | INTEGER | NOT NULL | Last update timestamp (epoch ms) |

**Defined in**: Rust migration 3 (`system_tables`)

---

## Knowledge & Memory Domain

### `code_symbols`

Stores indexed code symbols for code intelligence and semantic search.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Symbol identifier (UUID) |
| `project_path` | TEXT | NOT NULL | Project root path |
| `file_path` | TEXT | NOT NULL | Source file path |
| `name` | TEXT | NOT NULL | Symbol name (function, class, etc.) |
| `line` | INTEGER | NOT NULL | Line number in source file |
| `kind` | TEXT | NOT NULL | Symbol kind (`function`, `class`, `variable`, etc.) |
| `signature` | TEXT | | Full symbol signature |
| `docstring` | TEXT | | Documentation string |
| `embedding` | BLOB | | Vector embedding for semantic search |
| `created_at` | INTEGER | NOT NULL | Indexing timestamp (epoch ms) |

**Defined in**: Rust migration 2 (`knowledge_tables`)

---

### `semantic_fragments`

Stores semantic text fragments with embeddings for vector search.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Fragment identifier (UUID) |
| `content` | TEXT | NOT NULL | Text content |
| `embedding` | BLOB | NOT NULL | Vector embedding |
| `source` | TEXT | NOT NULL | Source type (e.g., `chat`, `code`, `doc`) |
| `source_id` | TEXT | NOT NULL | Source entity ID |
| `tags` | TEXT | DEFAULT '[]' | JSON array of tags |
| `importance` | REAL | DEFAULT 1.0 | Importance score |
| `project_path` | TEXT | | Associated project path (renamed from `project_id` in migration 5) |
| `created_at` | INTEGER | NOT NULL | Creation timestamp (epoch ms) |
| `updated_at` | INTEGER | NOT NULL | Last update timestamp (epoch ms) |

**Defined in**: Rust migration 2, migration 5 (column rename)

---

### `episodic_memories`

Stores episodic (conversation-derived) memories with temporal context.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Memory identifier (UUID) |
| `title` | TEXT | NOT NULL | Memory title/summary label |
| `summary` | TEXT | NOT NULL | Memory summary text |
| `content` | TEXT | | Full memory content |
| `embedding` | BLOB | | Vector embedding |
| `start_date` | INTEGER | NOT NULL | Episode start timestamp (epoch ms) |
| `end_date` | INTEGER | NOT NULL | Episode end timestamp (epoch ms) |
| `chat_id` | TEXT | | Originating chat ID |
| `participants` | TEXT | DEFAULT '[]' | JSON array of participants |
| `metadata` | TEXT | | JSON object with extra metadata |
| `created_at` | INTEGER | NOT NULL | Creation timestamp (epoch ms) |
| `timestamp` | INTEGER | NOT NULL | Primary sort timestamp (epoch ms) |

**Defined in**: Rust migration 2 (`knowledge_tables`)

---

### `entity_knowledge`

Stores structured knowledge about named entities (people, tools, concepts).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Knowledge entry ID (UUID) |
| `entity_type` | TEXT | NOT NULL | Entity type (e.g., `person`, `tool`, `concept`) |
| `entity_name` | TEXT | NOT NULL | Entity name |
| `key` | TEXT | NOT NULL | Knowledge key/attribute |
| `value` | TEXT | NOT NULL | Knowledge value |
| `confidence` | REAL | DEFAULT 1.0 | Confidence score (0.0–1.0) |
| `source` | TEXT | NOT NULL | Source of this knowledge |
| `updated_at` | INTEGER | NOT NULL | Last update timestamp (epoch ms) |

**Defined in**: Rust migration 2 (`knowledge_tables`)

---

### `advanced_memories`

Advanced memory system with lifecycle management, validation, and decay. Used by `KnowledgeRepository`.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Memory identifier (UUID) |
| `content` | TEXT | NOT NULL | Memory content |
| `embedding` | BLOB | | Vector embedding |
| `source` | TEXT | NOT NULL | Source type (`chat`, `code`, `user`, etc.) |
| `source_id` | TEXT | NOT NULL | Source entity ID |
| `source_context` | TEXT | | Additional source context |
| `category` | TEXT | NOT NULL | Memory category |
| `tags` | TEXT | | JSON array of tags |
| `confidence` | REAL | | Confidence score |
| `importance` | REAL | | Current importance (subject to decay) |
| `initial_importance` | REAL | | Original importance at creation |
| `status` | TEXT | | Status (`pending`, `confirmed`, `rejected`, `merged`) |
| `validated_at` | INTEGER | | Validation timestamp |
| `validated_by` | TEXT | | Validator (`user`, `auto`, `system`) |
| `access_count` | INTEGER | | Number of times accessed |
| `last_accessed_at` | INTEGER | | Last access timestamp |
| `related_memory_ids` | TEXT | | JSON array of related memory IDs |
| `contradicts_ids` | TEXT | | JSON array of contradicting memory IDs |
| `merged_into_id` | TEXT | | ID of memory this was merged into |
| `project_id` | TEXT | | Associated project ID |
| `context_tags` | TEXT | | JSON array of context tags |
| `created_at` | INTEGER | NOT NULL | Creation timestamp (epoch ms) |
| `updated_at` | INTEGER | NOT NULL | Last update timestamp (epoch ms) |
| `expires_at` | INTEGER | | Expiration timestamp |
| `metadata` | TEXT | | JSON metadata |

**Defined in**: Runtime — used by `KnowledgeRepository.storeAdvancedMemory()`

---

### `pending_memories`

Staging area for extracted memories awaiting confirmation or auto-approval.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Pending memory ID (UUID) |
| `content` | TEXT | NOT NULL | Memory content |
| `embedding` | BLOB | | Vector embedding |
| `source` | TEXT | NOT NULL | Extraction source type |
| `source_id` | TEXT | NOT NULL | Source entity ID |
| `source_context` | TEXT | | Context of extraction |
| `extracted_at` | INTEGER | NOT NULL | Extraction timestamp |
| `suggested_category` | TEXT | | AI-suggested category |
| `suggested_tags` | TEXT | | JSON array of suggested tags |
| `extraction_confidence` | REAL | | Confidence of extraction |
| `relevance_score` | REAL | | Relevance score |
| `novelty_score` | REAL | | Novelty score (vs existing memories) |
| `requires_user_validation` | INTEGER | | Whether user approval is needed |
| `auto_confirm_reason` | TEXT | | Reason for auto-confirmation |
| `potential_contradictions` | TEXT | | JSON array of contradiction candidates |
| `similar_memories` | TEXT | | JSON array of similar memory candidates |
| `project_id` | TEXT | | Associated project ID |

**Defined in**: Runtime — used by `KnowledgeRepository.savePendingMemory()`

---

### `file_diffs`

Stores file diff snapshots for change tracking and analysis.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Diff identifier (UUID) |
| `project_path` | TEXT | | Project path (renamed from `project_id` in migration 6) |
| `file_path` | TEXT | NOT NULL | File path |
| `diff` | TEXT | NOT NULL | Diff content (JSON) |
| `created_at` | INTEGER | NOT NULL | Creation timestamp (epoch ms) |
| `session_id` | TEXT | | Associated session ID |
| `system_id` | TEXT | | System identifier |

**Defined in**: Rust migration 4, migration 6 (column rename). Also ensured by `KnowledgeRepository.ensureFileDiffTable()`

---

## System & Operations Domain

### `token_usage`

Tracks LLM token consumption and cost estimates.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Auto-incrementing ID |
| `message_id` | TEXT | | Associated message ID |
| `chat_id` | TEXT | | Associated chat ID |
| `project_path` | TEXT | | Project path (renamed from `project_id` in migration 7) |
| `provider` | TEXT | NOT NULL | LLM provider name |
| `model` | TEXT | NOT NULL | LLM model name |
| `tokens_sent` | INTEGER | NOT NULL | Prompt tokens sent |
| `tokens_received` | INTEGER | NOT NULL | Completion tokens received |
| `cost_estimate` | REAL | | Estimated cost in USD |
| `timestamp` | INTEGER | NOT NULL | Usage timestamp (epoch ms) |

**Defined in**: Rust migration 3, migration 7 (column rename)

---

### `usage_tracking`

Lightweight request-level usage tracking for rate limiting.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Record identifier (UUID) |
| `timestamp` | INTEGER | NOT NULL | Request timestamp (epoch ms) |
| `provider` | TEXT | NOT NULL | LLM provider name |
| `model` | TEXT | NOT NULL | LLM model name |

**Defined in**: Rust migration 4 (`additional_tables`)

---

### `audit_logs`

Security and operations audit trail.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Log entry ID (UUID) |
| `timestamp` | INTEGER | NOT NULL | Event timestamp (epoch ms) |
| `action` | TEXT | NOT NULL | Action performed |
| `category` | TEXT | NOT NULL | Category (e.g., `auth`, `data`, `security`) |
| `user_id` | TEXT | | Acting user ID |
| `details` | TEXT | | JSON details object |
| `success` | INTEGER | DEFAULT 1 | Whether action succeeded |

**Defined in**: Rust migration 3 (`system_tables`)

---

### `linked_accounts`

OAuth/authentication linked account storage.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Account identifier (UUID) |
| `provider` | TEXT | NOT NULL | Auth provider (e.g., `github`, `google`) |
| `email` | TEXT | | Account email |
| `display_name` | TEXT | | Display name |
| `avatar_url` | TEXT | | Avatar URL |
| `access_token` | TEXT | | OAuth access token (encrypted) |
| `refresh_token` | TEXT | | OAuth refresh token (encrypted) |
| `session_token` | TEXT | | Session token |
| `expires_at` | INTEGER | | Token expiration timestamp |
| `scope` | TEXT | | OAuth scope |
| `is_active` | INTEGER | DEFAULT 1 | Whether account is active |
| `metadata` | TEXT | | JSON metadata |
| `created_at` | INTEGER | NOT NULL | Creation timestamp (epoch ms) |
| `updated_at` | INTEGER | NOT NULL | Last update timestamp (epoch ms) |

**Defined in**: Rust migration 3 (`system_tables`)

---

### `prompts`

User-saved prompt snippets.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Prompt identifier (UUID) |
| `title` | TEXT | NOT NULL | Prompt title |
| `content` | TEXT | NOT NULL | Prompt content |
| `tags` | TEXT | DEFAULT '[]' | JSON array of tags |
| `created_at` | INTEGER | NOT NULL | Creation timestamp (epoch ms) |
| `updated_at` | INTEGER | NOT NULL | Last update timestamp (epoch ms) |

**Defined in**: Rust migration 1 (`initial_schema`)

---

### `prompt_templates`

Reusable prompt templates with variable placeholders.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Template identifier (UUID) |
| `name` | TEXT | NOT NULL | Template name |
| `description` | TEXT | | Template description |
| `template` | TEXT | NOT NULL | Template content with `{{variable}}` placeholders |
| `variables` | TEXT | DEFAULT '[]' | JSON array of variable definitions |
| `category` | TEXT | | Template category |
| `tags` | TEXT | | JSON array of tags |
| `created_at` | INTEGER | NOT NULL | Creation timestamp (epoch ms) |
| `updated_at` | INTEGER | NOT NULL | Last update timestamp (epoch ms) |

**Defined in**: Rust migration 4 (`additional_tables`)

---

### `job_states`

Persistent state for background job scheduler.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Job identifier |
| `last_run` | INTEGER | | Last execution timestamp (epoch ms) |
| `state` | TEXT | | Serialized job state |

**Defined in**: Rust migration 3 (`system_tables`)

---

### `scheduler_state`

Alias table for job scheduling (TypeScript compatibility layer).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Scheduler job ID |
| `last_run` | INTEGER | | Last execution timestamp (epoch ms) |

**Defined in**: Rust migration 4 (`additional_tables`)

---

### `user_behavior`

Tracks user interaction patterns for personalization and UX optimization.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Record identifier (UUID) |
| `event_type` | TEXT | NOT NULL | Event category (e.g., `model_switch`, `feature_use`) |
| `event_key` | TEXT | NOT NULL | Specific event key |
| `count` | INTEGER | NOT NULL | Interaction count |
| `last_used_at` | INTEGER | NOT NULL | Last interaction timestamp (epoch ms) |
| `metadata` | TEXT | | JSON metadata |

**Constraints**: UNIQUE(`event_type`, `event_key`) — uses UPSERT pattern

**Defined in**: Runtime — used by `UserBehaviorRepository`

---

## Agent Domain

### `agents`

Registered AI agent definitions (created/managed by `AgentService`).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Agent identifier (UUID) |
| `name` | TEXT | NOT NULL | Agent name (unique) |
| `system_prompt` | TEXT | NOT NULL | Agent system prompt |
| `tools` | TEXT | NOT NULL | JSON array of tool names |
| `parent_model` | TEXT | NOT NULL | Base LLM model |
| `created_at` | INTEGER | NOT NULL | Creation timestamp (epoch ms) |
| `updated_at` | INTEGER | NOT NULL | Last update timestamp (epoch ms) |

**Defined in**: Runtime — used by `AgentService`

---

### `agent_archives`

Soft-deleted agent backups for recovery.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Archive identifier (UUID) |
| `original_id` | TEXT | NOT NULL | Original agent ID |
| `payload` | TEXT | NOT NULL | Full agent JSON payload |
| `deleted_at` | INTEGER | NOT NULL | Deletion timestamp (epoch ms) |

**Defined in**: `AgentService.ensureArchiveTable()`

---

### `agent_profiles`

Multi-agent council member profiles.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Profile identifier (UUID) |
| `name` | TEXT | NOT NULL | Agent display name |
| `role` | TEXT | NOT NULL | Agent role (e.g., `architect`, `reviewer`) |
| `persona` | TEXT | | Agent personality description |
| `system_prompt` | TEXT | | System prompt override |
| `skills` | TEXT | DEFAULT '[]' | JSON array of skill identifiers |
| `created_at` | INTEGER | NOT NULL | Creation timestamp (epoch ms) |
| `updated_at` | INTEGER | NOT NULL | Last update timestamp (epoch ms) |

**Defined in**: Rust migration 8 (`add_agent_templates_table`)

---

### `agent_templates`

Reusable agent task templates with parameterized workflows.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Template identifier (UUID) |
| `name` | TEXT | NOT NULL | Template name |
| `description` | TEXT | | Template description |
| `category` | TEXT | NOT NULL, DEFAULT 'custom' | Category (`custom`, `engineering`, `security`, etc.) |
| `system_prompt_override` | TEXT | | System prompt override |
| `task_template` | TEXT | NOT NULL | Task template content |
| `predefined_steps` | TEXT | | JSON array of predefined steps |
| `variables` | TEXT | DEFAULT '[]' | JSON array of template variables |
| `model_routing` | TEXT | | JSON model routing config |
| `tags` | TEXT | DEFAULT '[]' | JSON array of tags |
| `is_built_in` | INTEGER | NOT NULL, DEFAULT 0 | Whether this is a built-in template |
| `author_id` | TEXT | | Author identifier |
| `created_at` | INTEGER | NOT NULL | Creation timestamp (epoch ms) |
| `updated_at` | INTEGER | NOT NULL | Last update timestamp (epoch ms) |

**Defined in**: Rust migration 8 (`add_agent_templates_table`)

---

### `agent_tasks`

Tracks agent task execution state (project-scoped agent persistence).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Task identifier (UUID) |
| `project_id` | TEXT | NOT NULL | Associated project |
| `description` | TEXT | NOT NULL | Task description |
| `current_step` | INTEGER | DEFAULT 0 | Current execution step |
| `total_steps` | INTEGER | DEFAULT 0 | Total planned steps |
| `execution_plan` | TEXT | | JSON execution plan |
| `context` | TEXT | | JSON task context |
| `current_provider` | TEXT | | JSON current LLM provider config |
| `recovery_attempts` | INTEGER | DEFAULT 0 | Number of recovery attempts |
| `total_tokens_used` | INTEGER | DEFAULT 0 | Total tokens consumed |
| `total_llm_calls` | INTEGER | DEFAULT 0 | Total LLM API calls |
| `total_tool_calls` | INTEGER | DEFAULT 0 | Total tool invocations |
| `created_at` | TEXT | NOT NULL | Creation timestamp (ISO) |
| `updated_at` | TEXT | NOT NULL | Last update timestamp (ISO) |
| `started_at` | TEXT | | Execution start timestamp |
| `completed_at` | TEXT | | Completion timestamp |
| `result` | TEXT | | JSON task result |
| `estimated_cost` | REAL | DEFAULT 0 | Estimated cost in USD |

**Defined in**: `AgentPersistenceService` runtime migration

---

### `agent_messages`

Stores message history for agent task execution.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Message identifier (UUID) |
| `task_id` | TEXT | NOT NULL, FK → `agent_tasks.id` ON DELETE CASCADE | Parent task |
| `role` | TEXT | NOT NULL | Message role |
| `content` | TEXT | | Message content |
| `tool_calls` | TEXT | | JSON array of tool calls |
| `images` | TEXT | | JSON array of image references |
| `sequence_number` | INTEGER | NOT NULL | Message ordering number |
| `timestamp` | TEXT | NOT NULL | Message timestamp (ISO) |

**Defined in**: `AgentPersistenceService` runtime migration

---

### `agent_tool_executions`

Logs individual tool executions during agent tasks.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Execution identifier (UUID) |
| `task_id` | TEXT | NOT NULL, FK → `agent_tasks.id` ON DELETE CASCADE | Parent task |
| `tool_name` | TEXT | NOT NULL | Tool name |
| `arguments` | TEXT | | JSON tool arguments |
| `status` | TEXT | NOT NULL | Execution status |
| `result` | TEXT | | JSON result |
| `error` | TEXT | | Error message if failed |
| `started_at` | TEXT | NOT NULL | Start timestamp (ISO) |
| `completed_at` | TEXT | | Completion timestamp (ISO) |
| `duration_ms` | INTEGER | | Execution duration in milliseconds |

**Defined in**: `AgentPersistenceService` runtime migration

---

### `agent_events`

State machine event log for agent task lifecycle.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Event identifier (UUID) |
| `task_id` | TEXT | NOT NULL, FK → `agent_tasks.id` ON DELETE CASCADE | Parent task |
| `event_type` | TEXT | NOT NULL | Event type |
| `payload` | TEXT | | JSON event payload |
| `state_before` | TEXT | NOT NULL | State before transition |
| `state_after` | TEXT | NOT NULL | State after transition |
| `timestamp` | TEXT | NOT NULL | Event timestamp (ISO) |

**Defined in**: `AgentPersistenceService` runtime migration

---

### `agent_provider_history`

Tracks LLM provider/model switches during agent task execution.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Record identifier (UUID) |
| `task_id` | TEXT | NOT NULL, FK → `agent_tasks.id` ON DELETE CASCADE | Parent task |
| `provider` | TEXT | NOT NULL | Provider name |
| `model` | TEXT | NOT NULL | Model name |
| `attempt_number` | INTEGER | NOT NULL | Attempt sequence number |
| `status` | TEXT | NOT NULL | Attempt status |
| `error` | TEXT | | Error message if failed |
| `timestamp` | TEXT | NOT NULL | Attempt timestamp (ISO) |

**Defined in**: `AgentPersistenceService` runtime migration

---

### `agent_errors`

Error log for agent task failures.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Error identifier (UUID) |
| `task_id` | TEXT | NOT NULL, FK → `agent_tasks.id` ON DELETE CASCADE | Parent task |
| `error_type` | TEXT | NOT NULL | Error classification |
| `message` | TEXT | NOT NULL | Error message |
| `state_when_occurred` | TEXT | NOT NULL | Agent state at time of error |
| `timestamp` | TEXT | NOT NULL | Error timestamp (ISO) |

**Defined in**: `AgentPersistenceService` runtime migration

---

### `agent_checkpoints`

Snapshot checkpoints for agent task recovery.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Checkpoint identifier (UUID) |
| `task_id` | TEXT | NOT NULL, FK → `agent_tasks.id` ON DELETE CASCADE | Parent task |
| `step_index` | INTEGER | NOT NULL | Step index at checkpoint |
| `state_snapshot` | TEXT | NOT NULL | Full state JSON snapshot |
| `created_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | Checkpoint timestamp |

**Defined in**: `AgentPersistenceService` runtime migration

---

## UAC (Unified Agent Controller) Domain

All UAC tables are created by `UacRepository.ensureTables()` and use foreign key cascading for cleanup.

### `uac_tasks`

Top-level UAC task tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Task identifier (UUID) |
| `project_path` | TEXT | NOT NULL | Project filesystem path |
| `description` | TEXT | NOT NULL | Task description |
| `status` | TEXT | NOT NULL | Task status |
| `created_at` | BIGINT | NOT NULL | Creation timestamp (epoch ms) |
| `updated_at` | BIGINT | NOT NULL | Last update timestamp (epoch ms) |
| `metadata` | TEXT | | JSON metadata |
| `node_id` | TEXT | | Canvas node ID (added via migration) |
| `parent_task_id` | TEXT | | Parent task for plan lineage (added via migration) |

**Defined in**: `UacRepository.ensureTables()`

---

### `uac_steps`

Individual steps within a UAC task.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Step identifier (UUID) |
| `task_id` | TEXT | NOT NULL, FK → `uac_tasks.id` ON DELETE CASCADE | Parent task |
| `index_num` | INTEGER | NOT NULL | Step order index |
| `text` | TEXT | NOT NULL | Step description |
| `status` | TEXT | NOT NULL | Step status |
| `created_at` | BIGINT | NOT NULL | Creation timestamp (epoch ms) |
| `updated_at` | BIGINT | NOT NULL | Last update timestamp (epoch ms) |

**Defined in**: `UacRepository.ensureTables()`

---

### `uac_logs`

Conversation/action logs for UAC tasks.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Log entry ID (UUID) |
| `task_id` | TEXT | NOT NULL, FK → `uac_tasks.id` ON DELETE CASCADE | Parent task |
| `step_id` | TEXT | | Associated step ID |
| `role` | TEXT | NOT NULL | Log role (`user`, `assistant`, `tool`) |
| `content` | TEXT | NOT NULL | Log content |
| `tool_call_id` | TEXT | | Associated tool call ID |
| `created_at` | BIGINT | NOT NULL | Timestamp (epoch ms) |

**Defined in**: `UacRepository.ensureTables()`

---

### `uac_checkpoints`

State snapshots for UAC task recovery.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Checkpoint ID (UUID) |
| `task_id` | TEXT | NOT NULL, FK → `uac_tasks.id` ON DELETE CASCADE | Parent task |
| `step_index` | INTEGER | NOT NULL | Step index at snapshot |
| `trigger` | TEXT | NOT NULL | What triggered the checkpoint |
| `snapshot` | TEXT | NOT NULL | JSON state snapshot |
| `created_at` | BIGINT | NOT NULL | Timestamp (epoch ms) |

**Defined in**: `UacRepository.ensureTables()`

---

### `uac_plan_versions`

Version history of UAC task execution plans.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Version ID (UUID) |
| `task_id` | TEXT | NOT NULL, FK → `uac_tasks.id` ON DELETE CASCADE | Parent task |
| `version_number` | INTEGER | NOT NULL | Incrementing version |
| `reason` | TEXT | NOT NULL | Reason for plan change |
| `plan_snapshot` | TEXT | NOT NULL | JSON plan snapshot |
| `created_at` | BIGINT | NOT NULL | Timestamp (epoch ms) |

**Defined in**: `UacRepository.ensureTables()`

---

### `uac_canvas_nodes`

Visual canvas nodes for task orchestration UI.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Node ID (UUID) |
| `type` | TEXT | NOT NULL, DEFAULT 'task' | Node type |
| `position_x` | REAL | NOT NULL, DEFAULT 0 | X position |
| `position_y` | REAL | NOT NULL, DEFAULT 0 | Y position |
| `data` | TEXT | NOT NULL | JSON node data |
| `created_at` | BIGINT | NOT NULL | Creation timestamp (epoch ms) |
| `updated_at` | BIGINT | NOT NULL | Last update timestamp (epoch ms) |

**Defined in**: `UacRepository.ensureTables()`

---

### `uac_canvas_edges`

Connections between canvas nodes.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Edge ID (UUID) |
| `source` | TEXT | NOT NULL, FK → `uac_canvas_nodes.id` ON DELETE CASCADE | Source node |
| `target` | TEXT | NOT NULL, FK → `uac_canvas_nodes.id` ON DELETE CASCADE | Target node |
| `source_handle` | TEXT | | Source connection handle |
| `target_handle` | TEXT | | Target connection handle |
| `created_at` | BIGINT | NOT NULL | Creation timestamp (epoch ms) |

**Defined in**: `UacRepository.ensureTables()`

---

### `uac_plan_patterns`

Learned patterns from past plans for improved future planning.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Pattern ID (UUID) |
| `task_keywords` | TEXT | NOT NULL | Matched task keywords |
| `step_pattern` | TEXT | NOT NULL | Step execution pattern |
| `outcome` | TEXT | NOT NULL | Outcome description |
| `success_count` | INTEGER | NOT NULL, DEFAULT 0 | Times this pattern succeeded |
| `failure_count` | INTEGER | NOT NULL, DEFAULT 0 | Times this pattern failed |
| `last_used_at` | BIGINT | NOT NULL | Last usage timestamp |
| `created_at` | BIGINT | NOT NULL | Creation timestamp (epoch ms) |

**Defined in**: `UacRepository.ensureTables()`

---

### `uac_performance_metrics`

Performance metrics per UAC task.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Metric ID (UUID) |
| `task_id` | TEXT | NOT NULL, FK → `uac_tasks.id` ON DELETE CASCADE | Parent task |
| `metrics_json` | TEXT | NOT NULL | JSON performance metrics |
| `created_at` | BIGINT | NOT NULL | Timestamp (epoch ms) |

**Defined in**: `UacRepository.ensureTables()`

---

### `uac_collaboration_messages`

Inter-agent communication messages during council execution.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Message ID (UUID) |
| `task_id` | TEXT | NOT NULL, FK → `uac_tasks.id` ON DELETE CASCADE | Parent task |
| `stage_id` | TEXT | NOT NULL | Execution stage ID |
| `from_agent_id` | TEXT | NOT NULL | Sending agent ID |
| `to_agent_id` | TEXT | | Receiving agent ID (null = broadcast) |
| `channel` | TEXT | NOT NULL | Communication channel |
| `intent` | TEXT | NOT NULL | Message intent |
| `priority` | TEXT | NOT NULL | Priority level |
| `payload_json` | TEXT | NOT NULL | JSON message payload |
| `created_at` | BIGINT | NOT NULL | Timestamp (epoch ms) |
| `expires_at` | BIGINT | | Expiration timestamp |

**Defined in**: `UacRepository.ensureTables()`

---

### `uac_council_plans`

Council-level execution plans.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Plan ID (UUID) |
| `task_id` | TEXT | NOT NULL, FK → `uac_tasks.id` ON DELETE CASCADE | Parent task |
| `plan_version` | TEXT | NOT NULL | Plan version string |
| `user_constraints_json` | TEXT | | JSON user-defined constraints |
| `estimated_cost_usd` | REAL | | Estimated cost |
| `approved_at` | BIGINT | | Approval timestamp |
| `created_at` | BIGINT | NOT NULL | Creation timestamp |
| `updated_at` | BIGINT | NOT NULL | Last update timestamp |

**Defined in**: `UacRepository.ensureTables()`

---

### `uac_council_plan_stages`

Individual stages within a council plan.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Stage ID (UUID) |
| `plan_id` | TEXT | NOT NULL, FK → `uac_council_plans.id` ON DELETE CASCADE | Parent plan |
| `task_id` | TEXT | NOT NULL, FK → `uac_tasks.id` ON DELETE CASCADE | Parent task |
| `stage_id` | TEXT | NOT NULL | Logical stage identifier |
| `dependencies_json` | TEXT | NOT NULL | JSON array of dependency stage IDs |
| `assigned_agent` | TEXT | NOT NULL | Assigned agent ID |
| `status` | TEXT | NOT NULL | Stage status |
| `acceptance_json` | TEXT | NOT NULL | JSON acceptance criteria |
| `created_at` | BIGINT | NOT NULL | Creation timestamp |
| `updated_at` | BIGINT | NOT NULL | Last update timestamp |

**Defined in**: `UacRepository.ensureTables()`

---

### `uac_council_assignments`

Agent-to-stage assignments within council plans.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Assignment ID (UUID) |
| `task_id` | TEXT | NOT NULL, FK → `uac_tasks.id` ON DELETE CASCADE | Parent task |
| `stage_id` | TEXT | NOT NULL | Stage identifier |
| `agent_id` | TEXT | NOT NULL | Assigned agent |
| `assigned_at` | BIGINT | NOT NULL | Assignment timestamp |
| `reassigned_from` | TEXT | | Previous agent if reassigned |

**Defined in**: `UacRepository.ensureTables()`

---

### `uac_council_decisions`

Council decision records for auditability.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Decision ID (UUID) |
| `task_id` | TEXT | NOT NULL, FK → `uac_tasks.id` ON DELETE CASCADE | Parent task |
| `stage_id` | TEXT | | Associated stage |
| `decision_type` | TEXT | NOT NULL | Decision type |
| `reason` | TEXT | NOT NULL | Decision rationale |
| `actor` | TEXT | NOT NULL | Decision maker |
| `created_at` | BIGINT | NOT NULL | Timestamp (epoch ms) |

**Defined in**: `UacRepository.ensureTables()`

---

### `uac_council_interrupts`

Interrupt events that modify council execution flow.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Interrupt ID (UUID) |
| `task_id` | TEXT | NOT NULL, FK → `uac_tasks.id` ON DELETE CASCADE | Parent task |
| `stage_id` | TEXT | | Associated stage |
| `interrupt_type` | TEXT | NOT NULL | Type of interrupt |
| `payload_json` | TEXT | NOT NULL | JSON interrupt payload |
| `created_at` | BIGINT | NOT NULL | Timestamp (epoch ms) |

**Defined in**: `UacRepository.ensureTables()`

---

## Marketplace Domain

### `marketplace_models`

Cached catalog of models from Ollama and HuggingFace.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Model identifier |
| `name` | TEXT | NOT NULL | Model name |
| `provider` | TEXT | NOT NULL | Source provider (`ollama`, `huggingface`) |
| `pulls` | TEXT | | Pull/download count (string) |
| `tag_count` | INTEGER | DEFAULT 0 | Number of available tags |
| `last_updated` | TEXT | | Last upstream update date |
| `categories` | TEXT | DEFAULT '[]' | JSON array of categories |
| `short_description` | TEXT | | Brief model description |
| `downloads` | INTEGER | | Download count |
| `likes` | INTEGER | | Like count |
| `author` | TEXT | | Model author |
| `created_at` | INTEGER | NOT NULL | Cache creation timestamp (epoch ms) |
| `updated_at` | INTEGER | NOT NULL | Cache update timestamp (epoch ms) |

**Defined in**: Rust migration 9 (`add_marketplace_models_table`)

---

## Migration Tracking

### `_migrations` (Rust db-service)

Tracks applied Rust-level schema migrations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Migration sequence number |
| `name` | TEXT | NOT NULL | Migration name |
| `applied_at` | INTEGER | NOT NULL | Application timestamp (epoch ms) |

---

### `migration_history` (TypeScript layer)

Tracks application-level index migrations managed by `DatabaseService`.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `version` | INTEGER | PRIMARY KEY | Migration version number |
| `name` | TEXT | NOT NULL | Migration name |
| `checksum` | TEXT | NOT NULL | Migration checksum for integrity |
| `applied_at` | BIGINT | NOT NULL | Application timestamp (epoch ms) |
| `rolled_back_at` | BIGINT | | Rollback timestamp if reverted |

---

## Index Summary

### Core Tables

| Index | Table | Columns | Source |
|-------|-------|---------|--------|
| `idx_chats_updated_at` | chats | `updated_at DESC` | Rust M1, SystemRepo |
| `idx_chats_folder_id` | chats | `folder_id` | Rust M1, SystemRepo |
| `idx_chats_project_id` | chats | `project_id` | Rust M1, SystemRepo |
| `idx_messages_chat_id` | messages | `chat_id` | Rust M1, TS Migration 1 |
| `idx_messages_timestamp` | messages | `timestamp DESC` | Rust M1, TS Migration 1 |
| `idx_messages_chat_time` | messages | `chat_id, timestamp ASC` | SystemRepo |
| `idx_projects_status` | projects | `status` | Rust M1 |
| `idx_projects_updated_at` | projects | `updated_at DESC` | Rust M1 |
| `idx_prompts_created_at` | prompts | `created_at DESC` | SystemRepo |

### Knowledge Tables

| Index | Table | Columns |
|-------|-------|---------|
| `idx_code_symbols_project_path` | code_symbols | `project_path` |
| `idx_code_symbols_name` | code_symbols | `name` |
| `idx_code_symbols_file_path` | code_symbols | `file_path` |
| `idx_semantic_fragments_source` | semantic_fragments | `source` |
| `idx_semantic_fragments_project_path` | semantic_fragments | `project_path` |
| `idx_episodic_memories_timestamp` | episodic_memories | `timestamp DESC` |
| `idx_entity_knowledge_name` | entity_knowledge | `entity_name` |
| `idx_file_diffs_file_path` | file_diffs | `file_path` |
| `idx_file_diffs_created_at` | file_diffs | `created_at DESC` |
| `idx_file_diffs_session` | file_diffs | `session_id` |

### System Tables

| Index | Table | Columns |
|-------|-------|---------|
| `idx_token_usage_timestamp` | token_usage | `timestamp DESC` |
| `idx_token_usage_provider` | token_usage | `provider` |
| `idx_token_usage_provider_model_time` | token_usage | `provider, model, timestamp DESC` |
| `idx_token_usage_project_time` | token_usage | `project_path, timestamp DESC` |
| `idx_usage_tracking_timestamp` | usage_tracking | `timestamp DESC` |
| `idx_usage_tracking_provider_model` | usage_tracking | `provider, model` |
| `idx_audit_logs_timestamp` | audit_logs | `timestamp DESC` |
| `idx_audit_logs_category` | audit_logs | `category` |
| `idx_audit_logs_category_timestamp` | audit_logs | `category, timestamp DESC` |
| `idx_linked_accounts_provider` | linked_accounts | `provider` |
| `idx_linked_accounts_provider_active` | linked_accounts | `provider, is_active` |

### Agent Tables

| Index | Table | Columns |
|-------|-------|---------|
| `idx_agent_templates_category` | agent_templates | `category` |
| `idx_agent_templates_name` | agent_templates | `name` |
| `idx_agent_tasks_project` | agent_tasks | `project_id` |
| `idx_agent_messages_task` | agent_messages | `task_id, sequence_number` |
| `idx_agent_events_task` | agent_events | `task_id, timestamp` |
| `idx_agent_tools_task` | agent_tool_executions | `task_id` |
| `idx_agent_checkpoints_task` | agent_checkpoints | `task_id, step_index` |
| `idx_marketplace_models_provider` | marketplace_models | `provider` |
| `idx_marketplace_models_name` | marketplace_models | `name` |
| `idx_marketplace_models_updated_at` | marketplace_models | `updated_at DESC` |

### UAC Tables

| Index | Table | Columns |
|-------|-------|---------|
| `idx_uac_tasks_project_status` | uac_tasks | `project_path, status, updated_at DESC` |
| `idx_uac_tasks_node_id` | uac_tasks | `node_id` |
| `idx_uac_steps_task_index` | uac_steps | `task_id, index_num` |
| `idx_uac_logs_task_created` | uac_logs | `task_id, created_at ASC` |
| `idx_uac_checkpoints_task_created` | uac_checkpoints | `task_id, created_at DESC` |
| `idx_uac_checkpoints_task_step` | uac_checkpoints | `task_id, step_index DESC` |
| `idx_uac_plan_versions_task_version` | uac_plan_versions | `task_id, version_number DESC` |
| `idx_uac_canvas_nodes_updated` | uac_canvas_nodes | `updated_at DESC` |
| `idx_uac_canvas_edges_source_target` | uac_canvas_edges | `source, target` |
| `idx_uac_plan_patterns_keywords` | uac_plan_patterns | `task_keywords` |
| `idx_uac_performance_metrics_task_created` | uac_performance_metrics | `task_id, created_at DESC` |

---

## Relationships Diagram

```
┌──────────┐       ┌──────────┐       ┌──────────┐
│  folders │◄──────│   chats  │──────►│ projects │
└──────────┘  fk   └────┬─────┘  fk   └──────────┘
                        │ 1:N
                   ┌────▼─────┐
                   │ messages  │
                   └──────────┘

┌─────────────────┐     ┌────────────────────┐
│   uac_tasks     │◄────│ uac_council_plans  │
└───┬─────────────┘     └──┬─────────────────┘
    │ 1:N                  │ 1:N
    ├── uac_steps          ├── uac_council_plan_stages
    ├── uac_logs           └── (FK to uac_tasks)
    ├── uac_checkpoints
    ├── uac_plan_versions
    ├── uac_performance_metrics
    ├── uac_collaboration_messages
    ├── uac_council_assignments
    ├── uac_council_decisions
    └── uac_council_interrupts

┌─────────────────────┐
│ uac_canvas_nodes    │◄───┐
└─────────────────────┘    │ FK (source, target)
                      ┌────┴──────────────┐
                      │ uac_canvas_edges   │
                      └───────────────────┘

┌──────────────┐
│ agent_tasks  │
└───┬──────────┘
    │ 1:N (all FK CASCADE)
    ├── agent_messages
    ├── agent_tool_executions
    ├── agent_events
    ├── agent_provider_history
    ├── agent_errors
    └── agent_checkpoints
```

---

## Notes

- **Timestamps**: Core tables use `INTEGER` (epoch milliseconds). Agent persistence tables use `TEXT` (ISO 8601).
- **JSON fields**: Stored as `TEXT` columns. Arrays default to `'[]'`, objects to `'{}'`.
- **Vector embeddings**: Stored as `BLOB` in core tables. The `<->` operator is used for distance queries (PGlite compatibility).
- **Foreign keys**: UAC tables enforce `ON DELETE CASCADE` via `PRAGMA foreign_keys = ON`. Core tables use logical relationships.
- **Soft deletes**: Agents use `agent_archives` for soft deletion with recovery support.

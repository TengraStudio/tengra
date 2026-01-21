import { appLogger } from '@main/logging/logger'
import { Migration } from '@main/services/data/db-migration.service'
import { JsonObject } from '@shared/types/common'
import { DatabaseAdapter } from '@shared/types/database'

export function getMigrationDefinitions(isTest: boolean): Migration[] {
    return [
        ...getCoreSchemaMigrations(isTest),
        ...getCodeIntelligenceMigrations(isTest),
        ...getUtilitySchemaMigrations()
    ]
}

function getCoreSchemaMigrations(isTest: boolean): Migration[] {
    return [
        ...getProjectMigrations(),
        ...getChatMigrations(isTest),
        ...getFolderPromptCouncilMigrations()
    ]
}

function getProjectMigrations(): Migration[] {
    return [
        {
            id: 1,
            name: 'Initial Schema (Postgres)',
            up: async (db: DatabaseAdapter) => {
                await db.exec(`
                    CREATE TABLE IF NOT EXISTS projects (
                        id TEXT PRIMARY KEY,
                        title TEXT NOT NULL,
                        description TEXT DEFAULT '',
                        path TEXT NOT NULL,
                        mounts TEXT DEFAULT '[]',
                        chat_ids TEXT DEFAULT '[]',
                        council_config TEXT DEFAULT '{"enabled":false,"members":[],"consensusThreshold":0.7}',
                        status TEXT DEFAULT 'active',
                        logo TEXT,
                        metadata TEXT DEFAULT '{}',
                        created_at BIGINT NOT NULL,
                        updated_at BIGINT NOT NULL
                    );
                    CREATE TABLE IF NOT EXISTS chat_events (
                        id TEXT PRIMARY KEY,
                        thread_id TEXT NOT NULL,
                        type TEXT NOT NULL,
                        payload TEXT NOT NULL,
                        timestamp BIGINT NOT NULL,
                        metadata TEXT DEFAULT '{}'
                    );
                    CREATE INDEX IF NOT EXISTS idx_chat_events_thread_id ON chat_events(thread_id);
                `)
            }
        },
        {
            id: 2,
            name: 'Time Tracking',
            up: async (db: DatabaseAdapter) => {
                await db.exec(`
                    CREATE TABLE IF NOT EXISTS time_tracking (
                        id TEXT PRIMARY KEY,
                        type TEXT NOT NULL,
                        project_id TEXT,
                        start_time BIGINT NOT NULL,
                        end_time BIGINT,
                        duration_ms BIGINT DEFAULT 0,
                        created_at BIGINT NOT NULL,
                        updated_at BIGINT NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_time_tracking_type ON time_tracking(type);
                `)
            }
        }
    ]
}

function getChatMigrations(isTest: boolean): Migration[] {
    return [
        {
            id: 3,
            name: 'Chats and Messages',
            up: async (db: DatabaseAdapter) => {
                await db.exec(`
                    CREATE TABLE IF NOT EXISTS chats (
                        id TEXT PRIMARY KEY,
                        title TEXT NOT NULL,
                        is_Generating INTEGER DEFAULT 0,
                        backend TEXT,
                        model TEXT,
                        folder_id TEXT,
                        project_id TEXT,
                        is_pinned INTEGER DEFAULT 0,
                        is_favorite INTEGER DEFAULT 0,
                        metadata TEXT DEFAULT '{}',
                        created_at BIGINT NOT NULL,
                        updated_at BIGINT NOT NULL
                    );
                    CREATE TABLE IF NOT EXISTS messages (
                        id TEXT PRIMARY KEY,
                        chat_id TEXT NOT NULL,
                        role TEXT NOT NULL,
                        content TEXT NOT NULL,
                        timestamp BIGINT NOT NULL,
                        provider TEXT,
                        model TEXT,
                        metadata TEXT DEFAULT '{}',
                        vector ${isTest ? 'FLOAT8[]' : 'vector(1536)'}, -- Vector support
                        FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
                    );
                    CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC);
                    CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
                `)
            }
        }
    ]
}

function getFolderPromptCouncilMigrations(): Migration[] {
    return [
        {
            id: 4,
            name: 'Folders, Prompts, Council',
            up: async (db: DatabaseAdapter) => {
                await db.exec(`
                    CREATE TABLE IF NOT EXISTS folders (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        color TEXT,
                        created_at BIGINT NOT NULL,
                        updated_at BIGINT NOT NULL
                    );
                    CREATE TABLE IF NOT EXISTS prompts (
                        id TEXT PRIMARY KEY,
                        title TEXT NOT NULL,
                        content TEXT NOT NULL,
                        tags TEXT DEFAULT '[]',
                        created_at BIGINT NOT NULL,
                        updated_at BIGINT NOT NULL
                    );
                    CREATE TABLE IF NOT EXISTS council_sessions (
                        id TEXT PRIMARY KEY,
                        goal TEXT NOT NULL,
                        status TEXT NOT NULL,
                        logs TEXT DEFAULT '[]',
                        agents TEXT DEFAULT '[]',
                        plan TEXT,
                        solution TEXT,
                        created_at BIGINT NOT NULL,
                        updated_at BIGINT NOT NULL
                    );
                `)
            }
        }
    ]
}

function getCodeIntelligenceMigrations(isTest: boolean): Migration[] {
    return [
        {
            id: 5,
            name: 'Code Intelligence & Vectors',
            up: async (db: DatabaseAdapter) => {
                await db.exec(`
                    CREATE TABLE IF NOT EXISTS semantic_fragments (
                        id TEXT PRIMARY KEY,
                        content TEXT,
                        embedding ${isTest ? 'FLOAT8[]' : 'vector(1536)'},
                        source TEXT,
                        source_id TEXT,
                        tags TEXT DEFAULT '[]',
                        importance FLOAT,
                        project_id TEXT,
                        created_at BIGINT,
                        updated_at BIGINT
                    );
                    CREATE TABLE IF NOT EXISTS episodic_memories (
                        id TEXT PRIMARY KEY,
                        title TEXT,
                        summary TEXT,
                        embedding ${isTest ? 'FLOAT8[]' : 'vector(1536)'},
                        start_date BIGINT,
                        end_date BIGINT,
                        chat_id TEXT,
                        participants TEXT DEFAULT '[]',
                        created_at BIGINT
                    );
                    CREATE TABLE IF NOT EXISTS code_symbols (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        project_path TEXT,
                        file_path TEXT,
                        line INTEGER,
                        kind TEXT,
                        signature TEXT,
                        docstring TEXT,
                        embedding ${isTest ? 'FLOAT8[]' : 'vector(1536)'}
                    );
                    CREATE INDEX IF NOT EXISTS idx_code_symbols_project ON code_symbols(project_path);
                    CREATE INDEX IF NOT EXISTS idx_code_symbols_name ON code_symbols(name);
                    
                    CREATE TABLE IF NOT EXISTS agents (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        system_prompt TEXT,
                        tools TEXT DEFAULT '[]',
                        parent_model TEXT,
                        created_at BIGINT,
                        updated_at BIGINT
                    );

                    CREATE TABLE IF NOT EXISTS memories (
                        key TEXT PRIMARY KEY,
                        value TEXT,
                        updated_at BIGINT
                    );

                    CREATE TABLE IF NOT EXISTS entity_knowledge (
                        id TEXT PRIMARY KEY,
                        entity_type TEXT,
                        entity_name TEXT,
                        key TEXT,
                        value TEXT,
                        confidence FLOAT,
                        source TEXT,
                        updated_at BIGINT
                    );
                `)
            }
        }
    ]
}

function getUtilitySchemaMigrations(): Migration[] {
    return [
        ...getTimestampAndIndexMigrations(),
        ...getTokenAndUsageMigrations(),
        ...getMultiAccountMigrations()
    ]
}

function getTimestampAndIndexMigrations(): Migration[] {
    return [
        {
            id: 6,
            name: 'Fix Timestamp Types',
            up: async (db: DatabaseAdapter) => {
                const queries = [
                    'ALTER TABLE projects ALTER COLUMN created_at TYPE BIGINT',
                    'ALTER TABLE projects ALTER COLUMN updated_at TYPE BIGINT',
                    'ALTER TABLE chat_events ALTER COLUMN timestamp TYPE BIGINT',
                    'ALTER TABLE time_tracking ALTER COLUMN start_time TYPE BIGINT',
                    'ALTER TABLE time_tracking ALTER COLUMN end_time TYPE BIGINT',
                    'ALTER TABLE time_tracking ALTER COLUMN duration_ms TYPE BIGINT',
                    'ALTER TABLE time_tracking ALTER COLUMN created_at TYPE BIGINT',
                    'ALTER TABLE time_tracking ALTER COLUMN updated_at TYPE BIGINT',
                    'ALTER TABLE chats ALTER COLUMN created_at TYPE BIGINT',
                    'ALTER TABLE chats ALTER COLUMN updated_at TYPE BIGINT',
                    'ALTER TABLE messages ALTER COLUMN timestamp TYPE BIGINT',
                    'ALTER TABLE folders ALTER COLUMN created_at TYPE BIGINT',
                    'ALTER TABLE folders ALTER COLUMN updated_at TYPE BIGINT',
                    'ALTER TABLE prompts ALTER COLUMN created_at TYPE BIGINT',
                    'ALTER TABLE prompts ALTER COLUMN updated_at TYPE BIGINT',
                    'ALTER TABLE council_sessions ALTER COLUMN created_at TYPE BIGINT',
                    'ALTER TABLE council_sessions ALTER COLUMN updated_at TYPE BIGINT'
                ];
                for (const query of queries) {
                    try {
                        await db.exec(query);
                    } catch {
                        appLogger.debug('DatabaseService', `Type fix skipped: ${query}`);
                    }
                }
            }
        },
        {
            id: 7,
            name: 'Add Performance Indexes',
            up: async (db: DatabaseAdapter) => {
                const indexQueries = [
                    'CREATE INDEX IF NOT EXISTS idx_chats_folder_id ON chats(folder_id)',
                    'CREATE INDEX IF NOT EXISTS idx_chats_project_id ON chats(project_id)',
                    'CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at DESC)',
                    'CREATE INDEX IF NOT EXISTS idx_chats_is_pinned ON chats(is_pinned) WHERE is_pinned = 1',
                    'CREATE INDEX IF NOT EXISTS idx_chats_is_favorite ON chats(is_favorite) WHERE is_favorite = 1',
                    'CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC)',
                    'CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role)',
                    'CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)',
                    'CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC)',
                    'CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC)',
                    'CREATE INDEX IF NOT EXISTS idx_time_tracking_project_id ON time_tracking(project_id)',
                    'CREATE INDEX IF NOT EXISTS idx_time_tracking_start_time ON time_tracking(start_time DESC)',
                    'CREATE INDEX IF NOT EXISTS idx_council_sessions_status ON council_sessions(status)',
                    'CREATE INDEX IF NOT EXISTS idx_council_sessions_created_at ON council_sessions(created_at DESC)',
                    'CREATE INDEX IF NOT EXISTS idx_semantic_fragments_project_id ON semantic_fragments(project_id)',
                    'CREATE INDEX IF NOT EXISTS idx_semantic_fragments_source ON semantic_fragments(source)',
                    'CREATE INDEX IF NOT EXISTS idx_entity_knowledge_entity_type ON entity_knowledge(entity_type)',
                    'CREATE INDEX IF NOT EXISTS idx_entity_knowledge_entity_name ON entity_knowledge(entity_name)'
                ];
                for (const query of indexQueries) {
                    try {
                        await db.exec(query);
                    } catch {
                        appLogger.debug('DatabaseService', `Index creation skipped: ${query}`);
                    }
                }
            }
        }
    ]
}

function getTokenAndUsageMigrations(): Migration[] {
    return [
        {
            id: 8,
            name: 'Usage Tracking Schema',
            up: async (db: DatabaseAdapter) => {
                await db.exec(`
                    CREATE TABLE IF NOT EXISTS usage_tracking (
                        id TEXT PRIMARY KEY,
                        timestamp BIGINT NOT NULL,
                        provider TEXT NOT NULL,
                        model TEXT NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_usage_tracking_timestamp ON usage_tracking(timestamp);
                    CREATE INDEX IF NOT EXISTS idx_usage_tracking_provider ON usage_tracking(provider);
                `)
            }
        },
        {
            id: 9,
            name: 'Prompt Templates Schema',
            up: async (db: DatabaseAdapter) => {
                await db.exec(`
                    CREATE TABLE IF NOT EXISTS prompt_templates (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        description TEXT,
                        template TEXT NOT NULL,
                        variables TEXT NOT NULL,
                        category TEXT,
                        tags TEXT,
                        created_at BIGINT NOT NULL,
                        updated_at BIGINT NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates(category);
                `)
            }
        },
        {
            id: 10,
            name: 'Audit Logs Schema',
            up: async (db: DatabaseAdapter) => {
                await db.exec(`
                    CREATE TABLE IF NOT EXISTS audit_logs (
                        id TEXT PRIMARY KEY,
                        timestamp BIGINT NOT NULL,
                        action TEXT NOT NULL,
                        category TEXT NOT NULL,
                        user_id TEXT,
                        details TEXT,
                        ip_address TEXT,
                        user_agent TEXT,
                        success BOOLEAN NOT NULL,
                        error TEXT
                    );
                    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
                    CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);
                `)
            }
        },
        {
            id: 11,
            name: 'Job Scheduler State Schema',
            up: async (db: DatabaseAdapter) => {
                await db.exec(`
                    CREATE TABLE IF NOT EXISTS scheduler_state (
                        id TEXT PRIMARY KEY,
                        last_run BIGINT NOT NULL,
                        updated_at BIGINT NOT NULL
                    );
                `)
            }
        },
        {
            id: 12,
            name: 'Auth Tokens Schema',
            up: async (db: DatabaseAdapter) => {
                await db.exec(`
                    CREATE TABLE IF NOT EXISTS auth_tokens (
                        id TEXT PRIMARY KEY,
                        provider TEXT NOT NULL,
                        access_token TEXT,
                        refresh_token TEXT,
                        session_token TEXT,
                        expires_at BIGINT,
                        scope TEXT,
                        metadata TEXT,
                        updated_at BIGINT NOT NULL
                    );
                `);
            }
        }
    ]
}

function getMultiAccountMigrations(): Migration[] {
    return [
        {
            id: 13,
            name: 'Multi-Account Auth Schema',
            up: async (db: DatabaseAdapter) => {
                const now = Date.now();
                await db.exec(`
                    CREATE TABLE IF NOT EXISTS auth_accounts (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        avatar TEXT,
                        created_at BIGINT NOT NULL,
                        updated_at BIGINT NOT NULL
                    );
                    INSERT INTO auth_accounts (id, name, created_at, updated_at)
                    VALUES ('default', 'Default Account', ${now}, ${now})
                    ON CONFLICT(id) DO NOTHING;
                `);

                // Rebuild auth_tokens with correct schema and relationships
                // We assume migration 12 ran, so we rename/copy/drop pattern

                // 1. Create new table
                await db.exec(`
                    CREATE TABLE IF NOT EXISTS auth_tokens_new (
                        id TEXT PRIMARY KEY,
                        account_id TEXT NOT NULL,
                        provider TEXT NOT NULL,
                        access_token TEXT,
                        refresh_token TEXT,
                        session_token TEXT,
                        expires_at BIGINT,
                        scope TEXT,
                        metadata TEXT,
                        updated_at BIGINT NOT NULL,
                        UNIQUE(account_id, provider),
                        FOREIGN KEY(account_id) REFERENCES auth_accounts(id) ON DELETE CASCADE
                    );
                `);

                // 2. Migrate data (if any exists in old table)
                // We try to migrate from 'auth_tokens' if it exists. 
                // Note: 'auth_tokens' might not have account_id yet.
                try {
                    const existing = await db.query('SELECT count(*) as c FROM auth_tokens').then(r => r.rows[0] as { c: number });
                    if (Number(existing.c) > 0) {
                        await db.exec(`
                            INSERT INTO auth_tokens_new (id, account_id, provider, access_token, refresh_token, session_token, expires_at, scope, metadata, updated_at)
                            SELECT id, 'default', provider, access_token, refresh_token, session_token, expires_at, scope, metadata, updated_at
                            FROM auth_tokens;
                        `);
                    }
                } catch {
                    // Ignore if auth_tokens doesn't exist or query fails
                }

                // 3. Swap tables
                await db.exec(`DROP TABLE IF EXISTS auth_tokens;`);
                await db.exec(`ALTER TABLE auth_tokens_new RENAME TO auth_tokens;`);
            }
        },
        {
            id: 14,
            name: 'Add email to auth_tokens and fix multi-account constraint',
            up: async (db: DatabaseAdapter) => {
                // 1. Create the new table with the email column and the correct UNIQUE constraint
                await db.exec(`
                    CREATE TABLE IF NOT EXISTS auth_tokens_v14 (
                        id TEXT PRIMARY KEY,
                        account_id TEXT NOT NULL,
                        provider TEXT NOT NULL,
                        email TEXT,
                        access_token TEXT,
                        refresh_token TEXT,
                        session_token TEXT,
                        expires_at BIGINT,
                        scope TEXT,
                        metadata TEXT,
                        updated_at BIGINT NOT NULL,
                        UNIQUE(account_id, provider, email),
                        FOREIGN KEY(account_id) REFERENCES auth_accounts(id) ON DELETE CASCADE
                    );
                `);

                // 2. Migrate data from auth_tokens
                try {
                    await db.exec(`
                        INSERT INTO auth_tokens_v14 (id, account_id, provider, access_token, refresh_token, session_token, expires_at, scope, metadata, updated_at)
                        SELECT id, account_id, provider, access_token, refresh_token, session_token, expires_at, scope, metadata, updated_at
                        FROM auth_tokens;
                    `);
                } catch {
                    appLogger.warn('DatabaseService', 'Migration 14: Failed to migrate existing tokens or table missing.');
                }

                // 3. Replace old table
                await db.exec(`DROP TABLE IF EXISTS auth_tokens;`);
                await db.exec(`ALTER TABLE auth_tokens_v14 RENAME TO auth_tokens;`);
            }
        },
        {
            id: 15,
            name: 'Create linked_accounts table for provider-centric multi-account',
            up: async (db: DatabaseAdapter) => {
                const now = Date.now();

                // Create the new linked_accounts table
                await db.exec(`
                    CREATE TABLE IF NOT EXISTS linked_accounts (
                        id TEXT PRIMARY KEY,
                        provider TEXT NOT NULL,
                        email TEXT,
                        display_name TEXT,
                        avatar_url TEXT,
                        access_token TEXT,
                        refresh_token TEXT,
                        session_token TEXT,
                        expires_at BIGINT,
                        scope TEXT,
                        is_active BOOLEAN DEFAULT FALSE,
                        metadata TEXT,
                        created_at BIGINT NOT NULL,
                        updated_at BIGINT NOT NULL,
                        UNIQUE(provider, email)
                    );
                `);

                // Create indices for fast lookup
                await db.exec(`CREATE INDEX IF NOT EXISTS idx_linked_accounts_provider ON linked_accounts(provider);`);
                await db.exec(`CREATE INDEX IF NOT EXISTS idx_linked_accounts_active ON linked_accounts(provider, is_active);`);

                // Migrate existing tokens from auth_tokens to linked_accounts
                try {
                    const existingTokens = await db.query('SELECT * FROM auth_tokens');
                    for (const row of existingTokens.rows) {
                        const token = row as JsonObject;
                        // Check if already migrated
                        const email = token.email as string || null;
                        const provider = token.provider as string;
                        const existing = await db.query(
                            'SELECT id FROM linked_accounts WHERE provider = $1 AND (email = $2 OR (email IS NULL AND $2 IS NULL))',
                            [provider, email]
                        );

                        if (existing.rows.length === 0) {
                            const metadataStr = token.metadata ? JSON.stringify(token.metadata) : null;
                            await db.prepare(`
                                INSERT INTO linked_accounts (id, provider, email, access_token, refresh_token, session_token, expires_at, scope, is_active, metadata, created_at, updated_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `).run(
                                token.id as string,
                                provider,
                                email,
                                token.access_token as string | null,
                                token.refresh_token as string | null,
                                token.session_token as string | null,
                                token.expires_at as number | null,
                                token.scope as string | null,
                                true,  // First account per provider is active
                                metadataStr,
                                now,
                                (token.updated_at as number | undefined) ?? now
                            );
                        }
                    }
                } catch {
                    appLogger.warn('DatabaseService', 'Migration 15: No existing tokens to migrate or migration failed.');
                }
            }
        },
        {
            id: 16,
            name: 'Cleanup legacy auth tables',
            up: async (db: DatabaseAdapter) => {
                await db.exec(`DROP TABLE IF EXISTS auth_tokens;`);
                await db.exec(`DROP TABLE IF EXISTS auth_accounts;`);
            }
        }
    ]
}

/**
 * Database Migrations
 * Define all schema migrations here
 */

import { Migration } from '@main/services/migration.service'

/**
 * Migration v1: Initial schema setup
 * - Creates base directories
 * - Sets up initial data structures
 */
export const migration_v1_initial_setup: Migration = {
    version: 1,
    name: 'initial_setup',
    up: async () => {
        // This migration documents the initial schema
        // Most directories are already created by DataService.migrate()
        console.log('[Migration v1] Initial schema documented')
    }
}

/**
 * Migration v2: Add pinned field to chats
 * - Adds isPinned field to chat objects
 */
export const migration_v2_add_chat_pinned: Migration = {
    version: 2,
    name: 'add_chat_pinned_field',
    up: async () => {
        console.log('[Migration v2] Chat pinning field is now supported')
        // The field is optional and defaults to false when not present
        // No data modification needed - UI handles missing field gracefully
    }
}

/**
 * Migration v3: Add folder support
 * - Creates folders.json if it doesn't exist
 */
export const migration_v3_add_folders: Migration = {
    version: 3,
    name: 'add_folder_support',
    up: async () => {
        console.log('[Migration v3] Folder support initialized')
        // Folders are created via DatabaseService when needed
    }
}

/**
 * Migration v4: Add memory system tables
 * - Semantic fragments
 * - Episodic memories
 * - Entity knowledge
 */
export const migration_v4_add_memory_system: Migration = {
    version: 4,
    name: 'add_memory_system',
    up: async () => {
        console.log('[Migration v4] Memory system tables initialized')
        // LanceDB tables are created on first use by MemoryService
    }
}

/**
 * Get all registered migrations
 */
export function getAllMigrations(): Migration[] {
    return [
        migration_v1_initial_setup,
        migration_v2_add_chat_pinned,
        migration_v3_add_folders,
        migration_v4_add_memory_system
    ]
}

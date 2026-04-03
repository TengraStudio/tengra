/**
 * Cached database operations
 * Provides intelligent caching layer for frequently accessed database queries
 */

import { Chat, Folder, Message, Workspace, WorkspaceMount } from '@/types';

import { chatCache, dbQueryCache, invalidateCache, withCache, workspaceCache } from './lru-cache.util';

export class CachedDatabase {
    /**
     * Get all chats with caching
     */
    static async getAllChats(): Promise<Chat[]> {
        return withCache(
            'chats:all',
            () => window.electron.db.getAllChats(),
            chatCache,
            60000 // Cache for 1 minute
        );
    }

    /**
     * Get chat by ID with caching
     */
    static async getChat(chatId: string): Promise<Chat | null> {
        return withCache(
            `chat:${chatId}`,
            () => window.electron.db.getChat(chatId),
            chatCache,
            120000 // Cache for 2 minutes
        );
    }

    /**
     * Get messages with caching
     */
    static async getMessages(chatId: string): Promise<Message[]> {
        return withCache(
            `messages:${chatId}`,
            () => window.electron.db.getMessages(chatId),
            chatCache,
            300000 // Cache for 5 minutes
        );
    }

    /**
     * Get workspaces with caching
     */
    static async getWorkspaces(): Promise<Workspace[]> {
        return withCache(
            'workspaces:all',
            () => window.electron.db.getWorkspaces(),
            workspaceCache,
            120000 // Cache for 2 minutes
        );
    }

    /**
     * Get folders with caching
     */
    static async getFolders(): Promise<Folder[]> {
        return withCache(
            'folders:all',
            () => window.electron.db.getFolders(),
            dbQueryCache,
            60000 // Cache for 1 minute
        );
    }

    /**
     * Get database stats with caching
     */
    static async getStats(): Promise<{ chatCount: number; messageCount: number; dbSize: number }> {
        return withCache(
            'db:stats',
            () => window.electron.db.getStats(),
            dbQueryCache,
            30000 // Cache for 30 seconds
        );
    }

    /**
     * Get detailed stats with caching
     */
    static async getDetailedStats(period: string): Promise<Awaited<ReturnType<Window['electron']['db']['getDetailedStats']>>> {
        return withCache(
            `stats:detailed:${period}`,
            () => window.electron.db.getDetailedStats(period),
            dbQueryCache,
            60000 // Cache for 1 minute
        );
    }

    /**
     * Create chat and invalidate cache
     */
    static async createChat(chat: Chat): Promise<{ success: boolean }> {
        const result = await window.electron.db.createChat(chat);

        // Invalidate related cache entries
        invalidateCache('chats:', chatCache);
        invalidateCache('db:stats', dbQueryCache);

        return result;
    }

    /**
     * Update chat and invalidate cache
     */
    static async updateChat(id: string, updates: Partial<Chat>): Promise<{ success: boolean }> {
        const result = await window.electron.db.updateChat(id, updates);

        // Invalidate specific and related cache entries
        chatCache.delete(`chat:${id}`);
        invalidateCache('chats:', chatCache);

        return result;
    }

    /**
     * Delete chat and invalidate cache
     */
    static async deleteChat(id: string): Promise<{ success: boolean }> {
        const result = await window.electron.db.deleteChat(id);

        // Invalidate all related cache entries
        chatCache.delete(`chat:${id}`);
        chatCache.delete(`messages:${id}`);
        invalidateCache('chats:', chatCache);
        invalidateCache('db:stats', dbQueryCache);

        return result;
    }

    /**
     * Add message and invalidate cache
     */
    static async addMessage(message: Message): Promise<{ success: boolean }> {
        const result = await window.electron.db.addMessage(message);

        // Invalidate message cache for this chat
        chatCache.delete(`messages:${message.chatId}`);
        chatCache.delete(`chat:${message.chatId}`);
        invalidateCache('db:stats', dbQueryCache);

        return result;
    }

    /**
     * Delete messages and invalidate cache
     */
    static async deleteMessages(chatId: string): Promise<{ success: boolean }> {
        const result = await window.electron.db.deleteMessages(chatId);

        // Invalidate message cache
        chatCache.delete(`messages:${chatId}`);
        chatCache.delete(`chat:${chatId}`);
        invalidateCache('db:stats', dbQueryCache);

        return result;
    }

    /**
     * Create workspace and invalidate cache
     */
    static async createWorkspace(name: string, path: string, description: string, mounts?: WorkspaceMount[]): Promise<Workspace> {
        const result = await window.electron.db.createWorkspace(name, path, description, mounts);

        // Invalidate workspace cache
        invalidateCache('workspaces:', workspaceCache);
        invalidateCache('db:stats', dbQueryCache);

        return result;
    }

    /**
     * Update workspace and invalidate cache
     */
    static async updateWorkspace(id: string, updates: Partial<Workspace>): Promise<Workspace | null> {
        const result = await window.electron.db.updateWorkspace(id, updates);

        // Invalidate workspace cache
        invalidateCache('workspaces:', workspaceCache);

        return result;
    }

    /**
     * Delete workspace and invalidate cache
     */
    static async deleteWorkspace(id: string, deleteFiles?: boolean): Promise<void> {
        const result = await window.electron.db.deleteWorkspace(id, deleteFiles);

        // Invalidate workspace cache
        invalidateCache('workspaces:', workspaceCache);
        invalidateCache('db:stats', dbQueryCache);

        return result;
    }

    /**
     * Create folder and invalidate cache
     */
    static async createFolder(name: string, color?: string): Promise<Folder> {
        const result = await window.electron.db.createFolder(name, color);

        // Invalidate folder cache
        invalidateCache('folders:', dbQueryCache);

        return result;
    }

    /**
     * Update folder and invalidate cache
     */
    static async updateFolder(id: string, updates: Partial<Folder>): Promise<void> {
        const result = await window.electron.db.updateFolder(id, updates);

        // Invalidate folder cache
        invalidateCache('folders:', dbQueryCache);

        return result;
    }

    /**
     * Delete folder and invalidate cache
     */
    static async deleteFolder(id: string): Promise<void> {
        const result = await window.electron.db.deleteFolder(id);

        // Invalidate folder and chat caches
        invalidateCache('folders:', dbQueryCache);
        invalidateCache('chats:', chatCache); // Chats may reference folders

        return result;
    }

    /**
     * Clear all caches
     */
    static clearAllCaches(): void {
        chatCache.clear();
        workspaceCache.clear();
        dbQueryCache.clear();
    }

    /**
     * Get cache statistics for monitoring
     */
    static getCacheStats() {
        return {
            chat: chatCache.getStats(),
            workspace: workspaceCache.getStats(),
            db: dbQueryCache.getStats()
        };
    }
}

// Export for easy migration from direct window.electron.db calls
export default CachedDatabase;

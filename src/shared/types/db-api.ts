/**
 * Database Service API Types
 *
 * These types define the HTTP API contract between the Electron app
 * and the standalone Rust database service.
 */

import { JsonObject, JsonValue } from './common';

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API response wrapper
 */
export interface DbApiResponse<T = unknown> {
    success: boolean
    data?: T
    error?: string
}

/**
 * Health check response
 */
export interface DbHealthResponse {
    status: string
    version: string
    uptime_seconds: number
}

/**
 * Raw SQL query request
 */
export interface DbQueryRequest {
    sql: string
    params?: (string | number | boolean | null)[]
}

/**
 * Raw SQL query response
 */
export interface DbQueryResponse {
    rows: JsonObject[]
    affected_rows: number
}

// ============================================================================
// Chat Types
// ============================================================================

export interface DbChat {
    id: string
    title: string
    model?: string
    backend?: string
    folder_id?: string
    project_id?: string
    is_pinned: boolean
    is_favorite: boolean
    is_archived: boolean
    metadata?: JsonObject
    created_at: number
    updated_at: number
}

export interface DbCreateChatRequest {
    id?: string
    title: string
    model?: string
    backend?: string
    folder_id?: string
    project_id?: string
    is_pinned?: boolean
    is_favorite?: boolean
    metadata?: JsonObject
}

export interface DbUpdateChatRequest {
    title?: string
    model?: string
    backend?: string
    folder_id?: string
    project_id?: string
    is_pinned?: boolean
    is_favorite?: boolean
    is_archived?: boolean
    metadata?: JsonObject
}

// ============================================================================
// Message Types
// ============================================================================

export interface DbMessage {
    id: string
    chat_id: string
    role: string
    content: string
    timestamp: number
    provider?: string
    model?: string
    metadata?: JsonObject
}

export interface DbCreateMessageRequest {
    id?: string
    chat_id: string
    role: string
    content: string
    timestamp?: number
    provider?: string
    model?: string
    metadata?: JsonObject
}

export interface DbUpdateMessageRequest {
    content?: string
    metadata?: JsonObject
}

// ============================================================================
// Project Types
// ============================================================================

export interface DbProject {
    id: string
    title: string
    description?: string
    path: string
    mounts: JsonValue[]
    chat_ids: string[]
    council_config?: JsonObject
    status: string
    metadata?: JsonObject
    created_at: number
    updated_at: number
}

export interface DbCreateProjectRequest {
    id?: string
    title: string
    description?: string
    path: string
    mounts?: JsonValue[]
    council_config?: JsonObject
    metadata?: JsonObject
}

export interface DbUpdateProjectRequest {
    title?: string
    description?: string
    path?: string
    mounts?: JsonValue[]
    chat_ids?: string[]
    council_config?: JsonObject
    status?: string
    metadata?: JsonObject
}

/** @alias DbProject */
export type DbWorkspace = DbProject
/** @alias DbCreateProjectRequest */
export type DbCreateWorkspaceRequest = DbCreateProjectRequest
/** @alias DbUpdateProjectRequest */
export type DbUpdateWorkspaceRequest = DbUpdateProjectRequest

// ============================================================================
// Folder Types
// ============================================================================

export interface DbFolder {
    id: string
    name: string
    color?: string
    created_at: number
    updated_at: number
}

export interface DbCreateFolderRequest {
    id?: string
    name: string
    color?: string
}

export interface DbUpdateFolderRequest {
    name?: string
    color?: string
}

// ============================================================================
// Prompt Types
// ============================================================================

export interface DbPrompt {
    id: string
    title: string
    content: string
    tags: string[]
    created_at: number
    updated_at: number
}

export interface DbCreatePromptRequest {
    id?: string
    title: string
    content: string
    tags?: string[]
}

export interface DbUpdatePromptRequest {
    title?: string
    content?: string
    tags?: string[]
}

// ============================================================================
// Knowledge Types (Vector Search)
// ============================================================================

export interface DbCodeSymbol {
    id: string
    project_path: string
    file_path: string
    name: string
    line: number
    kind: string
    signature?: string
    docstring?: string
    embedding?: number[]
    created_at: number
}

export interface DbStoreCodeSymbolRequest {
    id?: string
    project_path?: string
    workspace_path?: string
    file_path: string
    name: string
    line: number
    kind: string
    signature?: string
    docstring?: string
    embedding?: number[]
}

export interface DbVectorSearchRequest {
    embedding: number[]
    limit?: number
    project_path?: string
    workspace_path?: string
}

export interface DbSemanticFragment {
    id: string
    content: string
    embedding: number[]
    source: string
    source_id: string
    tags: string[]
    importance: number
    project_path?: string
    workspace_path?: string
    created_at: number
    updated_at: number
}

export interface DbStoreSemanticFragmentRequest {
    id?: string
    content: string
    embedding: number[]
    source: string
    source_id: string
    tags?: string[]
    importance?: number
    project_path?: string
    workspace_path?: string
}

// ============================================================================
// Marketplace Model Types
// ============================================================================

/**
 * Marketplace model from Ollama/HuggingFace
 */
export interface DbMarketplaceModel {
    id: string
    name: string
    provider: 'ollama' | 'huggingface'
    pulls?: string
    tagCount: number
    lastUpdated?: string
    categories: string[]
    shortDescription?: string
    downloads?: number
    likes?: number
    author?: string
    createdAt: number
    updatedAt: number
}

export interface DbUpsertMarketplaceModelsRequest {
    models: Omit<DbMarketplaceModel, 'createdAt' | 'updatedAt'>[]
}

export interface DbSearchMarketplaceModelsRequest {
    query: string
    provider?: 'ollama' | 'huggingface'
    limit?: number
}

export interface DbGetMarketplaceModelsRequest {
    provider?: 'ollama' | 'huggingface'
    limit?: number
    offset?: number
}

// ============================================================================
// Stats Types
// ============================================================================

export interface DbStats extends JsonObject {
    chatCount: number
    messageCount: number
    dbSize: number
}

export interface DbDetailedStats {
    chatCount: number
    messageCount: number
    dbSize: number
    totalTokens: number
    promptTokens: number
    completionTokens: number
    tokenTimeline: Array<{
        timestamp: number
        promptTokens: number
        completionTokens: number
        modelBreakdown?: Record<string, { prompt: number; completion: number }>
    }>
    activity: number[]
}

export interface DbTokenStats {
    totalSent: number
    totalReceived: number
    totalCost: number
    timeline: Array<{ timestamp: number; sent: number; received: number }>
    byProvider: Record<string, { sent: number; received: number; cost: number }>
    byModel: Record<string, { sent: number; received: number; cost: number }>
}

// ============================================================================
// API Client Interface
// ============================================================================

/**
 * Database service API client interface
 */
export interface DbServiceClient {
    // Health
    getHealth(): Promise<DbApiResponse<DbHealthResponse>>

    // Chats
    listChats(): Promise<DbApiResponse<DbChat[]>>
    getChat(id: string): Promise<DbApiResponse<DbChat | null>>
    createChat(req: DbCreateChatRequest): Promise<DbApiResponse<DbChat>>
    updateChat(id: string, req: DbUpdateChatRequest): Promise<DbApiResponse<boolean>>
    deleteChat(id: string): Promise<DbApiResponse<boolean>>

    // Messages
    getMessages(chatId: string): Promise<DbApiResponse<DbMessage[]>>
    addMessage(req: DbCreateMessageRequest): Promise<DbApiResponse<DbMessage>>
    updateMessage(id: string, req: DbUpdateMessageRequest): Promise<DbApiResponse<boolean>>
    deleteMessage(id: string): Promise<DbApiResponse<boolean>>

    // Projects
    listProjects(): Promise<DbApiResponse<DbProject[]>>
    getProject(id: string): Promise<DbApiResponse<DbProject | null>>
    createProject(req: DbCreateProjectRequest): Promise<DbApiResponse<DbProject>>
    updateProject(id: string, req: DbUpdateProjectRequest): Promise<DbApiResponse<boolean>>
    deleteProject(id: string): Promise<DbApiResponse<boolean>>

    // Folders
    listFolders(): Promise<DbApiResponse<DbFolder[]>>
    createFolder(req: DbCreateFolderRequest): Promise<DbApiResponse<DbFolder>>
    updateFolder(id: string, req: DbUpdateFolderRequest): Promise<DbApiResponse<boolean>>
    deleteFolder(id: string): Promise<DbApiResponse<boolean>>

    // Prompts
    listPrompts(): Promise<DbApiResponse<DbPrompt[]>>
    createPrompt(req: DbCreatePromptRequest): Promise<DbApiResponse<DbPrompt>>
    updatePrompt(id: string, req: DbUpdatePromptRequest): Promise<DbApiResponse<boolean>>
    deletePrompt(id: string): Promise<DbApiResponse<boolean>>

    // Knowledge
    storeCodeSymbol(req: DbStoreCodeSymbolRequest): Promise<DbApiResponse<void>>
    searchCodeSymbols(req: DbVectorSearchRequest): Promise<DbApiResponse<DbCodeSymbol[]>>
    storeSemanticFragment(req: DbStoreSemanticFragmentRequest): Promise<DbApiResponse<void>>
    searchSemanticFragments(req: DbVectorSearchRequest): Promise<DbApiResponse<DbSemanticFragment[]>>

    // Stats
    getStats(): Promise<DbApiResponse<DbStats>>

    // Raw queries
    executeQuery(req: DbQueryRequest): Promise<DbApiResponse<DbQueryResponse>>
}

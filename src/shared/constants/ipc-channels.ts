/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Centralized registry of all IPC channel names used in Tengra.
 *
 * This file serves as a single source of truth for every IPC channel.
 * Channels are grouped by domain and use `as const` for type safety.
 *
 * @module ipc-channels
 */

export const METRICS_CHANNELS = {
  GET: 'metrics:get',
  RECORD: 'metrics:record',
  GET_PROVIDER_STATS: 'metrics:get-provider-stats',
  GET_SUMMARY: 'metrics:get-summary',
  RESET: 'metrics:reset',
} as const;

// ---------------------------------------------------------------------------
// Window & Shell
// ---------------------------------------------------------------------------

/** Window management and shell operations */
export const WINDOW_CHANNELS = {
  CAPTURE_COOKIES: 'window:captureCookies',
  CLOSE: 'window:close',
  GET_ZOOM_FACTOR: 'window:get-zoom-factor',
  MAXIMIZE: 'window:maximize',
  MINIMIZE: 'window:minimize',
  OPEN_DETACHED_TERMINAL: 'window:openDetachedTerminal',
  RESET_ZOOM_FACTOR: 'window:reset-zoom-factor',
  RESIZE: 'window:resize',
  SET_ZOOM_FACTOR: 'window:set-zoom-factor',
  STEP_ZOOM_FACTOR: 'window:step-zoom-factor',
  TOGGLE_COMPACT: 'window:toggle-compact',
  TOGGLE_FULLSCREEN: 'window:toggle-fullscreen',
} as const;

/** Shell utility channels */
export const SHELL_CHANNELS = {
  OPEN_EXTERNAL: 'shell:openExternal',
  OPEN_TERMINAL: 'shell:openTerminal',
  RUN_COMMAND: 'shell:runCommand',
} as const;
 
/** Dialog utility channels */
export const DIALOG_CHANNELS = {
  SAVE_FILE: 'dialog:saveFile',
  SELECT_DIRECTORY: 'dialog:selectDirectory',
  SHOW_OPEN_DIALOG: 'dialog:showOpenDialog',
  SHOW_MESSAGE_BOX: 'dialog:showMessageBox',
} as const;

// ---------------------------------------------------------------------------
// App & Health
// ---------------------------------------------------------------------------

/** Application-level channels */
export const APP_CHANNELS = {
  GET_USER_DATA_PATH: 'app:getUserDataPath',
} as const;

/** Export channels */
export const EXPORT_CHANNELS = {
  CHAT: 'export:chat',
  CHAT_TO_HTML: 'export:chatToHTML',
  CHAT_TO_JSON: 'export:chatToJSON',
  CHAT_TO_MARKDOWN: 'export:chatToMarkdown',
  CHAT_TO_PDF: 'export:chatToPDF',
  CHAT_TO_TEXT: 'export:chatToText',
  GET_CONTENT: 'export:getContent',
  MARKDOWN: 'export:markdown',
  PDF: 'export:pdf',
} as const;

/** Update management channels */
export const UPDATE_CHANNELS = {
  CHECK: 'update:check',
  DOWNLOAD: 'update:download',
  INSTALL: 'update:install',
  STATUS: 'update:status',
} as const;

/** Security channels */
export const SECURITY_CHANNELS = {
  RESET_MASTER_KEY: 'security:reset-master-key',
} as const;

/** Runtime and bootstrap channels */
export const RUNTIME_CHANNELS = {
  GET_STATUS: 'runtime:get-status',
  REFRESH_STATUS: 'runtime:refresh-status',
  REPAIR: 'runtime:repair',
  RUN_COMPONENT_ACTION: 'runtime:run-component-action',
} as const;

/** Clipboard operations channels */
export const CLIPBOARD_CHANNELS = {
  READ_TEXT: 'clipboard:read-text',
  WRITE_TEXT: 'clipboard:write-text',
} as const;

/** IPC Contract channels */
export const CONTRACT_CHANNELS = {
  GET: 'ipc:contract:get',
} as const;

/** Health-check channels */
export const HEALTH_CHANNELS = {
  CHECK: 'health:check',
  GET_SERVICE: 'health:getService',
  LIST_SERVICES: 'health:listServices',
  MEMORY_CONTEXT: 'health:memoryContext',
  STATUS: 'health:status',
} as const;

// ---------------------------------------------------------------------------
// Auth & Security
// ---------------------------------------------------------------------------

/** Authentication and session channels */
export const AUTH_CHANNELS = {
  CREATE_ACCOUNT: 'auth:create-account',
  CREATE_MASTER_KEY_BACKUP: 'auth:create-master-key-backup',
  DETECT_PROVIDER: 'auth:detect-provider',
  END_SESSION: 'auth:end-session',
  EXPORT_CREDENTIALS: 'auth:export-credentials',
  GET_ACCOUNTS_BY_PROVIDER: 'auth:get-accounts-by-provider',
  GET_ACTIVE_LINKED_ACCOUNT: 'auth:get-active-linked-account',
  GET_LINKED_ACCOUNTS: 'auth:get-linked-accounts',
  GET_PROVIDER_ANALYTICS: 'auth:get-provider-analytics',
  GET_PROVIDER_HEALTH: 'auth:get-provider-health',
  GET_SESSION_ANALYTICS: 'auth:get-session-analytics',
  GET_SESSION_TIMEOUT: 'auth:get-session-timeout',
  GET_TOKEN_ANALYTICS: 'auth:get-token-analytics',
  COPILOT_LOGIN: 'auth:copilot-login',
  IMPORT_CREDENTIALS: 'auth:import-credentials',
  HAS_LINKED_ACCOUNT: 'auth:has-linked-account',
  LINK_ACCOUNT: 'auth:link-account',
  POLL_TOKEN: 'auth:poll-token',
  RESTORE_MASTER_KEY_BACKUP: 'auth:restore-master-key-backup',
  REVOKE_ACCOUNT_TOKEN: 'auth:revoke-account-token',
  ROTATE_TOKEN_ENCRYPTION: 'auth:rotate-token-encryption',
  SET_ACTIVE_LINKED_ACCOUNT: 'auth:set-active-linked-account',
  SET_SESSION_LIMIT: 'auth:set-session-limit',
  SET_SESSION_TIMEOUT: 'auth:set-session-timeout',
  START_SESSION: 'auth:start-session',
  SWITCH_ACCOUNT: 'auth:switch-account',
  TOUCH_SESSION: 'auth:touch-session',
  UNLINK_ACCOUNT: 'auth:unlink-account',
  UNLINK_PROVIDER: 'auth:unlink-provider',
  ACCOUNT_CHANGED_EVENT: 'auth:account-changed',
} as const;

/** Auth session channels */
export const AUTH_SESSION_CHANNELS = {
  ANALYTICS: 'auth:session:analytics',
  END: 'auth:session:end',
  GET_TIMEOUT: 'auth:session:get-timeout',
  SET_LIMIT: 'auth:session:set-limit',
  SET_TIMEOUT: 'auth:session:set-timeout',
  START: 'auth:session:start',
  TOUCH: 'auth:session:touch',
} as const;

/** Key rotation channels */
export const KEY_ROTATION_CHANNELS = {
  GET_CURRENT_KEY: 'key-rotation:getCurrentKey',
  GET_STATUS: 'key-rotation:getStatus',
  INITIALIZE: 'key-rotation:initialize',
  ROTATE: 'key-rotation:rotate',
} as const;

/** Audit log channels */
export const AUDIT_CHANNELS = {
  CLEAR_LOGS: 'audit:clearLogs',
  GET_LOGS: 'audit:get-logs',
} as const;

// ---------------------------------------------------------------------------
// Chat & LLM
// ---------------------------------------------------------------------------

/** Session channels */
export const SESSION_CHANNELS = {
  GET_STATE: 'session:get-state',
  LIST: 'session:list',
  LIST_CAPABILITIES: 'session:list-capabilities',
  HEALTH: 'session:health',
  EVENT: 'session:event',
} as const;

/** Session conversation channels */
export const SESSION_CONVERSATION_CHANNELS = {
  COMPLETE: 'session:conversation:complete',
  STREAM: 'session:conversation:stream',
  STREAM_CHUNK: 'session:conversation:stream-chunk',
  STREAM_CHUNK_BINARY: 'session:conversation:stream-chunk-binary',
  CANCEL: 'session:conversation:cancel',
  RETRY_WITH_MODEL: 'session:conversation:retry-with-model',
} as const;

/** Session automation channels */
export const SESSION_AUTOMATION_CHANNELS = {
  START: 'session:automation:start',
  PLAN: 'session:automation:plan',
  APPROVE_PLAN: 'session:automation:approve-plan',
  STOP: 'session:automation:stop',
  PAUSE_TASK: 'session:automation:pause-task',
  RESUME_TASK: 'session:automation:resume-task',
  SAVE_SNAPSHOT: 'session:automation:save-snapshot',
  APPROVE_CURRENT_PLAN: 'session:automation:approve-current-plan',
  REJECT_CURRENT_PLAN: 'session:automation:reject-current-plan',
  RESET_STATE: 'session:automation:reset-state',
  GET_STATUS: 'session:automation:get-status',
  GET_TASK_MESSAGES: 'session:automation:get-task-messages',
  GET_TASK_EVENTS: 'session:automation:get-task-events',
  GET_TASK_STATS: 'session:automation:get-task-stats',
  GET_TASK_HISTORY: 'session:automation:get-task-history',
  DELETE_TASK: 'session:automation:delete-task',
  GET_AVAILABLE_MODELS: 'session:automation:get-available-models',
  RETRY_STEP: 'session:automation:retry-step',
  SELECT_MODEL: 'session:automation:select-model',
  APPROVE_STEP: 'session:automation:approve-step',
  SKIP_STEP: 'session:automation:skip-step',
  EDIT_STEP: 'session:automation:edit-step',
  ADD_STEP_COMMENT: 'session:automation:add-step-comment',
  INSERT_INTERVENTION_POINT: 'session:automation:insert-intervention-point',
  GET_CHECKPOINTS: 'session:automation:get-checkpoints',
  RESUME_CHECKPOINT: 'session:automation:resume-checkpoint',
  ROLLBACK_CHECKPOINT: 'session:automation:rollback-checkpoint',
  GET_PLAN_VERSIONS: 'session:automation:get-plan-versions',
  DELETE_TASK_BY_NODE_ID: 'session:automation:delete-task-by-node-id',
  CREATE_PULL_REQUEST: 'session:automation:create-pull-request',
  GET_PROFILES: 'session:automation:get-profiles',
  GET_ROUTING_RULES: 'session:automation:get-routing-rules',
  SET_ROUTING_RULES: 'session:automation:set-routing-rules',
  GET_TEMPLATES: 'session:automation:get-templates',
  GET_TEMPLATE: 'session:automation:get-template',
  SAVE_TEMPLATE: 'session:automation:save-template',
  DELETE_TEMPLATE: 'session:automation:delete-template',
  EXPORT_TEMPLATE: 'session:automation:export-template',
  IMPORT_TEMPLATE: 'session:automation:import-template',
  APPLY_TEMPLATE: 'session:automation:apply-template',
} as const;

/** Session workspace channels */
export const SESSION_WORKSPACE_CHANNELS = {
  SAVE_CANVAS_NODES: 'session:workspace:save-canvas-nodes',
  GET_CANVAS_NODES: 'session:workspace:get-canvas-nodes',
  DELETE_CANVAS_NODE: 'session:workspace:delete-canvas-node',
  SAVE_CANVAS_EDGES: 'session:workspace:save-canvas-edges',
  GET_CANVAS_EDGES: 'session:workspace:get-canvas-edges',
  DELETE_CANVAS_EDGE: 'session:workspace:delete-canvas-edge',
} as const;

/** Workspace-scoped agent session channels */
export const WORKSPACE_AGENT_SESSION_CHANNELS = {
  LIST_BY_WORKSPACE: 'workspace-agent-session:list-by-workspace',
  CREATE: 'workspace-agent-session:create',
  RENAME: 'workspace-agent-session:rename',
  SELECT: 'workspace-agent-session:select',
  UPDATE_PERSISTENCE: 'workspace-agent-session:update-persistence',
  UPDATE_MODES: 'workspace-agent-session:update-modes',
  UPDATE_PERMISSIONS: 'workspace-agent-session:update-permissions',
  UPDATE_STRATEGY: 'workspace-agent-session:update-strategy',
  GET_CONTEXT_STATS: 'workspace-agent-session:get-context-stats',
  ARCHIVE: 'workspace-agent-session:archive',
  DELETE: 'workspace-agent-session:delete',
  RESUME_BACKGROUND_STATE: 'workspace-agent-session:resume-background-state',
} as const;

/** Session council channels */
export const SESSION_COUNCIL_CHANNELS = {
  GENERATE_PLAN: 'session:council:generate-plan',
  GET_PROPOSAL: 'session:council:get-proposal',
  APPROVE_PROPOSAL: 'session:council:approve-proposal',
  REJECT_PROPOSAL: 'session:council:reject-proposal',
  START_EXECUTION: 'session:council:start-execution',
  PAUSE_EXECUTION: 'session:council:pause-execution',
  RESUME_EXECUTION: 'session:council:resume-execution',
  GET_TIMELINE: 'session:council:get-timeline',
  CREATE_VOTING_SESSION: 'session:council:create-voting-session',
  SUBMIT_VOTE: 'session:council:submit-vote',
  REQUEST_VOTES: 'session:council:request-votes',
  RESOLVE_VOTING: 'session:council:resolve-voting',
  GET_VOTING_SESSION: 'session:council:get-voting-session',
  LIST_VOTING_SESSIONS: 'session:council:list-voting-sessions',
  GET_VOTING_ANALYTICS: 'session:council:get-voting-analytics',
  GET_VOTING_CONFIGURATION: 'session:council:get-voting-configuration',
  UPDATE_VOTING_CONFIGURATION: 'session:council:update-voting-configuration',
  LIST_VOTING_TEMPLATES: 'session:council:list-voting-templates',
  BUILD_CONSENSUS: 'session:council:build-consensus',
  OVERRIDE_VOTING_DECISION: 'session:council:override-voting-decision',
  CREATE_DEBATE_SESSION: 'session:council:create-debate-session',
  SUBMIT_DEBATE_ARGUMENT: 'session:council:submit-debate-argument',
  RESOLVE_DEBATE_SESSION: 'session:council:resolve-debate-session',
  OVERRIDE_DEBATE_SESSION: 'session:council:override-debate-session',
  GET_DEBATE_SESSION: 'session:council:get-debate-session',
  LIST_DEBATE_HISTORY: 'session:council:list-debate-history',
  GET_DEBATE_REPLAY: 'session:council:get-debate-replay',
  GENERATE_DEBATE_SUMMARY: 'session:council:generate-debate-summary',
  SEND_MESSAGE: 'session:council:send-message',
  GET_MESSAGES: 'session:council:get-messages',
  CLEANUP_EXPIRED_MESSAGES: 'session:council:cleanup-expired-messages',
  HANDLE_QUOTA_INTERRUPT: 'session:council:handle-quota-interrupt',
  QUOTA_INTERRUPT_EVENT: 'session:council:quota-interrupt:event',
  REGISTER_WORKER_AVAILABILITY: 'session:council:register-worker-availability',
  LIST_AVAILABLE_WORKERS: 'session:council:list-available-workers',
  SCORE_HELPER_CANDIDATES: 'session:council:score-helper-candidates',
  GENERATE_HELPER_HANDOFF: 'session:council:generate-helper-handoff',
  REVIEW_HELPER_MERGE: 'session:council:review-helper-merge',
  GET_TEAMWORK_ANALYTICS: 'session:council:get-teamwork-analytics',
} as const;

/** Ollama local LLM channels */
export const OLLAMA_CHANNELS = {
  ABORT: 'ollama:abort',
  ABORT_PULL: 'ollama:abortPull',
  CHAT: 'ollama:chat',
  CHAT_OPENAI: 'ollama:chat-openai',
  CHAT_STREAM: 'ollama:chatStream',
  CHECK_ALL_MODELS_HEALTH: 'ollama:checkAllModelsHealth',
  CHECK_CUDA: 'ollama:checkCuda',
  DELETE_MODEL: 'ollama:deleteModel',
  CHECK_MODEL_HEALTH: 'ollama:checkModelHealth',
  FORCE_HEALTH_CHECK: 'ollama:forceHealthCheck',
  GET_CONNECTION_STATUS: 'ollama:getConnectionStatus',
  GET_GPU_ALERT_THRESHOLDS: 'ollama:getGPUAlertThresholds',
  GET_GPU_INFO: 'ollama:getGPUInfo',
  GET_LIBRARY_MODELS: 'ollama:getLibraryModels',
  GET_MODEL_RECOMMENDATIONS: 'ollama:getModelRecommendations',
  GET_MODELS: 'ollama:getModels',
  GET_OLLAMA_ACCOUNTS: 'ollama:get-ollama-accounts',
  GET_RECOMMENDED_MODEL_FOR_TASK: 'ollama:getRecommendedModelForTask',
  HEALTH_STATUS: 'ollama:healthStatus',
  GPU_ALERT: 'ollama:gpu-alert',
  GPU_STATUS: 'ollama:gpu-status',
  INITIATE_CONNECT: 'ollama:initiate-connect',
  IS_RUNNING: 'ollama:isRunning',
  PULL: 'ollama:pull',
  PULL_PROGRESS: 'ollama:pull-progress',
  RECONNECT: 'ollama:reconnect',
  POLL_CONNECT_STATUS: 'ollama:poll-connect-status',
  SET_GPU_ALERT_THRESHOLDS: 'ollama:setGPUAlertThresholds',
  START: 'ollama:start',
  START_GPU_MONITORING: 'ollama:startGPUMonitoring',
  STATUS_CHANGE: 'ollama:status-change',
  STOP_GPU_MONITORING: 'ollama:stopGPUMonitoring',
  TAGS: 'ollama:tags',
  TEST_CONNECTION: 'ollama:testConnection',
  STREAM_CHUNK: 'ollama:stream-chunk',
} as const;

/** Llama local model channels */
export const LLAMA_CHANNELS = {
  ABORT_CHAT: 'llama:chat:abort',
  CHAT: 'llama:chat',
  CHAT_OPENAI: 'llama:chat-openai',
  CHAT_STREAM: 'llama:chat:stream',
  CHAT_STREAM_CHUNK: 'llama:chat:stream:chunk',
  ABORT_DOWNLOAD: 'llama:abortDownload',
  DELETE_MODEL: 'llama:deleteModel',
  DOWNLOAD_MODEL: 'llama:downloadModel',
  GET_CONFIG: 'llama:getConfig',
  GET_METADATA: 'llama:get-metadata',
  GET_MODELS: 'llama:getModels',
  GET_MODELS_DIR: 'llama:getModelsDir',
  GET_GPU_INFO: 'llama:getGpuInfo',
  IS_INSTALLED: 'llama:is-installed',
  IS_SERVER_RUNNING: 'llama:isServerRunning',
  LOAD_MODEL: 'llama:loadModel',
  RESET_SESSION: 'llama:resetSession',
  SET_CONFIG: 'llama:setConfig',
  SET_MODELS_DIR: 'llama:setModelsDir',
  START: 'llama:start',
  STATUS: 'llama:status',
  STOP: 'llama:stop',
  UNLOAD_MODEL: 'llama:unloadModel',
  VALIDATE_MODEL: 'llama:validate-model',
} as const;

/** LLM comparison channels */
export const LLM_CHANNELS = {
  CLEAR_COMPARISON_HISTORY: 'llm:clear-comparison-history',
  COMPARE_MODELS: 'llm:compare-models',
  GET_COMPARISON_HISTORY: 'llm:get-comparison-history',
} as const;

/** Embedding channels */
export const EMBEDDING_CHANNELS = {
  GENERATE: 'embedding:generate',
  GET_ANALYTICS: 'embedding:get-analytics',
  GET_HEALTH: 'embedding:get-health',
} as const;

/** Model registry channels */
export const MODEL_REGISTRY_CHANNELS = {
  GET_ALL_MODELS: 'model-registry:getAllModels',
  GET_INSTALLED_MODELS: 'model-registry:get-installed',
  GET_REMOTE_MODELS: 'model-registry:get-remote',
} as const;

/** Model downloader channels */
export const MODEL_DOWNLOADER_CHANNELS = {
  CANCEL: 'model-downloader:cancel',
  HISTORY: 'model-downloader:history',
  PAUSE: 'model-downloader:pause',
  RESUME: 'model-downloader:resume',
  RETRY: 'model-downloader:retry',
  START: 'model-downloader:start',
} as const;

/** Context window management channels */
export const CONTEXT_WINDOW_CHANNELS = {
  GET_INFO: 'context-window:getInfo',
  GET_RECOMMENDED_SETTINGS: 'context-window:getRecommendedSettings',
  NEEDS_TRUNCATION: 'context-window:needsTruncation',
  TRUNCATE: 'context-window:truncate',
} as const;

/** Token estimation channels */
export const TOKEN_ESTIMATION_CHANNELS = {
  ESTIMATE_MESSAGE: 'token-estimation:estimateMessage',
  ESTIMATE_MESSAGES: 'token-estimation:estimateMessages',
  ESTIMATE_STRING: 'token-estimation:estimateString',
  FITS_IN_CONTEXT_WINDOW: 'token-estimation:fitsInContextWindow',
  GET_CONTEXT_WINDOW_SIZE: 'token-estimation:getContextWindowSize',
} as const;

/** Collaboration / multi-model channels */
export const COLLABORATION_CHANNELS = {
  GET_ACTIVE_TASK_COUNT: 'collaboration:getActiveTaskCount',
  GET_PROVIDER_STATS: 'collaboration:getProviderStats',
  RUN: 'collaboration:run',
  SET_PROVIDER_CONFIG: 'collaboration:setProviderConfig',
  SYNC_JOIN: 'collaboration:sync:join',
  SYNC_LEAVE: 'collaboration:sync:leave',
  SYNC_SEND: 'collaboration:sync:send',
} as const;

/** Collaboration sync event channels */
export const COLLABORATION_SYNC_CHANNELS = {
  ERROR: 'collaboration:sync:error',
  JOINED: 'collaboration:sync:joined',
  LEFT: 'collaboration:sync:left',
  UPDATE: 'collaboration:sync:update',
} as const;

/** Live collaboration channels */
export const LIVE_COLLABORATION_CHANNELS = {
  JOIN_ROOM: 'live-collaboration:join-room',
  SEND_UPDATE: 'live-collaboration:send-update',
  SYNC_UPDATE: 'live-collaboration:sync-update',
} as const;

// ---------------------------------------------------------------------------
// Memory & IconBrain
// ---------------------------------------------------------------------------

/** Advanced memory system channels */
export const ADVANCED_MEMORY_CHANNELS = {
  ARCHIVE: 'advancedMemory:archive',
  ARCHIVE_MANY: 'advancedMemory:archiveMany',
  CONFIRM: 'advancedMemory:confirm',
  CONFIRM_ALL: 'advancedMemory:confirmAll',
  CREATE_SHARED_NAMESPACE: 'advancedMemory:createSharedNamespace',
  DELETE: 'advancedMemory:delete',
  DELETE_MANY: 'advancedMemory:deleteMany',
  EDIT: 'advancedMemory:edit',
  EXPORT: 'advancedMemory:export',
  EXTRACT_FROM_MESSAGE: 'advancedMemory:extractFromMessage',
  EXTRACT_AND_STAGE: 'advancedMemory:extractAndStage',
  GET: 'advancedMemory:get',
  GET_ALL: 'advancedMemory:getAllAdvancedMemories',
  GET_ALL_ENTITY_KNOWLEDGE: 'advancedMemory:getAllEntityKnowledge',
  GET_ALL_EPISODES: 'advancedMemory:getAllEpisodes',
  GET_HISTORY: 'advancedMemory:getHistory',
  GET_PENDING: 'advancedMemory:getPending',
  GET_SEARCH_ANALYTICS: 'advancedMemory:getSearchAnalytics',
  GET_SEARCH_HISTORY: 'advancedMemory:getSearchHistory',
  GET_SEARCH_SUGGESTIONS: 'advancedMemory:getSearchSuggestions',
  GET_SHARED_NAMESPACE_ANALYTICS: 'advancedMemory:getSharedNamespaceAnalytics',
  GET_STATS: 'advancedMemory:getStats',
  HEALTH: 'advancedMemory:health',
  IMPORT: 'advancedMemory:import',
  RECALL: 'advancedMemory:recall',
  RECATEGORIZE: 'advancedMemory:recategorize',
  REJECT: 'advancedMemory:reject',
  REJECT_ALL: 'advancedMemory:rejectAll',
  REMEMBER: 'advancedMemory:remember',
  RESTORE: 'advancedMemory:restore',
  ROLLBACK: 'advancedMemory:rollback',
  RUN_DECAY: 'advancedMemory:runDecay',
  SEARCH: 'advancedMemory:search',
  SEARCH_ACROSS_WORKSPACES: 'advancedMemory:searchAcrossWorkspaces',
  SEARCH_RESOLUTIONS: 'advancedMemory:searchResolutions',
  SHARE_WITH_WORKSPACE: 'advancedMemory:shareWithWorkspace',
  SYNC_SHARED_NAMESPACE: 'advancedMemory:syncSharedNamespace',
  SUMMARIZE_CHAT: 'advancedMemory:summarizeChat',
} as const;

/** Memory channels */
export const MEMORY_CHANNELS = {
  ADD_FACT: 'memory:addFact',
  DELETE_ENTITY: 'memory:deleteEntity',
  DELETE_FACT: 'memory:deleteFact',
  GET_ALL: 'memory:getAll',
  SEARCH: 'memory:search',
  SET_ENTITY_FACT: 'memory:setEntityFact',
} as const;

/** IconBrain (lightweight memory) channels */
export const BRAIN_CHANNELS = {
  EXTRACT_FROM_MESSAGE: 'brain:extract-from-message',
  FORGET: 'brain:forget',
  GET_BY_CATEGORY: 'brain:get-by-category',
  GET_CONTEXT: 'brain:get-context',
  GET_STATS: 'brain:get-stats',
  LEARN: 'brain:learn',
  RECALL: 'brain:recall',
  UPDATE_CONFIDENCE: 'brain:update-confidence',
} as const;

// ---------------------------------------------------------------------------
// Database & Data
// ---------------------------------------------------------------------------

/** Database / persistence channels */
export const DB_CHANNELS = {
  ARCHIVE_CHAT: 'db:archiveChat',
  ARCHIVE_WORKSPACE: 'db:archiveWorkspace',
  ADD_MESSAGE: 'db:addMessage',
  ADD_TOKEN_USAGE: 'db:addTokenUsage',
  BULK_ARCHIVE_CHATS: 'db:bulkArchiveChats',
  BULK_ARCHIVE_WORKSPACES: 'db:bulkArchiveWorkspaces',
  BULK_DELETE_CHATS: 'db:bulkDeleteChats',
  BULK_DELETE_WORKSPACES: 'db:bulkDeleteWorkspaces',
  CHAT_GET: 'db:getChat',
  CHAT_LIST: 'db:listChats',
  CHAT_UPDATE: 'db:updateChat',
  CHAT_DELETE: 'db:deleteChat',
  CLEAR_HISTORY: 'db:clearHistory',
  CREATE_CHAT: 'db:createChat',
  CREATE_FOLDER: 'db:createFolder',
  CREATE_PROMPT: 'db:createPrompt',
  CREATE_WORKSPACE: 'db:createWorkspace',
  DELETE_ALL_CHATS: 'db:deleteAllChats',
  DELETE_CHATS_BY_TITLE: 'db:deleteChatsByTitle',
  DELETE_FOLDER: 'db:deleteFolder',
  DELETE_MESSAGE: 'db:deleteMessage',
  DELETE_MESSAGES: 'db:deleteMessages',
  DELETE_PROMPT: 'db:deletePrompt',
  DELETE_WORKSPACE: 'db:deleteWorkspace',
  DUPLICATE_CHAT: 'db:duplicateChat',
  FAVORITE_CHAT: 'db:favoriteChat',
  GET_ALL_CHATS: 'db:getAllChats',
  GET_DETAILED_STATS: 'db:getDetailedStats',
  GET_FOLDERS: 'db:getFolders',
  GET_MESSAGES: 'db:getMessages',
  GET_PROMPTS: 'db:getPrompts',
  GET_PROVIDER_STATS: 'db:getProviderStats',
  GET_STATS: 'db:getStats',
  GET_TOKEN_STATS: 'db:getTokenStats',
  GET_USAGE_STATS: 'db:getUsageStats',
  GET_WORKSPACE_BY_ID: 'db:getWorkspaceById',
  GET_WORKSPACES: 'db:getWorkspaces',
  MOVE_CHAT_TO_FOLDER: 'db:moveChatToFolder',
  PIN_CHAT: 'db:pinChat',
  RECORD_USAGE: 'db:recordUsage',
  SEARCH_CHATS: 'db:searchChats',
  SEARCH_SIMILAR_MESSAGES: 'db:searchSimilarMessages',
  UPDATE_CHAT_TITLE: 'db:updateChatTitle',
  UPDATE_FOLDER: 'db:updateFolder',
  UPDATE_MESSAGE: 'db:updateMessage',
  UPDATE_MESSAGE_VECTOR: 'db:updateMessageVector',
  UPDATE_PROMPT: 'db:updatePrompt',
  UPDATE_WORKSPACE: 'db:updateWorkspace',
  WORKSPACE_UPDATED_EVENT: 'db:workspace-updated',
} as const;

/** Backup channels */
export const BACKUP_CHANNELS = {
  CLEANUP: 'backup:cleanup',
  CONFIGURE_AUTO_BACKUP: 'backup:configureAutoBackup',
  CREATE: 'backup:create',
  CREATE_DISASTER_RECOVERY_BUNDLE: 'backup:createDisasterRecoveryBundle',
  DELETE: 'backup:delete',
  GET_AUTO_BACKUP_STATUS: 'backup:getAutoBackupStatus',
  GET_DIR: 'backup:getDir',
  LIST: 'backup:list',
  RESTORE: 'backup:restore',
  RESTORE_DISASTER_RECOVERY_BUNDLE: 'backup:restoreDisasterRecoveryBundle',
  SYNC_TO_CLOUD_DIR: 'backup:syncToCloudDir',
  VERIFY: 'backup:verify',
} as const;

/** Migration channels */
export const MIGRATION_CHANNELS = {
  HISTORY: 'migration:history',
  STATUS: 'migration:status',
} as const;

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

/** Filesystem channels */
export const FILES_CHANNELS = {
  COPY_PATH: 'files:copyPath',
  CREATE_DIRECTORY: 'files:createDirectory',
  DELETE_DIRECTORY: 'files:deleteDirectory',
  DELETE_FILE: 'files:deleteFile',
  EXISTS: 'files:exists',
  GET_FILE_DIFF: 'files:getFileDiff',
  HEALTH: 'files:health',
  LIST_DIRECTORY: 'files:listDirectory',
  READ_FILE: 'files:readFile',
  READ_IMAGE: 'files:readImage',
  READ_PDF: 'files:readPdf',
  RENAME_PATH: 'files:renamePath',
  REVERT_FILE_CHANGE: 'files:revertFileChange',
  SEARCH_FILES: 'files:searchFiles',
  SEARCH_FILES_STREAM: 'files:searchFilesStream',
  SELECT_DIRECTORY: 'files:selectDirectory',
  SELECT_FILE: 'files:selectFile',
  WRITE_FILE: 'files:writeFile',
  EXPORT_CHAT_TO_PDF: 'files:exportChatToPdf',
  SAVE_FILE: 'files:saveFile',
} as const;

// ---------------------------------------------------------------------------
// Git
// ---------------------------------------------------------------------------

/** Git operations channels */
export const GIT_CHANNELS = {
  ABORT_REBASE: 'git:abortRebase',
  ADD: 'git:add',
  ADD_SUBMODULE: 'git:addSubmodule',
  APPLY_STASH: 'git:applyStash',
  CANCEL_OPERATION: 'git:cancelOperation',
  CHECKOUT: 'git:checkout',
  COMMIT: 'git:commit',
  COMPARE_REFS: 'git:compareRefs',
  CONTINUE_REBASE: 'git:continueRebase',
  CREATE_BRANCH: 'git:createBranch',
  CREATE_STASH: 'git:createStash',
  DELETE_BRANCH: 'git:deleteBranch',
  DROP_STASH: 'git:dropStash',
  EXECUTE_RAW: 'git:executeRaw',
  EXPORT_HOOKS: 'git:exportHooks',
  EXPORT_REPOSITORY_STATS: 'git:exportRepositoryStats',
  EXPORT_STASH: 'git:exportStash',
  FINISH_FLOW_BRANCH: 'git:finishFlowBranch',
  GENERATE_PR_SUMMARY: 'git:generatePrSummary',
  GET_BLAME: 'git:getBlame',
  GET_BRANCH: 'git:getBranch',
  GET_BRANCHES: 'git:getBranches',
  GET_COMMIT_DETAILS: 'git:getCommitDetails',
  GET_COMMIT_DIFF: 'git:getCommitDiff',
  GET_COMMIT_STATS: 'git:getCommitStats',
  GET_CONFLICTS: 'git:getConflicts',
  GET_DETAILED_STATUS: 'git:getDetailedStatus',
  GET_DIFF_STATS: 'git:getDiffStats',
  GET_FILE_DIFF: 'git:getFileDiff',
  GET_FILE_HISTORY: 'git:getFileHistory',
  GET_FLOW_STATUS: 'git:getFlowStatus',
  GET_HOOKS: 'git:getHooks',
  GET_HOTSPOTS: 'git:getHotspots',
  GET_LAST_COMMIT: 'git:getLastCommit',
  GET_GITHUB_DATA: 'git:getGitHubData',
  GET_GITHUB_PR_DETAILS: 'git:getGitHubPrDetails',
  UPDATE_GITHUB_PR_STATE: 'git:updateGitHubPrState',
  MERGE_GITHUB_PR: 'git:mergeGitHubPr',
  APPROVE_GITHUB_PR: 'git:approveGitHubPr',
  GET_REBASE_PLAN: 'git:getRebasePlan',
  GET_REBASE_STATUS: 'git:getRebaseStatus',
  GET_RECENT_COMMITS: 'git:getRecentCommits',
  GET_REMOTES: 'git:getRemotes',
  GET_REPOSITORY_STATS: 'git:getRepositoryStats',
  GET_STAGED_DIFF: 'git:getStagedDiff',
  GET_STASHES: 'git:getStashes',
  GET_STATUS: 'git:getStatus',
  GET_SUBMODULES: 'git:getSubmodules',
  GET_TRACKING_INFO: 'git:getTrackingInfo',
  GET_TREE_STATUS: 'git:getTreeStatus',
  GET_TREE_STATUS_PREVIEW: 'git:getTreeStatusPreview',
  GET_UNIFIED_DIFF: 'git:getUnifiedDiff',
  INIT_SUBMODULES: 'git:initSubmodules',
  INSTALL_HOOK: 'git:installHook',
  IS_REPOSITORY: 'git:isRepository',
  OPEN_MERGE_TOOL: 'git:openMergeTool',
  PULL: 'git:pull',
  PUSH: 'git:push',
  REMOVE_SUBMODULE: 'git:removeSubmodule',
  RENAME_BRANCH: 'git:renameBranch',
  RESOLVE_CONFLICT: 'git:resolveConflict',
  RUN_CONTROLLED_OPERATION: 'git:runControlledOperation',
  SET_UPSTREAM: 'git:setUpstream',
  STAGE_FILE: 'git:stageFile',
  START_FLOW_BRANCH: 'git:startFlowBranch',
  START_REBASE: 'git:startRebase',
  STAGE_ALL: 'git:stageAll',
  SYNC_SUBMODULES: 'git:syncSubmodules',
  TEST_HOOK: 'git:testHook',
  UNSTAGE_ALL: 'git:unstageAll',
  UNSTAGE_FILE: 'git:unstageFile',
  UPDATE_SUBMODULES: 'git:updateSubmodules',
  VALIDATE_HOOK: 'git:validateHook',
} as const;

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

/** Agent management channels */
export const AGENT_CHANNELS = {
  CLONE: 'agent:clone',
  CREATE: 'agent:create',
  DELETE: 'agent:delete',
  EXPORT: 'agent:export',
  GET: 'agent:get',
  GET_ALL: 'agent:get-all',
  GET_TEMPLATES: 'agent:get-templates',
  GET_TEMPLATES_LIBRARY: 'agent:get-templates-library',
  IMPORT: 'agent:import',
  RECOVER: 'agent:recover',
  VALIDATE_TEMPLATE: 'agent:validate-template',
} as const;

/** Marketplace channels */
export const MARKETPLACE_CHANNELS = {
  CHECK_LIVE_UPDATES: 'marketplace:check-live-updates',
  FETCH: 'marketplace:fetch',
  FETCH_README: 'marketplace:fetch-readme',
  GET_RUNTIME_PROFILE: 'marketplace:getRuntimeProfile',
  GET_UPDATE_COUNT: 'marketplace:get-update-count',
  INSTALL: 'marketplace:install',
  UNINSTALL: 'marketplace:uninstall',
} as const;
 
/** Extension management channels */
export const EXTENSION_CHANNELS = {
  ACTIVATE: 'extension:activate',
  DEACTIVATE: 'extension:deactivate',
  DEV_RELOAD: 'extension:dev-reload',
  DEV_START: 'extension:dev-start',
  DEV_STOP: 'extension:dev-stop',
  DISMISS_WARNING: 'extension:dismissWarning',
  GET: 'extension:get',
  GET_ALL: 'extension:get-all',
  GET_CONFIG: 'extension:get-config',
  GET_PROFILE: 'extension:get-profile',
  GET_STATE: 'extension:get-state',
  GET_STATUS: 'extension:getStatus',
  INSTALL: 'extension:install',
  PUBLISH: 'extension:publish',
  SET_INSTALLED: 'extension:setInstalled',
  SHOULD_SHOW_WARNING: 'extension:shouldShowWarning',
  TEST: 'extension:test',
  UNINSTALL: 'extension:uninstall',
  UPDATE_CONFIG: 'extension:update-config',
  VALIDATE: 'extension:validate',
  LOG_UPDATE: 'extension:log-update',
} as const;

// ---------------------------------------------------------------------------
// Settings & Theme
// ---------------------------------------------------------------------------

/** Settings channels */
export const SETTINGS_CHANNELS = {
  GET: 'settings:get',
  HEALTH: 'settings:health',
  SAVE: 'settings:save',
} as const;
 
/** Code language management channels */
export const CODE_LANGUAGE_CHANNELS = {
  RUNTIME_GET_ALL: 'code-language:runtime:getAll',
  RUNTIME_UPDATED: 'code-language:runtime:updated',
} as const;
 
/** Locale management channels */
export const LOCALE_CHANNELS = {
  RUNTIME_GET_ALL: 'locale:runtime:getAll',
  RUNTIME_UPDATED: 'locale:runtime:updated',
} as const;
 
/** Power management channels */
export const POWER_CHANNELS = {
  STATE_CHANGED: 'power:state-changed',
} as const;

/** Theme channels */
export const THEME_CHANNELS = {
  ADD_CUSTOM: 'theme:addCustom',
  APPLY_PRESET: 'theme:applyPreset',
  CLEAR_HISTORY: 'theme:clearHistory',
  CLEAR_PRESET: 'theme:clearPreset',
  DELETE_CUSTOM: 'theme:deleteCustom',
  DUPLICATE: 'theme:duplicate',
  EXPORT: 'theme:export',
  GET_ALL: 'theme:getAll',
  GET_CURRENT: 'theme:getCurrent',
  GET_CURRENT_PRESET: 'theme:getCurrentPreset',
  GET_CUSTOM: 'theme:getCustom',
  GET_DETAILS: 'theme:getDetails',
  GET_FAVORITES: 'theme:getFavorites',
  GET_HISTORY: 'theme:getHistory',
  GET_PRESETS: 'theme:getPresets',
  IMPORT: 'theme:import',
  IS_FAVORITE: 'theme:isFavorite',
  RUNTIME_GET_ALL: 'theme:runtime:getAll',
  RUNTIME_INSTALL: 'theme:runtime:install',
  RUNTIME_OPEN_DIRECTORY: 'theme:runtime:openDirectory',
  RUNTIME_UNINSTALL: 'theme:runtime:uninstall',
  SET: 'theme:set',
  TOGGLE_FAVORITE: 'theme:toggleFavorite',
  UPDATE_CUSTOM: 'theme:updateCustom',
  RUNTIME_UPDATED: 'theme:runtime:updated',
} as const;

/** Image studio channels */
export const IMAGE_STUDIO_CHANNELS = {
  EDIT: 'image-studio:edit',
  GENERATE: 'image-studio:generate',
  LOAD_SETTINGS: 'image-studio:load-settings',
  SAVE: 'image-studio:save',
  SAVE_SETTINGS: 'image-studio:save-settings',
} as const;

/** Voice processing and synthesis channels */
export const VOICE_CHANNELS = {
  ADD_COMMAND: 'voice:add-command',
  CREATE_NOTE: 'voice:create-note',
  DETECT_WAKE_WORD: 'voice:detect-wake-word',
  EXECUTE_COMMAND: 'voice:execute-command',
  END_SESSION: 'voice:end-session',
  GET_NOTE: 'voice:get-note',
  GET_COMMANDS: 'voice:get-commands',
  GET_SETTINGS: 'voice:get-settings',
  GET_VOICES: 'voice:get-voices',
  HEALTH: 'voice:health',
  LIST_NOTES: 'voice:list-notes',
  PROCESS_TRANSCRIPT: 'voice:process-transcript',
  REMOVE_COMMAND: 'voice:remove-command',
  SEND_EVENT: 'voice:send-event',
  START_SESSION: 'voice:start-session',
  SET_LISTENING: 'voice:set-listening',
  SUBMIT_UTTERANCE: 'voice:submit-utterance',
  STOP_SPEAKING: 'voice:stop-speaking',
  SYNTHESIZE: 'voice:synthesize',
  UPDATE_COMMAND: 'voice:update-command',
  UPDATE_SETTINGS: 'voice:update-settings',
} as const;

// ---------------------------------------------------------------------------
// Process & Terminal
// ---------------------------------------------------------------------------

/** Process management channels */
export const PROCESS_CHANNELS = {
  DATA: 'process:data',
  EXIT: 'process:exit',
  KILL: 'process:kill',
  LIST: 'process:list',
  RESIZE: 'process:resize',
  SCAN_SCRIPTS: 'process:scan-scripts',
  SPAWN: 'process:spawn',
  WRITE: 'process:write',
} as const;

/** Terminal channels */
export const TERMINAL_CHANNELS = {
  ADD_SCROLLBACK_MARKER: 'terminal:addScrollbackMarker',
  CLEAR_COMMAND_HISTORY: 'terminal:clearCommandHistory',
  CLOSE: 'terminal:close',
  CREATE: 'terminal:create',
  CREATE_FROM_SESSION_TEMPLATE: 'terminal:createFromSessionTemplate',
  DATA: 'terminal:data',
  EXIT: 'terminal:exit',
  CREATE_SESSION: 'terminal:createSession',
  CREATE_SESSION_SHARE_CODE: 'terminal:createSessionShareCode',
  DELETE_PROFILE: 'terminal:deleteProfile',
  DELETE_SCROLLBACK_MARKER: 'terminal:deleteScrollbackMarker',
  DELETE_SESSION_TEMPLATE: 'terminal:deleteSessionTemplate',
  EXPLAIN_COMMAND: 'terminal:explainCommand',
  EXPLAIN_ERROR: 'terminal:explainError',
  EXPORT_PROFILES: 'terminal:exportProfiles',
  EXPORT_PROFILE_SHARE_CODE: 'terminal:exportProfileShareCode',
  EXPORT_SCROLLBACK: 'terminal:exportScrollback',
  EXPORT_SEARCH_RESULTS: 'terminal:exportSearchResults',
  EXPORT_SESSION: 'terminal:exportSession',
  FILTER_SCROLLBACK: 'terminal:filterScrollback',
  FIX_ERROR: 'terminal:fixError',
  GET_BACKENDS: 'terminal:getBackends',
  GET_COMMAND_HISTORY: 'terminal:getCommandHistory',
  GET_DISCOVERY_SNAPSHOT: 'terminal:getDiscoverySnapshot',
  GET_DOCKER_CONTAINERS: 'terminal:getDockerContainers',
  GET_PROFILES: 'terminal:getProfiles',
  GET_PROFILE_TEMPLATES: 'terminal:getProfileTemplates',
  GET_RUNTIME_HEALTH: 'terminal:getRuntimeHealth',
  GET_SEARCH_ANALYTICS: 'terminal:getSearchAnalytics',
  GET_SEARCH_SUGGESTIONS: 'terminal:getSearchSuggestions',
  GET_SESSION_ANALYTICS: 'terminal:getSessionAnalytics',
  GET_SESSION_TEMPLATES: 'terminal:getSessionTemplates',
  GET_SESSIONS: 'terminal:getSessions',
  GET_SHELLS: 'terminal:getShells',
  GET_SNAPSHOT_SESSIONS: 'terminal:getSnapshotSessions',
  GET_SUGGESTIONS: 'terminal:getSuggestions',
  IMPORT_PROFILES: 'terminal:importProfiles',
  IMPORT_PROFILE_SHARE_CODE: 'terminal:importProfileShareCode',
  IMPORT_SESSION: 'terminal:importSession',
  IMPORT_SESSION_SHARE_CODE: 'terminal:importSessionShareCode',
  IS_AVAILABLE: 'terminal:isAvailable',
  KILL: 'terminal:kill',
  LIST_SCROLLBACK_MARKERS: 'terminal:listScrollbackMarkers',
  READ_BUFFER: 'terminal:readBuffer',
  RESIZE: 'terminal:resize',
  RESTORE_ALL_SNAPSHOTS: 'terminal:restoreAllSnapshots',
  RESTORE_SNAPSHOT_SESSION: 'terminal:restoreSnapshotSession',
  SAVE_PROFILE: 'terminal:saveProfile',
  SAVE_SESSION_TEMPLATE: 'terminal:saveSessionTemplate',
  SEARCH_SCROLLBACK: 'terminal:searchScrollback',
  SET_SESSION_TITLE: 'terminal:setSessionTitle',
  VALIDATE_PROFILE: 'terminal:validateProfile',
  WRITE: 'terminal:write',
  DETACH: 'terminal:detach',

  // Events
  DATA_EVENT: 'terminal:data-event',
  EXIT_EVENT: 'terminal:exit-event',
  STATUS_CHANGE_EVENT: 'terminal:status-change-event',
} as const;

// ---------------------------------------------------------------------------
// SSH
// ---------------------------------------------------------------------------

/** SSH connection and operation channels */
export const SSH_CHANNELS = {
  ACQUIRE_CONNECTION: 'ssh:acquireConnection',
  ADD_KNOWN_HOST: 'ssh:addKnownHost',
  BACKUP_MANAGED_KEY: 'ssh:backupManagedKey',
  CLOSE: 'ssh:close',
  CLOSE_TUNNEL: 'ssh:closeTunnel',
  CONNECT: 'ssh:connect',
  CONNECTED: 'ssh:connected',
  COPY_PATH: 'ssh:copyPath',
  CREATE_TUNNEL: 'ssh:createTunnel',
  DELETE_DIR: 'ssh:deleteDir',
  DELETE_FILE: 'ssh:deleteFile',
  DELETE_MANAGED_KEY: 'ssh:deleteManagedKey',
  DELETE_PROFILE: 'ssh:deleteProfile',
  DELETE_PROFILE_TEMPLATE: 'ssh:deleteProfileTemplate',
  DELETE_TUNNEL_PRESET: 'ssh:deleteTunnelPreset',
  DISCONNECTED: 'ssh:disconnected',
  DISCONNECT: 'ssh:disconnect',
  DOWNLOAD: 'ssh:download',
  DOWNLOAD_PROGRESS: 'ssh:downloadProgress',
  ENQUEUE_TRANSFER: 'ssh:enqueueTransfer',
  EXECUTE: 'ssh:execute',
  EXPORT_PROFILES: 'ssh:exportProfiles',
  EXPORT_SEARCH_HISTORY: 'ssh:exportSearchHistory',
  EXPORT_SESSION_RECORDING: 'ssh:exportSessionRecording',
  GENERATE_MANAGED_KEY: 'ssh:generateManagedKey',
  GET_CONNECTION_POOL_STATS: 'ssh:getConnectionPoolStats',
  GET_CONNECTIONS: 'ssh:getConnections',
  GET_INSTALLED_PACKAGES: 'ssh:getInstalledPackages',
  GET_LOG_FILES: 'ssh:getLogFiles',
  GET_MANAGED_KEYS: 'ssh:listManagedKeys',
  GET_PROFILE_TEMPLATES: 'ssh:getProfileTemplates',
  GET_PROFILES: 'ssh:getProfiles',
  GET_SEARCH_HISTORY: 'ssh:getSearchHistory',
  GET_SESSION_RECORDING: 'ssh:getSessionRecording',
  GET_SYSTEM_STATS: 'ssh:getSystemStats',
  GET_TRANSFER_QUEUE: 'ssh:getTransferQueue',
  IMPORT_MANAGED_KEY: 'ssh:importManagedKey',
  IMPORT_PROFILES: 'ssh:importProfiles',
  IS_CONNECTED: 'ssh:isConnected',
  LIST_KNOWN_HOSTS: 'ssh:listKnownHosts',
  LIST_MANAGED_KEYS: 'ssh:listManagedKeys',
  LIST_DIR: 'ssh:listDir',
  LIST_PROFILE_TEMPLATES: 'ssh:listProfileTemplates',
  LIST_REMOTE_CONTAINERS: 'ssh:listRemoteContainers',
  LIST_SESSION_RECORDINGS: 'ssh:listSessionRecordings',
  LIST_TUNNELS: 'ssh:listTunnels',
  LIST_TUNNEL_PRESETS: 'ssh:listTunnelPresets',
  MKDIR: 'ssh:mkdir',
  READ_FILE: 'ssh:readFile',
  READ_LOG_FILE: 'ssh:readLogFile',
  RECONNECT: 'ssh:reconnect',
  RELEASE_CONNECTION: 'ssh:releaseConnection',
  REMOVE_KNOWN_HOST: 'ssh:removeKnownHost',
  RENAME: 'ssh:rename',
  ROTATE_MANAGED_KEY: 'ssh:rotateManagedKey',
  RUN_REMOTE_CONTAINER: 'ssh:runRemoteContainer',
  RUN_TRANSFER_BATCH: 'ssh:runTransferBatch',
  SAVE_PROFILE: 'ssh:saveProfile',
  SAVE_PROFILE_TEMPLATE: 'ssh:saveProfileTemplate',
  SAVE_TUNNEL_PRESET: 'ssh:saveTunnelPreset',
  SEARCH_LOG_FILES: 'ssh:searchLogFiles',
  SEARCH_REMOTE_FILES: 'ssh:searchRemoteFiles',
  SEARCH_SESSION_RECORDING: 'ssh:searchSessionRecording',
  SEARCH_TRANSFER_HISTORY: 'ssh:searchTransferHistory',
  SHELL_CLOSE: 'ssh:shellClose',
  SHELL_DATA: 'ssh:shellData',
  SHELL_RESIZE: 'ssh:shellResize',
  SHELL_START: 'ssh:shellStart',
  SHELL_WRITE: 'ssh:shellWrite',
  START: 'ssh:start',
  START_SESSION_RECORDING: 'ssh:startSessionRecording',
  STOP_REMOTE_CONTAINER: 'ssh:stopRemoteContainer',
  STOP_SESSION_RECORDING: 'ssh:stopSessionRecording',
  STDERR: 'ssh:stderr',
  STDOUT: 'ssh:stdout',
  TEST_PROFILE: 'ssh:testProfile',
  UPLOAD: 'ssh:upload',
  UPLOAD_PROGRESS: 'ssh:uploadProgress',
  VALIDATE_PROFILE: 'ssh:validateProfile',
  WRITE_FILE: 'ssh:writeFile',
} as const;

// ---------------------------------------------------------------------------
// Workspace & Editor
// ---------------------------------------------------------------------------

/** Workspace analysis, watching, and editor assistance channels */
export const WORKSPACE_CHANNELS = {
  ANALYZE: 'workspace:analyze',
  ANALYZE_DIRECTORY: 'workspace:analyzeDirectory',
  ANALYZE_IDENTITY: 'workspace:analyzeIdentity',
  ANALYZE_SUMMARY: 'workspace:analyzeSummary',
  APPLY_LOGO: 'workspace:applyLogo',
  CLEAR_ACTIVE: 'workspace:clearActive',
  FILE_CHANGE_EVENT: 'workspace:file-change',
  GENERATE_LOGO: 'workspace:generateLogo',
  GET_COMPLETION: 'workspace:getCompletion',
  GET_ENV: 'workspace:getEnv',
  GET_CODE_ACTIONS: 'workspace:get-code-actions',
  GET_FILE_DEFINITION: 'workspace:getFileDefinition',
  GET_FILE_DIAGNOSTICS: 'workspace:getFileDiagnostics',
  GET_INLINE_SUGGESTION: 'workspace:getInlineSuggestion',
  IMPROVE_LOGO_PROMPT: 'workspace:improveLogoPrompt',
  PULL_DIAGNOSTICS: 'workspace:pull-diagnostics',
  SAVE_ENV: 'workspace:saveEnv',
  SET_ACTIVE: 'workspace:setActive',
  TRACK_INLINE_SUGGESTION_usageStats: 'workspace:trackInlineSuggestionUsageStats',
  UNWATCH: 'workspace:unwatch',
  UPLOAD_LOGO: 'workspace:uploadLogo',
  WATCH: 'workspace:watch',
} as const;

// ---------------------------------------------------------------------------
// Proxy & Usage
// ---------------------------------------------------------------------------

/** Proxy and provider channels */
export const PROXY_CHANNELS = {
  ANTHROPIC_LOGIN: 'proxy:anthropicLogin',
  ANTIGRAVITY_LOGIN: 'proxy:antigravityLogin',
  CANCEL_AUTH: 'proxy:cancelAuth',
  CLAUDE_LOGIN: 'proxy:claudeLogin',
  CODEX_LOGIN: 'proxy:codexLogin',
  DELETE_AUTH_FILE: 'proxy:deleteAuthFile',
  DOWNLOAD_AUTH_FILE: 'proxy:downloadAuthFile',
  FORCE_REFRESH_QUOTA: 'proxy:forceRefreshQuota',
  GET_AUTH_STATUS: 'proxy:getAuthStatus',
  GET_CLAUDE_QUOTA: 'proxy:getClaudeQuota',
  GET_CODEX_USAGE: 'proxy:getCodexUsage',
  GET_COPILOT_QUOTA: 'proxy:getCopilotQuota',
  GET_MODELS: 'proxy:getModels',
  GET_QUOTA: 'proxy:getQuota',
  SAVE_CLAUDE_SESSION: 'proxy:saveClaudeSession',
  SYNC_AUTH_FILES: 'proxy:syncAuthFiles',
  VERIFY_AUTH_BRIDGE: 'proxy:verifyAuthBridge',
  LIST_SKILLS: 'proxy:listSkills',
  SAVE_SKILL: 'proxy:saveSkill',
  TOGGLE_SKILL: 'proxy:toggleSkill',
  DELETE_SKILL: 'proxy:deleteSkill',
  LIST_MARKETPLACE_SKILLS: 'proxy:listMarketplaceSkills',
  INSTALL_MARKETPLACE_SKILL: 'proxy:installMarketplaceSkill',
  OLLAMA_LOGIN: 'proxy:ollamaLogin',
  OLLAMA_SIGNOUT: 'proxy:ollamaSignout',
} as const;

/** Proxy embed channels */
export const PROXY_EMBED_CHANNELS = {
  START: 'proxy-embed:start',
  STATUS: 'proxy-embed:status',
  STOP: 'proxy-embed:stop',
} as const;

/** Usage tracking channels */
export const USAGE_CHANNELS = {
  CHECK_LIMIT: 'usage:checkLimit',
  GET_USAGE_COUNT: 'usage:getUsageCount',
  RECORD_USAGE: 'usage:recordUsage',
} as const;

// ---------------------------------------------------------------------------
// MCP (Model Context Protocol)
// ---------------------------------------------------------------------------

/** MCP plugin system channels */
export const MCP_CHANNELS = {
  DEBUG_METRICS: 'mcp:debug-metrics',
  DISPATCH: 'mcp:dispatch',
  INSTALL: 'mcp:install',
  LIST: 'mcp:list',
  RESULT: 'mcp:result',
  TOGGLE: 'mcp:toggle',
  UNINSTALL: 'mcp:uninstall',
} as const;

/** MCP permissions channels */
export const MCP_PERMISSIONS_CHANNELS = {
  LIST_REQUESTS: 'mcp:permissions:list-requests',
  RESOLVE_REQUEST: 'mcp:permissions:resolve-request',
  SET: 'mcp:permissions:set',
} as const;

// ---------------------------------------------------------------------------
// Hugging Face
// ---------------------------------------------------------------------------

/** Hugging Face integration channels */
export const HF_CHANNELS = {
  CACHE_CLEAR: 'hf:cache-clear',
  CACHE_STATS: 'hf:cache-stats',
  CANCEL_DOWNLOAD: 'hf:cancel-download',
  COMPARE_MODELS: 'hf:compare-models',
  CONVERT_MODEL: 'hf:convert-model',
  DELETE_MODEL: 'hf:delete-model',
  GET_BULK_MODEL_PREVIEWS: 'hf:get-bulk-model-previews',
  CONVERSION_PROGRESS: 'hf:conversion-progress',
  DOWNLOAD_FILE: 'hf:download-file',
  DOWNLOAD_PROGRESS: 'hf:download-progress',
  GET_CONVERSION_PRESETS: 'hf:get-conversion-presets',
  GET_FILES: 'hf:get-files',
  GET_MODEL_PREVIEW: 'hf:get-model-preview',
  GET_OPTIMIZATION_SUGGESTIONS: 'hf:get-optimization-suggestions',
  GET_RECOMMENDATIONS: 'hf:get-recommendations',
  GET_WATCHLIST: 'hf:watchlist:get',
  SEARCH_MODELS: 'hf:search-models',
  TEST_DOWNLOADED_MODEL: 'hf:test-downloaded-model',
  VALIDATE_COMPATIBILITY: 'hf:validate-compatibility',
  VALIDATE_CONVERSION: 'hf:validate-conversion',
  ADD_TO_WATCHLIST: 'hf:watchlist:add',
  REMOVE_FROM_WATCHLIST: 'hf:watchlist:remove',
} as const;

/** Hugging Face fine-tuning channels */
export const HF_FINETUNE_CHANNELS = {
  CANCEL: 'hf:finetune:cancel',
  EVALUATE: 'hf:finetune:evaluate',
  EXPORT: 'hf:finetune:export',
  GET: 'hf:finetune:get',
  LIST: 'hf:finetune:list',
  PREPARE_DATASET: 'hf:finetune:prepare-dataset',
  START: 'hf:finetune:start',
  PROGRESS: 'hf:finetune-progress',
} as const;

/** Hugging Face version management channels */
export const HF_VERSIONS_CHANNELS = {
  COMPARE: 'hf:versions:compare',
  COMPARE_MODELS: 'hf:versions:compare-models',
  LIST: 'hf:versions:list',
  NOTIFICATIONS: 'hf:versions:notifications',
  PIN: 'hf:versions:pin',
  REGISTER: 'hf:versions:register',
  ROLLBACK: 'hf:versions:rollback',
} as const;

/** Hugging Face watchlist channels */
export const HF_WATCHLIST_CHANNELS = {
  ADD: 'hf:watchlist:add',
  GET: 'hf:watchlist:get',
  REMOVE: 'hf:watchlist:remove',
} as const;

// ---------------------------------------------------------------------------
// Stable Diffusion (sd-cpp)
// ---------------------------------------------------------------------------

/** Stable Diffusion C++ integration channels */
export const SD_CPP_CHANNELS = {
  BATCH_GENERATE: 'sd-cpp:batchGenerate',
  CANCEL_SCHEDULE: 'sd-cpp:cancelSchedule',
  COMPARE: 'sd-cpp:compare',
  DELETE_PRESET: 'sd-cpp:deletePreset',
  DELETE_WORKFLOW_TEMPLATE: 'sd-cpp:deleteWorkflowTemplate',
  EDIT: 'sd-cpp:edit',
  EXPORT_COMPARISON: 'sd-cpp:exportComparison',
  EXPORT_HISTORY: 'sd-cpp:exportHistory',
  EXPORT_PRESET_SHARE: 'sd-cpp:exportPresetShare',
  EXPORT_WORKFLOW_TEMPLATE_SHARE: 'sd-cpp:exportWorkflowTemplateShare',
  PROGRESS: 'sd-cpp:progress',
  GET_ANALYTICS: 'sd-cpp:getAnalytics',
  GET_HISTORY: 'sd-cpp:getHistory',
  GET_PRESET_ANALYTICS: 'sd-cpp:getPresetAnalytics',
  GET_QUEUE_STATS: 'sd-cpp:getQueueStats',
  GET_SCHEDULE_ANALYTICS: 'sd-cpp:getScheduleAnalytics',
  GET_STATUS: 'sd-cpp:getStatus',
  STATUS: 'sd-cpp:status',
  IMPORT_PRESET_SHARE: 'sd-cpp:importPresetShare',
  IMPORT_WORKFLOW_TEMPLATE_SHARE: 'sd-cpp:importWorkflowTemplateShare',
  LIST_PRESETS: 'sd-cpp:listPresets',
  LIST_SCHEDULES: 'sd-cpp:listSchedules',
  LIST_WORKFLOW_TEMPLATES: 'sd-cpp:listWorkflowTemplates',
  REGENERATE: 'sd-cpp:regenerate',
  REINSTALL: 'sd-cpp:reinstall',
  SAVE_PRESET: 'sd-cpp:savePreset',
  SAVE_WORKFLOW_TEMPLATE: 'sd-cpp:saveWorkflowTemplate',
  SCHEDULE: 'sd-cpp:schedule',
  SEARCH_HISTORY: 'sd-cpp:searchHistory',
  SHARE_COMPARISON: 'sd-cpp:shareComparison',
} as const;

/** Image gallery channels */
export const GALLERY_CHANNELS = {
  BATCH_DOWNLOAD: 'gallery:batch-download',
  DELETE: 'gallery:delete',
  LIST: 'gallery:list',
  OPEN: 'gallery:open',
  REVEAL: 'gallery:reveal',
} as const;

// ---------------------------------------------------------------------------
// Code Intelligence
// ---------------------------------------------------------------------------

/** Code analysis and intelligence channels */
export const CODE_CHANNELS = {
  ANALYZE_QUALITY: 'code:analyzeQuality',
  APPLY_RENAME_SYMBOL: 'code:applyRenameSymbol',
  FIND_DEFINITION: 'code:findDefinition',
  FIND_IMPLEMENTATIONS: 'code:findImplementations',
  FIND_REFERENCES: 'code:findReferences',
  FIND_SYMBOLS: 'code:findSymbols',
  FIND_USAGE: 'code:findUsage',
  GENERATE_FILE_DOCUMENTATION: 'code:generateFileDocumentation',
  GENERATE_WORKSPACE_DOCUMENTATION: 'code:generateWorkspaceDocumentation',
  GET_FILE_OUTLINE: 'code:getFileOutline',
  GET_SYMBOL_ANALYTICS: 'code:getSymbolAnalytics',
  GET_SYMBOL_RELATIONSHIPS: 'code:getSymbolRelationships',
  GET_WORKSPACE_CODE_MAP: 'code:getWorkspaceCodeMap',
  GET_WORKSPACE_DEPENDENCY_GRAPH: 'code:getWorkspaceDependencyGraph',
  INDEX_WORKSPACE: 'code:indexWorkspace',
  PREVIEW_RENAME_SYMBOL: 'code:previewRenameSymbol',
  QUERY_INDEXED_SYMBOLS: 'code:queryIndexedSymbols',
  QUERY_SYMBOLS: 'code:querySymbols',
  SCAN_TODOS: 'code:scanTodos',
  SEARCH_FILES: 'code:searchFiles',
} as const;

/** Code sandbox execution channels */
export const CODE_SANDBOX_CHANNELS = {
  EXECUTE: 'code-sandbox:execute',
  HEALTH: 'code-sandbox:health',
  LANGUAGES: 'code-sandbox:languages',
} as const;

// ---------------------------------------------------------------------------
// Prompt Templates
// ---------------------------------------------------------------------------

/** Prompt template channels */
export const PROMPT_TEMPLATES_CHANNELS = {
  CREATE: 'prompt-templates:create',
  DELETE: 'prompt-templates:delete',
  GET: 'prompt-templates:get',
  GET_ALL: 'prompt-templates:getAll',
  GET_BY_CATEGORY: 'prompt-templates:getByCategory',
  GET_BY_TAG: 'prompt-templates:getByTag',
  GET_CATEGORIES: 'prompt-templates:getCategories',
  GET_TAGS: 'prompt-templates:getTags',
  RENDER: 'prompt-templates:render',
  SEARCH: 'prompt-templates:search',
  UPDATE: 'prompt-templates:update',
} as const;

/** Shared prompts channels */
export const SHARED_PROMPTS_CHANNELS = {
  CREATE: 'shared-prompts:create',
  DELETE: 'shared-prompts:delete',
  EXPORT_TO_FILE: 'shared-prompts:exportToFile',
  EXPORT_TO_JSON: 'shared-prompts:exportToJson',
  GET_ALL: 'shared-prompts:getAll',
  GET_BY_ID: 'shared-prompts:getById',
  IMPORT_FROM_FILE: 'shared-prompts:importFromFile',
  IMPORT_FROM_JSON: 'shared-prompts:importFromJson',
  LIST: 'shared-prompts:list',
  UPDATE: 'shared-prompts:update',
} as const;

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

/** Tool execution channels */
export const TOOLS_CHANNELS = {
  EXECUTE: 'tools:execute',
  GET_DEFINITIONS: 'tools:get-definitions',
  KILL: 'tools:kill',
} as const;

// ---------------------------------------------------------------------------
// Batch & IPC Utils
// ---------------------------------------------------------------------------

/** IPC batching channels */
export const BATCH_CHANNELS = {
  GET_CHANNELS: 'batch:getChannels',
  INVOKE: 'batch:invoke',
  INVOKE_SEQUENTIAL: 'batch:invokeSequential',
} as const;

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

/** Log channels */
export const LOG_CHANNELS = {
  BUFFER_CLEAR: 'log:buffer:clear',
  BUFFER_GET: 'log:buffer:get',
  STREAM_START: 'log:stream:start',
  STREAM_STOP: 'log:stream:stop',
  WRITE: 'log:write',
} as const;

// ---------------------------------------------------------------------------
// Lazy Loading
// ---------------------------------------------------------------------------

/** Lazy loading channels */
export const LAZY_CHANNELS = {
  GET_STATUS: 'lazy:get-status',
} as const;

// ---------------------------------------------------------------------------
// Main Channel Registry
// ---------------------------------------------------------------------------

/**
 * Main channel registry containing all channel constants.
 * Use this for a more structured access to channel names.
 */
export const CHANNELS = {
  advancedMemory: ADVANCED_MEMORY_CHANNELS,
  agent: AGENT_CHANNELS,
  app: APP_CHANNELS,
  audit: AUDIT_CHANNELS,
  auth: AUTH_CHANNELS,
  authSession: AUTH_SESSION_CHANNELS,
  backup: BACKUP_CHANNELS,
  batch: BATCH_CHANNELS,
  brain: BRAIN_CHANNELS,
  clipboard: CLIPBOARD_CHANNELS,
  code: CODE_CHANNELS,
  codeSandbox: CODE_SANDBOX_CHANNELS,
  collaboration: COLLABORATION_CHANNELS,
  collaborationSync: COLLABORATION_SYNC_CHANNELS,
  contextWindow: CONTEXT_WINDOW_CHANNELS,
  contract: CONTRACT_CHANNELS,
  db: DB_CHANNELS,
  embedding: EMBEDDING_CHANNELS,
  export: EXPORT_CHANNELS,
  files: FILES_CHANNELS,
  gallery: GALLERY_CHANNELS,
  git: GIT_CHANNELS,
  health: HEALTH_CHANNELS,
  hf: HF_CHANNELS,
  hfFinetune: HF_FINETUNE_CHANNELS,
  hfVersions: HF_VERSIONS_CHANNELS,
  hfWatchlist: HF_WATCHLIST_CHANNELS,
  llama: LLAMA_CHANNELS,
  keyRotation: KEY_ROTATION_CHANNELS,
  lazy: LAZY_CHANNELS,
  log: LOG_CHANNELS,
  mcp: MCP_CHANNELS,
  mcpPermissions: MCP_PERMISSIONS_CHANNELS,
  metrics: METRICS_CHANNELS,
  migration: MIGRATION_CHANNELS,
  marketplace: MARKETPLACE_CHANNELS,
  memory: MEMORY_CHANNELS,
  llm: LLM_CHANNELS,
  modelRegistry: MODEL_REGISTRY_CHANNELS,
  ollama: OLLAMA_CHANNELS,
  process: PROCESS_CHANNELS,
  promptTemplates: PROMPT_TEMPLATES_CHANNELS,
  proxy: PROXY_CHANNELS,
  proxyEmbed: PROXY_EMBED_CHANNELS,
  runtime: RUNTIME_CHANNELS,
  sdCpp: SD_CPP_CHANNELS,
  settings: SETTINGS_CHANNELS,
  sharedPrompts: SHARED_PROMPTS_CHANNELS,
  shell: SHELL_CHANNELS,
  ssh: SSH_CHANNELS,
  terminal: TERMINAL_CHANNELS,
  theme: THEME_CHANNELS,
  tokenEstimation: TOKEN_ESTIMATION_CHANNELS,
  tools: TOOLS_CHANNELS,
  update: UPDATE_CHANNELS,
  usage: USAGE_CHANNELS,
  voice: VOICE_CHANNELS,
  window: WINDOW_CHANNELS,
  workspace: WORKSPACE_CHANNELS,
  session: SESSION_CHANNELS,
  sessionConversation: SESSION_CONVERSATION_CHANNELS,
  sessionAutomation: SESSION_AUTOMATION_CHANNELS,
  sessionCouncil: SESSION_COUNCIL_CHANNELS,
  sessionWorkspace: SESSION_WORKSPACE_CHANNELS,
  liveCollaboration: LIVE_COLLABORATION_CHANNELS,
  workspaceAgentSession: WORKSPACE_AGENT_SESSION_CHANNELS,
} as const;

/** All IPC channels grouped by domain for internal use */
export const IPC_CHANNELS = {
  ADVANCED_MEMORY: ADVANCED_MEMORY_CHANNELS,
  AGENT: AGENT_CHANNELS,
  APP: APP_CHANNELS,
  AUDIT: AUDIT_CHANNELS,
  AUTH: AUTH_CHANNELS,
  AUTH_SESSION: AUTH_SESSION_CHANNELS,
  BACKUP: BACKUP_CHANNELS,
  BATCH: BATCH_CHANNELS,
  BRAIN: BRAIN_CHANNELS,
  CLIPBOARD: CLIPBOARD_CHANNELS,
  CODE: CODE_CHANNELS,
  CODE_SANDBOX: CODE_SANDBOX_CHANNELS,
  COLLABORATION: COLLABORATION_CHANNELS,
  COLLABORATION_SYNC: COLLABORATION_SYNC_CHANNELS,
  CONTEXT_WINDOW: CONTEXT_WINDOW_CHANNELS,
  CONTRACT: CONTRACT_CHANNELS,
  DB: DB_CHANNELS,
  EMBEDDING: EMBEDDING_CHANNELS,
  EXPORT: EXPORT_CHANNELS,
  FILES: FILES_CHANNELS,
  GALLERY: GALLERY_CHANNELS,
  GIT: GIT_CHANNELS,
  HEALTH: HEALTH_CHANNELS,
  HF: HF_CHANNELS,
  IMAGE_STUDIO: IMAGE_STUDIO_CHANNELS,
  HF_FINETUNE: HF_FINETUNE_CHANNELS,
  HF_VERSIONS: HF_VERSIONS_CHANNELS,
  HF_WATCHLIST: HF_WATCHLIST_CHANNELS,
  LLAMA: LLAMA_CHANNELS,
  KEY_ROTATION: KEY_ROTATION_CHANNELS,
  LAZY: LAZY_CHANNELS,
  LOG: LOG_CHANNELS,
  MCP: MCP_CHANNELS,
  MCP_PERMISSIONS: MCP_PERMISSIONS_CHANNELS,
  METRICS: METRICS_CHANNELS,
  MIGRATION: MIGRATION_CHANNELS,
  MARKETPLACE: MARKETPLACE_CHANNELS,
  MEMORY: MEMORY_CHANNELS,
  LLM: LLM_CHANNELS,
  MODEL_DOWNLOADER: MODEL_DOWNLOADER_CHANNELS,
  MODEL_REGISTRY: MODEL_REGISTRY_CHANNELS,
  OLLAMA: OLLAMA_CHANNELS,
  PROCESS: PROCESS_CHANNELS,
  PROMPT_TEMPLATES: PROMPT_TEMPLATES_CHANNELS,
  PROXY: PROXY_CHANNELS,
  PROXY_EMBED: PROXY_EMBED_CHANNELS,
  RUNTIME: RUNTIME_CHANNELS,
  SD_CPP: SD_CPP_CHANNELS,
  SETTINGS: SETTINGS_CHANNELS,
  SHARED_PROMPTS: SHARED_PROMPTS_CHANNELS,
  SHELL: SHELL_CHANNELS,
  SSH: SSH_CHANNELS,
  TERMINAL: TERMINAL_CHANNELS,
  THEME: THEME_CHANNELS,
  TOKEN_ESTIMATION: TOKEN_ESTIMATION_CHANNELS,
  TOOLS: TOOLS_CHANNELS,
  UPDATE: UPDATE_CHANNELS,
  USAGE: USAGE_CHANNELS,
  VOICE: VOICE_CHANNELS,
  WINDOW: WINDOW_CHANNELS,
  WORKSPACE: WORKSPACE_CHANNELS,
  SESSION: SESSION_CHANNELS,
  SESSION_CONVERSATION: SESSION_CONVERSATION_CHANNELS,
  SESSION_AUTOMATION: SESSION_AUTOMATION_CHANNELS,
  SESSION_COUNCIL: SESSION_COUNCIL_CHANNELS,
  SESSION_WORKSPACE: SESSION_WORKSPACE_CHANNELS,
  LIVE_COLLABORATION: LIVE_COLLABORATION_CHANNELS,
  WORKSPACE_AGENT_SESSION: WORKSPACE_AGENT_SESSION_CHANNELS,
} as const;

/** Union type of all IPC channel name strings */
export type IpcChannelName = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS][keyof typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS]];


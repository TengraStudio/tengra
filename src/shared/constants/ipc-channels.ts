/**
 * Centralized registry of all IPC channel names used in Tengra.
 *
 * This file serves as a single source of truth for every IPC channel.
 * Channels are grouped by domain and use `as const` for type safety.
 *
 * @module ipc-channels
 */

// ---------------------------------------------------------------------------
// Window & Shell
// ---------------------------------------------------------------------------

/** Window management and shell operations */
export const WINDOW_CHANNELS = {
  /** Capture browser cookies */
  CAPTURE_COOKIES: 'window:captureCookies',
  /** Close the application window */
  CLOSE: 'window:close',
  /** Maximize the application window */
  MAXIMIZE: 'window:maximize',
  /** Minimize the application window */
  MINIMIZE: 'window:minimize',
  /** Open a detached terminal window */
  OPEN_DETACHED_TERMINAL: 'window:openDetachedTerminal',
  /** Resize the application window */
  RESIZE: 'window:resize',
  /** Toggle compact mode */
  TOGGLE_COMPACT: 'window:toggle-compact',
  /** Toggle fullscreen mode */
  TOGGLE_FULLSCREEN: 'window:toggle-fullscreen',
} as const;

/** Shell utility channels */
export const SHELL_CHANNELS = {
  /** Open a URL or path in the OS default handler */
  OPEN_EXTERNAL: 'shell:openExternal',
  /** Open the system terminal */
  OPEN_TERMINAL: 'shell:openTerminal',
  /** Run an arbitrary shell command */
  RUN_COMMAND: 'shell:runCommand',
} as const;

// ---------------------------------------------------------------------------
// App & Health
// ---------------------------------------------------------------------------

/** Application-level channels */
export const APP_CHANNELS = {
  /** Get the Electron userData directory path */
  GET_USER_DATA_PATH: 'app:getUserDataPath',
} as const;

/** Health-check channels */
export const HEALTH_CHANNELS = {
  /** Run a full health check */
  CHECK: 'health:check',
  /** Get a specific service's health */
  GET_SERVICE: 'health:getService',
  /** List all registered services */
  LIST_SERVICES: 'health:listServices',
  /** Get overall health status */
  STATUS: 'health:status',
} as const;

// ---------------------------------------------------------------------------
// Auth & Security
// ---------------------------------------------------------------------------

/** Authentication and session channels */
export const AUTH_CHANNELS = {
  /** Create a master key backup */
  CREATE_MASTER_KEY_BACKUP: 'auth:create-master-key-backup',
  /** Detect the current auth provider */
  DETECT_PROVIDER: 'auth:detect-provider',
  /** End the current user session */
  END_SESSION: 'auth:end-session',
  /** Export stored credentials */
  EXPORT_CREDENTIALS: 'auth:export-credentials',
  /** Get provider analytics data */
  GET_PROVIDER_ANALYTICS: 'auth:get-provider-analytics',
  /** Get provider health status */
  GET_PROVIDER_HEALTH: 'auth:get-provider-health',
  /** Get session analytics data */
  GET_SESSION_ANALYTICS: 'auth:get-session-analytics',
  /** Get session timeout setting */
  GET_SESSION_TIMEOUT: 'auth:get-session-timeout',
  /** Get token analytics data */
  GET_TOKEN_ANALYTICS: 'auth:get-token-analytics',
  /** Initiate GitHub OAuth login */
  GITHUB_LOGIN: 'auth:github-login',
  /** Import credentials from external source */
  IMPORT_CREDENTIALS: 'auth:import-credentials',
  /** Link an external account */
  LINK_ACCOUNT: 'auth:link-account',
  /** Poll for pending auth token */
  POLL_TOKEN: 'auth:poll-token',
  /** Restore master key from backup */
  RESTORE_MASTER_KEY_BACKUP: 'auth:restore-master-key-backup',
  /** Revoke a linked account's token */
  REVOKE_ACCOUNT_TOKEN: 'auth:revoke-account-token',
  /** Rotate token encryption keys */
  ROTATE_TOKEN_ENCRYPTION: 'auth:rotate-token-encryption',
  /** Set the active linked account */
  SET_ACTIVE_LINKED_ACCOUNT: 'auth:set-active-linked-account',
  /** Set maximum concurrent session limit */
  SET_SESSION_LIMIT: 'auth:set-session-limit',
  /** Set session timeout duration */
  SET_SESSION_TIMEOUT: 'auth:set-session-timeout',
  /** Start a new user session */
  START_SESSION: 'auth:start-session',
  /** Touch (refresh) the current session */
  TOUCH_SESSION: 'auth:touch-session',
  /** Unlink an external account */
  UNLINK_ACCOUNT: 'auth:unlink-account',
  /** Unlink a specific auth provider */
  UNLINK_PROVIDER: 'auth:unlink-provider',
} as const;

/** Key rotation channels */
export const KEY_ROTATION_CHANNELS = {
  /** Get the current encryption key metadata */
  GET_CURRENT_KEY: 'key-rotation:getCurrentKey',
  /** Get rotation status */
  GET_STATUS: 'key-rotation:getStatus',
  /** Initialize key rotation system */
  INITIALIZE: 'key-rotation:initialize',
  /** Perform a key rotation */
  ROTATE: 'key-rotation:rotate',
} as const;

/** Audit log channels */
export const AUDIT_CHANNELS = {
  /** Clear audit logs */
  CLEAR_LOGS: 'audit:clearLogs',
  /** Retrieve audit logs */
  GET_LOGS: 'audit:getLogs',
} as const;

// ---------------------------------------------------------------------------
// Chat & LLM
// ---------------------------------------------------------------------------

/** Chat channels */
export const CHAT_CHANNELS = {
  /** Cancel an in-progress chat stream */
  CANCEL: 'chat:cancel',
  /** Send a message via GitHub Copilot */
  COPILOT: 'chat:copilot',
  /** Send a message via OpenAI */
  OPENAI: 'chat:openai',
  /** Retry the last message with a different model */
  RETRY_WITH_MODEL: 'chat:retry-with-model',
  /** Stream a chat response */
  STREAM: 'chat:stream',
} as const;

/** Ollama local LLM channels */
export const OLLAMA_CHANNELS = {
  /** Abort current generation */
  ABORT: 'ollama:abort',
  /** Abort an in-progress model pull */
  ABORT_PULL: 'ollama:abortPull',
  /** Send a chat request (non-streaming) */
  CHAT: 'ollama:chat',
  /** Send a streaming chat request */
  CHAT_STREAM: 'ollama:chatStream',
  /** Check health of all models */
  CHECK_ALL_MODELS_HEALTH: 'ollama:checkAllModelsHealth',
  /** Check CUDA availability */
  CHECK_CUDA: 'ollama:checkCuda',
  /** Check a specific model's health */
  CHECK_MODEL_HEALTH: 'ollama:checkModelHealth',
  /** Force a health check */
  FORCE_HEALTH_CHECK: 'ollama:forceHealthCheck',
  /** Get current connection status */
  GET_CONNECTION_STATUS: 'ollama:getConnectionStatus',
  /** Get GPU alert thresholds */
  GET_GPU_ALERT_THRESHOLDS: 'ollama:getGPUAlertThresholds',
  /** Get GPU information */
  GET_GPU_INFO: 'ollama:getGPUInfo',
  /** Get available library models */
  GET_LIBRARY_MODELS: 'ollama:getLibraryModels',
  /** Get model recommendations */
  GET_MODEL_RECOMMENDATIONS: 'ollama:getModelRecommendations',
  /** Get installed models */
  GET_MODELS: 'ollama:getModels',
  /** Get recommended model for a specific task */
  GET_RECOMMENDED_MODEL_FOR_TASK: 'ollama:getRecommendedModelForTask',
  /** Get health status */
  HEALTH_STATUS: 'ollama:healthStatus',
  /** Check if Ollama is running */
  IS_RUNNING: 'ollama:isRunning',
  /** Pull a model */
  PULL: 'ollama:pull',
  /** Reconnect to Ollama */
  RECONNECT: 'ollama:reconnect',
  /** Set GPU alert thresholds */
  SET_GPU_ALERT_THRESHOLDS: 'ollama:setGPUAlertThresholds',
  /** Start Ollama service */
  START: 'ollama:start',
  /** Start GPU monitoring */
  START_GPU_MONITORING: 'ollama:startGPUMonitoring',
  /** Stop GPU monitoring */
  STOP_GPU_MONITORING: 'ollama:stopGPUMonitoring',
  /** List model tags */
  TAGS: 'ollama:tags',
  /** Test connection to Ollama */
  TEST_CONNECTION: 'ollama:testConnection',
} as const;

/** Model registry channels */
export const MODEL_REGISTRY_CHANNELS = {
  /** Get all models (local + remote) */
  GET_ALL_MODELS: 'model-registry:getAllModels',
  /** Get locally installed models */
  GET_INSTALLED_MODELS: 'model-registry:getInstalledModels',
  /** Get remote/available models */
  GET_REMOTE_MODELS: 'model-registry:getRemoteModels',
} as const;

/** Context window management channels */
export const CONTEXT_WINDOW_CHANNELS = {
  /** Get context window info for a model */
  GET_INFO: 'context-window:getInfo',
  /** Get recommended context settings */
  GET_RECOMMENDED_SETTINGS: 'context-window:getRecommendedSettings',
  /** Check if messages need truncation */
  NEEDS_TRUNCATION: 'context-window:needsTruncation',
  /** Truncate messages to fit context window */
  TRUNCATE: 'context-window:truncate',
} as const;

/** Token estimation channels */
export const TOKEN_ESTIMATION_CHANNELS = {
  /** Estimate tokens for a single message */
  ESTIMATE_MESSAGE: 'token-estimation:estimateMessage',
  /** Estimate tokens for multiple messages */
  ESTIMATE_MESSAGES: 'token-estimation:estimateMessages',
  /** Estimate tokens for a raw string */
  ESTIMATE_STRING: 'token-estimation:estimateString',
  /** Check if content fits in context window */
  FITS_IN_CONTEXT_WINDOW: 'token-estimation:fitsInContextWindow',
  /** Get context window size for a model */
  GET_CONTEXT_WINDOW_SIZE: 'token-estimation:getContextWindowSize',
} as const;

/** Collaboration / multi-model channels */
export const COLLABORATION_CHANNELS = {
  /** Get active task count */
  GET_ACTIVE_TASK_COUNT: 'collaboration:getActiveTaskCount',
  /** Get provider statistics */
  GET_PROVIDER_STATS: 'collaboration:getProviderStats',
  /** Run a collaborative task */
  RUN: 'collaboration:run',
  /** Set provider configuration */
  SET_PROVIDER_CONFIG: 'collaboration:setProviderConfig',
  /** Join a sync session */
  SYNC_JOIN: 'collaboration:sync:join',
  /** Leave a sync session */
  SYNC_LEAVE: 'collaboration:sync:leave',
  /** Send a sync message */
  SYNC_SEND: 'collaboration:sync:send',
} as const;

// ---------------------------------------------------------------------------
// Memory & Brain
// ---------------------------------------------------------------------------

/** Advanced memory system channels */
export const ADVANCED_MEMORY_CHANNELS = {
  /** Archive a memory entry */
  ARCHIVE: 'advancedMemory:archive',
  /** Archive multiple entries */
  ARCHIVE_MANY: 'advancedMemory:archiveMany',
  /** Confirm a pending memory */
  CONFIRM: 'advancedMemory:confirm',
  /** Confirm all pending memories */
  CONFIRM_ALL: 'advancedMemory:confirmAll',
  /** Create a shared namespace */
  CREATE_SHARED_NAMESPACE: 'advancedMemory:createSharedNamespace',
  /** Delete a memory entry */
  DELETE: 'advancedMemory:delete',
  /** Delete multiple entries */
  DELETE_MANY: 'advancedMemory:deleteMany',
  /** Edit a memory entry */
  EDIT: 'advancedMemory:edit',
  /** Export memories */
  EXPORT: 'advancedMemory:export',
  /** Extract memories from a message */
  EXTRACT_FROM_MESSAGE: 'advancedMemory:extractFromMessage',
  /** Get a single memory */
  GET: 'advancedMemory:get',
  /** Get all advanced memories */
  GET_ALL: 'advancedMemory:getAllAdvancedMemories',
  /** Get all entity knowledge */
  GET_ALL_ENTITY_KNOWLEDGE: 'advancedMemory:getAllEntityKnowledge',
  /** Get all episodes */
  GET_ALL_EPISODES: 'advancedMemory:getAllEpisodes',
  /** Get memory change history */
  GET_HISTORY: 'advancedMemory:getHistory',
  /** Get pending memories */
  GET_PENDING: 'advancedMemory:getPending',
  /** Get search analytics */
  GET_SEARCH_ANALYTICS: 'advancedMemory:getSearchAnalytics',
  /** Get search history */
  GET_SEARCH_HISTORY: 'advancedMemory:getSearchHistory',
  /** Get search suggestions */
  GET_SEARCH_SUGGESTIONS: 'advancedMemory:getSearchSuggestions',
  /** Get shared namespace analytics */
  GET_SHARED_NAMESPACE_ANALYTICS: 'advancedMemory:getSharedNamespaceAnalytics',
  /** Get memory statistics */
  GET_STATS: 'advancedMemory:getStats',
  /** Health check for memory system */
  HEALTH: 'advancedMemory:health',
  /** Import memories */
  IMPORT: 'advancedMemory:import',
  /** Recall memories by query */
  RECALL: 'advancedMemory:recall',
  /** Recategorize a memory */
  RECATEGORIZE: 'advancedMemory:recategorize',
  /** Reject a pending memory */
  REJECT: 'advancedMemory:reject',
  /** Reject all pending memories */
  REJECT_ALL: 'advancedMemory:rejectAll',
  /** Store a new memory */
  REMEMBER: 'advancedMemory:remember',
  /** Restore an archived memory */
  RESTORE: 'advancedMemory:restore',
  /** Rollback a memory change */
  ROLLBACK: 'advancedMemory:rollback',
  /** Run memory decay process */
  RUN_DECAY: 'advancedMemory:runDecay',
  /** Search memories */
  SEARCH: 'advancedMemory:search',
  /** Search across all workspaces */
  SEARCH_ACROSS_WORKSPACES: 'advancedMemory:searchAcrossWorkspaces',
  /** Share memory with a workspace */
  SHARE_WITH_WORKSPACE: 'advancedMemory:shareWithWorkspace',
  /** Sync a shared namespace */
  SYNC_SHARED_NAMESPACE: 'advancedMemory:syncSharedNamespace',
} as const;

/** Brain (lightweight memory) channels */
export const BRAIN_CHANNELS = {
  /** Extract knowledge from a message */
  EXTRACT_FROM_MESSAGE: 'brain:extractFromMessage',
  /** Forget a piece of knowledge */
  FORGET: 'brain:forget',
  /** Get knowledge by category */
  GET_BY_CATEGORY: 'brain:getByCategory',
  /** Get contextual knowledge */
  GET_CONTEXT: 'brain:getContext',
  /** Get brain statistics */
  GET_STATS: 'brain:getStats',
  /** Learn new knowledge */
  LEARN: 'brain:learn',
  /** Recall knowledge by query */
  RECALL: 'brain:recall',
  /** Update confidence of a memory */
  UPDATE_CONFIDENCE: 'brain:updateConfidence',
} as const;

// ---------------------------------------------------------------------------
// Database & Data
// ---------------------------------------------------------------------------

/** Database / persistence channels */
export const DB_CHANNELS = {
  /** Archive a chat */
  ARCHIVE_CHAT: 'db:archiveChat',
  /** Clear all chat history */
  CLEAR_HISTORY: 'db:clearHistory',
  /** Create a new chat */
  CREATE_CHAT: 'db:createChat',
  /** Create a chat folder */
  CREATE_FOLDER: 'db:createFolder',
  /** Create a workspace */
  CREATE_WORKSPACE: 'db:createWorkspace',
  /** Create a prompt */
  CREATE_PROMPT: 'db:createPrompt',
  /** Delete a folder */
  DELETE_FOLDER: 'db:deleteFolder',
  /** Delete messages */
  DELETE_MESSAGES: 'db:deleteMessages',
  /** Delete a workspace */
  DELETE_WORKSPACE: 'db:deleteWorkspace',
  /** Delete a prompt */
  DELETE_PROMPT: 'db:deletePrompt',
  /** Favorite a chat */
  FAVORITE_CHAT: 'db:favoriteChat',
  /** Get detailed database stats */
  GET_DETAILED_STATS: 'db:getDetailedStats',
  /** Get all folders */
  GET_FOLDERS: 'db:getFolders',
  /** Get a workspace by ID */
  GET_WORKSPACE_BY_ID: 'db:getWorkspaceById',
  /** Get all workspaces */
  GET_WORKSPACES: 'db:getWorkspaces',
  /** Get all prompts */
  GET_PROMPTS: 'db:getPrompts',
  /** Get provider statistics */
  GET_PROVIDER_STATS: 'db:getProviderStats',
  /** Get usage statistics */
  GET_USAGE_STATS: 'db:getUsageStats',
  /** Move chat to a folder */
  MOVE_CHAT_TO_FOLDER: 'db:moveChatToFolder',
  /** Pin a chat */
  PIN_CHAT: 'db:pinChat',
  /** Record a usage event */
  RECORD_USAGE: 'db:recordUsage',
  /** Search chats */
  SEARCH_CHATS: 'db:searchChats',
  /** Search similar messages by vector */
  SEARCH_SIMILAR_MESSAGES: 'db:searchSimilarMessages',
  /** Update a chat title */
  UPDATE_CHAT_TITLE: 'db:updateChatTitle',
  /** Update a folder */
  UPDATE_FOLDER: 'db:updateFolder',
  /** Update message vector embedding */
  UPDATE_MESSAGE_VECTOR: 'db:updateMessageVector',
  /** Update a workspace */
  UPDATE_WORKSPACE: 'db:updateWorkspace',
  /** Update a prompt */
  UPDATE_PROMPT: 'db:updatePrompt',
} as const;

/** Backup channels */
export const BACKUP_CHANNELS = {
  /** Clean up old backups */
  CLEANUP: 'backup:cleanup',
  /** Configure auto-backup settings */
  CONFIGURE_AUTO_BACKUP: 'backup:configureAutoBackup',
  /** Create a new backup */
  CREATE: 'backup:create',
  /** Create a disaster recovery bundle */
  CREATE_DISASTER_RECOVERY_BUNDLE: 'backup:createDisasterRecoveryBundle',
  /** Delete a backup */
  DELETE: 'backup:delete',
  /** Get auto-backup status */
  GET_AUTO_BACKUP_STATUS: 'backup:getAutoBackupStatus',
  /** Get the backup directory path */
  GET_DIR: 'backup:getDir',
  /** List all backups */
  LIST: 'backup:list',
  /** Restore from a backup */
  RESTORE: 'backup:restore',
  /** Restore from a disaster recovery bundle */
  RESTORE_DISASTER_RECOVERY_BUNDLE: 'backup:restoreDisasterRecoveryBundle',
  /** Sync backups to a cloud directory */
  SYNC_TO_CLOUD_DIR: 'backup:syncToCloudDir',
  /** Verify backup integrity */
  VERIFY: 'backup:verify',
} as const;

/** Migration channels */
export const MIGRATION_CHANNELS = {
  /** Get migration status */
  STATUS: 'migration:status',
} as const;

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

/** Filesystem channels */
export const FILES_CHANNELS = {
  /** Create a directory */
  CREATE_DIRECTORY: 'files:createDirectory',
  /** Delete a directory */
  DELETE_DIRECTORY: 'files:deleteDirectory',
  /** Delete a file */
  DELETE_FILE: 'files:deleteFile',
  /** Check if a path exists */
  EXISTS: 'files:exists',
  /** File system health check */
  HEALTH: 'files:health',
  /** List directory contents */
  LIST_DIRECTORY: 'files:listDirectory',
  /** Read a file */
  READ_FILE: 'files:readFile',
  /** Read an image file as base64 */
  READ_IMAGE: 'files:readImage',
  /** Rename a file or directory */
  RENAME_PATH: 'files:renamePath',
  /** Search for files */
  SEARCH_FILES: 'files:searchFiles',
  /** Search for files with streaming results */
  SEARCH_FILES_STREAM: 'files:searchFilesStream',
  /** Open a native directory picker */
  SELECT_DIRECTORY: 'files:selectDirectory',
  /** Open a native file picker */
  SELECT_FILE: 'files:selectFile',
  /** Write content to a file */
  WRITE_FILE: 'files:writeFile',
} as const;

// ---------------------------------------------------------------------------
// Git
// ---------------------------------------------------------------------------

/** Git operations channels */
export const GIT_CHANNELS = {
  /** Abort an in-progress rebase */
  ABORT_REBASE: 'git:abortRebase',
  /** Add a git submodule */
  ADD_SUBMODULE: 'git:addSubmodule',
  /** Apply a stash entry */
  APPLY_STASH: 'git:applyStash',
  /** Cancel a running git operation */
  CANCEL_OPERATION: 'git:cancelOperation',
  /** Checkout a branch or commit */
  CHECKOUT: 'git:checkout',
  /** Create a commit */
  COMMIT: 'git:commit',
  /** Continue a paused rebase */
  CONTINUE_REBASE: 'git:continueRebase',
  /** Create a stash entry */
  CREATE_STASH: 'git:createStash',
  /** Drop a stash entry */
  DROP_STASH: 'git:dropStash',
  /** Export git hooks */
  EXPORT_HOOKS: 'git:exportHooks',
  /** Export repository statistics */
  EXPORT_REPOSITORY_STATS: 'git:exportRepositoryStats',
  /** Export a stash entry */
  EXPORT_STASH: 'git:exportStash',
  /** Finish a git-flow branch */
  FINISH_FLOW_BRANCH: 'git:finishFlowBranch',
  /** Get blame information for a file */
  GET_BLAME: 'git:getBlame',
  /** Get commit details */
  GET_COMMIT_DETAILS: 'git:getCommitDetails',
  /** Get diff for a commit */
  GET_COMMIT_DIFF: 'git:getCommitDiff',
  /** Get commit statistics */
  GET_COMMIT_STATS: 'git:getCommitStats',
  /** Get merge conflicts */
  GET_CONFLICTS: 'git:getConflicts',
  /** Get detailed working tree status */
  GET_DETAILED_STATUS: 'git:getDetailedStatus',
  /** Get diff statistics */
  GET_DIFF_STATS: 'git:getDiffStats',
  /** Get diff for a specific file */
  GET_FILE_DIFF: 'git:getFileDiff',
  /** Get git-flow status */
  GET_FLOW_STATUS: 'git:getFlowStatus',
  /** Get installed hooks */
  GET_HOOKS: 'git:getHooks',
  /** Get the last commit info */
  GET_LAST_COMMIT: 'git:getLastCommit',
  /** Get the rebase plan */
  GET_REBASE_PLAN: 'git:getRebasePlan',
  /** Get rebase status */
  GET_REBASE_STATUS: 'git:getRebaseStatus',
  /** Get recent commits */
  GET_RECENT_COMMITS: 'git:getRecentCommits',
  /** Get configured remotes */
  GET_REMOTES: 'git:getRemotes',
  /** Get repository statistics */
  GET_REPOSITORY_STATS: 'git:getRepositoryStats',
  /** Get stash entries */
  GET_STASHES: 'git:getStashes',
  /** Get submodule info */
  GET_SUBMODULES: 'git:getSubmodules',
  /** Get tracking info for current branch */
  GET_TRACKING_INFO: 'git:getTrackingInfo',
  /** Get working tree status */
  GET_TREE_STATUS: 'git:getTreeStatus',
  /** Get unified diff */
  GET_UNIFIED_DIFF: 'git:getUnifiedDiff',
  /** Initialize submodules */
  INIT_SUBMODULES: 'git:initSubmodules',
  /** Install a git hook */
  INSTALL_HOOK: 'git:installHook',
  /** Check if path is a git repository */
  IS_REPOSITORY: 'git:isRepository',
  /** Open the merge tool */
  OPEN_MERGE_TOOL: 'git:openMergeTool',
  /** Pull from remote */
  PULL: 'git:pull',
  /** Push to remote */
  PUSH: 'git:push',
  /** Remove a submodule */
  REMOVE_SUBMODULE: 'git:removeSubmodule',
  /** Resolve a merge conflict */
  RESOLVE_CONFLICT: 'git:resolveConflict',
  /** Run a controlled git operation */
  RUN_CONTROLLED_OPERATION: 'git:runControlledOperation',
  /** Stage a file */
  STAGE_FILE: 'git:stageFile',
  /** Start a git-flow branch */
  START_FLOW_BRANCH: 'git:startFlowBranch',
  /** Start an interactive rebase */
  START_REBASE: 'git:startRebase',
  /** Sync submodules */
  SYNC_SUBMODULES: 'git:syncSubmodules',
  /** Test a git hook */
  TEST_HOOK: 'git:testHook',
  /** Unstage a file */
  UNSTAGE_FILE: 'git:unstageFile',
  /** Update submodules */
  UPDATE_SUBMODULES: 'git:updateSubmodules',
  /** Validate a git hook */
  VALIDATE_HOOK: 'git:validateHook',
} as const;

// ---------------------------------------------------------------------------
// Workspace & Workflow
// ---------------------------------------------------------------------------

/** Workspace agent orchestration channels */
export const WORKSPACE_AGENT_CHANNELS = {
  /** Add a comment to a plan step */
  ADD_STEP_COMMENT: 'agent:add-step-comment',
  /** Approve the current plan */
  APPROVE_CURRENT_PLAN: 'agent:approve-current-plan',
  /** Approve a specific step */
  APPROVE_STEP: 'agent:approve-step',
  /** Council: approve a proposal */
  COUNCIL_APPROVE_PROPOSAL: 'agent:council-approve-proposal',
  /** Council: clean up expired messages */
  COUNCIL_CLEANUP_EXPIRED_MESSAGES: 'agent:council-cleanup-expired-messages',
  /** Council: generate helper handoff */
  COUNCIL_GENERATE_HELPER_HANDOFF: 'agent:council-generate-helper-handoff',
  /** Council: generate a plan */
  COUNCIL_GENERATE_PLAN: 'agent:council-generate-plan',
  /** Council: get messages */
  COUNCIL_GET_MESSAGES: 'agent:council-get-messages',
  /** Council: get a proposal */
  COUNCIL_GET_PROPOSAL: 'agent:council-get-proposal',
  /** Council: get execution timeline */
  COUNCIL_GET_TIMELINE: 'agent:council-get-timeline',
  /** Council: handle quota interrupt */
  COUNCIL_HANDLE_QUOTA_INTERRUPT: 'agent:council-handle-quota-interrupt',
  /** Council: list available workers */
  COUNCIL_LIST_AVAILABLE_WORKERS: 'agent:council-list-available-workers',
  /** Council: pause execution */
  COUNCIL_PAUSE_EXECUTION: 'agent:council-pause-execution',
  /** Council: register worker availability */
  COUNCIL_REGISTER_WORKER_AVAILABILITY: 'agent:council-register-worker-availability',
  /** Council: reject a proposal */
  COUNCIL_REJECT_PROPOSAL: 'agent:council-reject-proposal',
  /** Council: resume execution */
  COUNCIL_RESUME_EXECUTION: 'agent:council-resume-execution',
  /** Council: review helper merge */
  COUNCIL_REVIEW_HELPER_MERGE: 'agent:council-review-helper-merge',
  /** Council: score helper candidates */
  COUNCIL_SCORE_HELPER_CANDIDATES: 'agent:council-score-helper-candidates',
  /** Council: send a message */
  COUNCIL_SEND_MESSAGE: 'agent:council-send-message',
  /** Council: start execution */
  COUNCIL_START_EXECUTION: 'agent:council-start-execution',
  /** Create a pull request */
  CREATE_PR: 'agent:create-pr',
  /** Delete a canvas edge */
  DELETE_CANVAS_EDGE: 'agent:delete-canvas-edge',
  /** Delete a canvas node */
  DELETE_CANVAS_NODE: 'agent:delete-canvas-node',
  /** Delete an agent profile */
  DELETE_PROFILE: 'agent:delete-profile',
  /** Delete a task */
  DELETE_TASK: 'agent:delete-task',
  /** Delete a task by canvas node */
  DELETE_TASK_BY_NODE: 'agent:delete-task-by-node',
  /** Delete a template */
  DELETE_TEMPLATE: 'agent:delete-template',
  /** Edit a plan step */
  EDIT_STEP: 'agent:edit-step',
  /** Export a template */
  EXPORT_TEMPLATE: 'agent:export-template',
  /** Generate a debate summary */
  GENERATE_DEBATE_SUMMARY: 'agent:generate-debate-summary',
  /** Get available models for agent */
  GET_AVAILABLE_MODELS: 'agent:get-available-models',
  /** Get canvas edges */
  GET_CANVAS_EDGES: 'agent:get-canvas-edges',
  /** Get canvas nodes */
  GET_CANVAS_NODES: 'agent:get-canvas-nodes',
  /** Get agent checkpoints */
  GET_CHECKPOINTS: 'agent:get-checkpoints',
  /** Get debate replay data */
  GET_DEBATE_REPLAY: 'agent:get-debate-replay',
  /** Get a debate session */
  GET_DEBATE_SESSION: 'agent:get-debate-session',
  /** Get agent events */
  GET_EVENTS: 'agent:get-events',
  /** Get agent messages */
  GET_MESSAGES: 'agent:get-messages',
  /** Get performance metrics */
  GET_PERFORMANCE_METRICS: 'agent:get-performance-metrics',
  /** Get plan version history */
  GET_PLAN_VERSIONS: 'agent:get-plan-versions',
  /** Get registered profiles */
  GET_PROFILES: 'agent:get-profiles',
  /** Get routing rules */
  GET_ROUTING_RULES: 'agent:get-routing-rules',
  /** Get agent status */
  GET_STATUS: 'agent:get-status',
  /** Get task history */
  GET_TASK_HISTORY: 'agent:get-task-history',
  /** Get teamwork analytics */
  GET_TEAMWORK_ANALYTICS: 'agent:get-teamwork-analytics',
  /** Get telemetry data */
  GET_TELEMETRY: 'agent:get-telemetry',
  /** Get a specific template */
  GET_TEMPLATE: 'agent:get-template',
  /** Get all templates */
  GET_TEMPLATES: 'agent:get-templates',
  /** Get voting analytics */
  GET_VOTING_ANALYTICS: 'agent:get-voting-analytics',
  /** Get voting configuration */
  GET_VOTING_CONFIG: 'agent:get-voting-config',
  /** Get a voting session */
  GET_VOTING_SESSION: 'agent:get-voting-session',
  /** Health check for agent system */
  HEALTH: 'agent:health',
  /** Import a template */
  IMPORT_TEMPLATE: 'agent:import-template',
  /** Insert a human intervention */
  INSERT_INTERVENTION: 'agent:insert-intervention',
  /** List debate history */
  LIST_DEBATE_HISTORY: 'agent:list-debate-history',
  /** List voting sessions */
  LIST_VOTING_SESSIONS: 'agent:list-voting-sessions',
  /** List voting templates */
  LIST_VOTING_TEMPLATES: 'agent:list-voting-templates',
  /** Override a debate session */
  OVERRIDE_DEBATE_SESSION: 'agent:override-debate-session',
  /** Override voting outcome */
  OVERRIDE_VOTING: 'agent:override-voting',
  /** Pause a running task */
  PAUSE_TASK: 'agent:pause-task',
  /** Generate an agent plan */
  PLAN: 'agent:plan',
  /** Register a new profile */
  REGISTER_PROFILE: 'agent:register-profile',
  /** Reject the current plan */
  REJECT_CURRENT_PLAN: 'agent:reject-current-plan',
  /** Reset agent state */
  RESET_STATE: 'agent:reset-state',
  /** Resolve a debate session */
  RESOLVE_DEBATE_SESSION: 'agent:resolve-debate-session',
  /** Resolve voting */
  RESOLVE_VOTING: 'agent:resolve-voting',
  /** Resume from a checkpoint */
  RESUME_CHECKPOINT: 'agent:resume-checkpoint',
  /** Resume a paused task */
  RESUME_TASK: 'agent:resume-task',
  /** Retry a failed step */
  RETRY_STEP: 'agent:retry-step',
  /** Rollback to a checkpoint */
  ROLLBACK_CHECKPOINT: 'agent:rollback-checkpoint',
  /** Save canvas edges */
  SAVE_CANVAS_EDGES: 'agent:save-canvas-edges',
  /** Save canvas nodes */
  SAVE_CANVAS_NODES: 'agent:save-canvas-nodes',
  /** Save an agent snapshot */
  SAVE_SNAPSHOT: 'agent:save-snapshot',
  /** Save a template */
  SAVE_TEMPLATE: 'agent:save-template',
  /** Select a model for the agent */
  SELECT_MODEL: 'agent:select-model',
  /** Set routing rules */
  SET_ROUTING_RULES: 'agent:set-routing-rules',
  /** Skip a plan step */
  SKIP_STEP: 'agent:skip-step',
  /** Start agent execution */
  START: 'agent:start',
  /** Stop agent execution */
  STOP: 'agent:stop',
  /** Update voting configuration */
  UPDATE_VOTING_CONFIG: 'agent:update-voting-config',
} as const;

/** Workflow automation channels */
export const WORKFLOW_CHANNELS = {
  /** Create a workflow */
  CREATE: 'workflow:create',
  /** Delete a workflow */
  DELETE: 'workflow:delete',
  /** Execute a workflow */
  EXECUTE: 'workflow:execute',
  /** Get a workflow by ID */
  GET: 'workflow:get',
  /** Get all workflows */
  GET_ALL: 'workflow:getAll',
  /** Trigger a manual workflow run */
  TRIGGER_MANUAL: 'workflow:triggerManual',
  /** Update a workflow */
  UPDATE: 'workflow:update',
} as const;

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

/** Agent management channels */
export const AGENT_CHANNELS = {
  /** Clone an agent */
  CLONE: 'agent:clone',
  /** Create a new agent */
  CREATE: 'agent:create',
  /** Delete an agent */
  DELETE: 'agent:delete',
  /** Export agent configuration */
  EXPORT: 'agent:export',
  /** Get an agent by ID */
  GET: 'agent:get',
  /** Get all agents */
  GET_ALL: 'agent:get-all',
  /** Get the agent templates library */
  GET_TEMPLATES_LIBRARY: 'agent:get-templates-library',
  /** Import an agent configuration */
  IMPORT: 'agent:import',
  /** Recover a deleted agent */
  RECOVER: 'agent:recover',
  /** Validate an agent template */
  VALIDATE_TEMPLATE: 'agent:validate-template',
} as const;

// ---------------------------------------------------------------------------
// Settings & Theme
// ---------------------------------------------------------------------------

/** Settings channels */
export const SETTINGS_CHANNELS = {
  /** Get application settings */
  GET: 'settings:get',
  /** Health check for settings */
  HEALTH: 'settings:health',
  /** Save application settings */
  SAVE: 'settings:save',
} as const;

/** Theme channels */
export const THEME_CHANNELS = {
  /** Add a custom theme */
  ADD_CUSTOM: 'theme:addCustom',
  /** Apply a theme preset */
  APPLY_PRESET: 'theme:applyPreset',
  /** Clear theme history */
  CLEAR_HISTORY: 'theme:clearHistory',
  /** Clear current preset */
  CLEAR_PRESET: 'theme:clearPreset',
  /** Delete a custom theme */
  DELETE_CUSTOM: 'theme:deleteCustom',
  /** Duplicate a theme */
  DUPLICATE: 'theme:duplicate',
  /** Export a theme */
  EXPORT: 'theme:export',
  /** Get all themes */
  GET_ALL: 'theme:getAll',
  /** Get the current theme */
  GET_CURRENT: 'theme:getCurrent',
  /** Get the current preset */
  GET_CURRENT_PRESET: 'theme:getCurrentPreset',
  /** Get custom themes */
  GET_CUSTOM: 'theme:getCustom',
  /** Get theme details */
  GET_DETAILS: 'theme:getDetails',
  /** Get favorite themes */
  GET_FAVORITES: 'theme:getFavorites',
  /** Get theme history */
  GET_HISTORY: 'theme:getHistory',
  /** Get theme presets */
  GET_PRESETS: 'theme:getPresets',
  /** Import a theme */
  IMPORT: 'theme:import',
  /** Check if theme is a favorite */
  IS_FAVORITE: 'theme:isFavorite',
  /** Get all runtime themes */
  RUNTIME_GET_ALL: 'theme:runtime:getAll',
  /** Install a runtime theme */
  RUNTIME_INSTALL: 'theme:runtime:install',
  /** Open runtime themes directory */
  RUNTIME_OPEN_DIRECTORY: 'theme:runtime:openDirectory',
  /** Uninstall a runtime theme */
  RUNTIME_UNINSTALL: 'theme:runtime:uninstall',
  /** Set the active theme */
  SET: 'theme:set',
  /** Toggle theme favorite status */
  TOGGLE_FAVORITE: 'theme:toggleFavorite',
  /** Update a custom theme */
  UPDATE_CUSTOM: 'theme:updateCustom',
} as const;

// ---------------------------------------------------------------------------
// Process & Terminal
// ---------------------------------------------------------------------------

/** Process management channels */
export const PROCESS_CHANNELS = {
  /** Kill a running process */
  KILL: 'process:kill',
  /** List running processes */
  LIST: 'process:list',
  /** Resize a terminal process */
  RESIZE: 'process:resize',
  /** Scan for available scripts */
  SCAN_SCRIPTS: 'process:scan-scripts',
  /** Spawn a new process */
  SPAWN: 'process:spawn',
  /** Write to a process stdin */
  WRITE: 'process:write',
} as const;

// ---------------------------------------------------------------------------
// Proxy & Usage
// ---------------------------------------------------------------------------

/** Proxy and provider channels */
export const PROXY_CHANNELS = {
  /** Login to Anthropic */
  ANTHROPIC_LOGIN: 'proxy:anthropicLogin',
  /** Login to Antigravity */
  ANTIGRAVITY_LOGIN: 'proxy:antigravityLogin',
  /** Login to Claude */
  CLAUDE_LOGIN: 'proxy:claudeLogin',
  /** Login to Codex */
  CODEX_LOGIN: 'proxy:codexLogin',
  /** Delete a stored auth file */
  DELETE_AUTH_FILE: 'proxy:deleteAuthFile',
  /** Download an auth file */
  DOWNLOAD_AUTH_FILE: 'proxy:downloadAuthFile',
  /** Get rate limit configuration */
  GET_RATE_LIMIT_CONFIG: 'proxy:get-rate-limit-config',
  /** Get rate limit metrics */
  GET_RATE_LIMIT_METRICS: 'proxy:get-rate-limit-metrics',
  /** Get Claude quota */
  GET_CLAUDE_QUOTA: 'proxy:getClaudeQuota',
  /** Get Codex usage */
  GET_CODEX_USAGE: 'proxy:getCodexUsage',
  /** Get Copilot quota */
  GET_COPILOT_QUOTA: 'proxy:getCopilotQuota',
  /** Get available models from proxy */
  GET_MODELS: 'proxy:getModels',
  /** Get general quota info */
  GET_QUOTA: 'proxy:getQuota',
  /** Save a Claude session */
  SAVE_CLAUDE_SESSION: 'proxy:saveClaudeSession',
  /** Set rate limit configuration */
  SET_RATE_LIMIT_CONFIG: 'proxy:set-rate-limit-config',
  /** Sync auth files across devices */
  SYNC_AUTH_FILES: 'proxy:syncAuthFiles',
} as const;

/** Usage tracking channels */
export const USAGE_CHANNELS = {
  /** Check if a usage limit is reached */
  CHECK_LIMIT: 'usage:checkLimit',
  /** Get the current usage count */
  GET_USAGE_COUNT: 'usage:getUsageCount',
  /** Record a usage event */
  RECORD_USAGE: 'usage:recordUsage',
} as const;

// ---------------------------------------------------------------------------
// MCP (Model Context Protocol)
// ---------------------------------------------------------------------------

/** MCP plugin system channels */
export const MCP_CHANNELS = {
  /** Get debug metrics */
  DEBUG_METRICS: 'mcp:debug-metrics',
  /** Dispatch a tool call to an MCP server */
  DISPATCH: 'mcp:dispatch',
  /** Install an MCP server */
  INSTALL: 'mcp:install',
  /** List installed MCP servers */
  LIST: 'mcp:list',
  /** Toggle an MCP server on/off */
  TOGGLE: 'mcp:toggle',
  /** Uninstall an MCP server */
  UNINSTALL: 'mcp:uninstall',
} as const;

/** MCP marketplace channels */
export const MCP_MARKETPLACE_CHANNELS = {
  /** Get marketplace categories */
  CATEGORIES: 'mcp:marketplace:categories',
  /** Debug marketplace state */
  DEBUG: 'mcp:marketplace:debug',
  /** Draft a new extension */
  DRAFT_EXTENSION: 'mcp:marketplace:draft-extension',
  /** Get extension templates */
  EXTENSION_TEMPLATES: 'mcp:marketplace:extension-templates',
  /** Filter marketplace listings */
  FILTER: 'mcp:marketplace:filter',
  /** Marketplace health check */
  HEALTH: 'mcp:marketplace:health',
  /** Install from marketplace */
  INSTALL: 'mcp:marketplace:install',
  /** List installed marketplace extensions */
  INSTALLED: 'mcp:marketplace:installed',
  /** List marketplace extensions */
  LIST: 'mcp:marketplace:list',
  /** Refresh marketplace data */
  REFRESH: 'mcp:marketplace:refresh',
  /** List reviews for an extension */
  REVIEWS_LIST: 'mcp:marketplace:reviews:list',
  /** Moderate a review */
  REVIEWS_MODERATE: 'mcp:marketplace:reviews:moderate',
  /** Submit a review */
  REVIEWS_SUBMIT: 'mcp:marketplace:reviews:submit',
  /** Vote on a review */
  REVIEWS_VOTE: 'mcp:marketplace:reviews:vote',
  /** Rollback to a previous version */
  ROLLBACK_VERSION: 'mcp:marketplace:rollback-version',
  /** Search the marketplace */
  SEARCH: 'mcp:marketplace:search',
  /** Run a security scan on an extension */
  SECURITY_SCAN: 'mcp:marketplace:security-scan',
  /** Report a crash event */
  TELEMETRY_CRASH: 'mcp:marketplace:telemetry:crash',
  /** Get telemetry summary */
  TELEMETRY_SUMMARY: 'mcp:marketplace:telemetry:summary',
  /** Track a telemetry event */
  TELEMETRY_TRACK: 'mcp:marketplace:telemetry:track',
  /** Toggle a marketplace extension */
  TOGGLE: 'mcp:marketplace:toggle',
  /** Uninstall a marketplace extension */
  UNINSTALL: 'mcp:marketplace:uninstall',
  /** Update extension config */
  UPDATE_CONFIG: 'mcp:marketplace:update-config',
  /** View version history */
  VERSION_HISTORY: 'mcp:marketplace:version-history',
} as const;

/** MCP permissions channels */
export const MCP_PERMISSIONS_CHANNELS = {
  /** List pending permission requests */
  LIST_REQUESTS: 'mcp:permissions:list-requests',
  /** Resolve a permission request */
  RESOLVE_REQUEST: 'mcp:permissions:resolve-request',
  /** Set permissions for an MCP server */
  SET: 'mcp:permissions:set',
} as const;

// ---------------------------------------------------------------------------
// Hugging Face
// ---------------------------------------------------------------------------

/** Hugging Face integration channels */
export const HF_CHANNELS = {
  /** Clear download cache */
  CACHE_CLEAR: 'hf:cache-clear',
  /** Get cache statistics */
  CACHE_STATS: 'hf:cache-stats',
  /** Cancel an active download */
  CANCEL_DOWNLOAD: 'hf:cancel-download',
  /** Compare two models */
  COMPARE_MODELS: 'hf:compare-models',
  /** Convert a model format */
  CONVERT_MODEL: 'hf:convert-model',
  /** Download a specific file */
  DOWNLOAD_FILE: 'hf:download-file',
  /** Get conversion presets */
  GET_CONVERSION_PRESETS: 'hf:get-conversion-presets',
  /** Get model files */
  GET_FILES: 'hf:get-files',
  /** Get model preview data */
  GET_MODEL_PREVIEW: 'hf:get-model-preview',
  /** Get optimization suggestions */
  GET_OPTIMIZATION_SUGGESTIONS: 'hf:get-optimization-suggestions',
  /** Get model recommendations */
  GET_RECOMMENDATIONS: 'hf:get-recommendations',
  /** Search for models */
  SEARCH_MODELS: 'hf:search-models',
  /** Test a downloaded model */
  TEST_DOWNLOADED_MODEL: 'hf:test-downloaded-model',
  /** Validate hardware compatibility */
  VALIDATE_COMPATIBILITY: 'hf:validate-compatibility',
  /** Validate model conversion */
  VALIDATE_CONVERSION: 'hf:validate-conversion',
} as const;

/** Hugging Face fine-tuning channels */
export const HF_FINETUNE_CHANNELS = {
  /** Cancel a fine-tuning job */
  CANCEL: 'hf:finetune:cancel',
  /** Evaluate a fine-tuned model */
  EVALUATE: 'hf:finetune:evaluate',
  /** Export a fine-tuned model */
  EXPORT: 'hf:finetune:export',
  /** Get fine-tuning job details */
  GET: 'hf:finetune:get',
  /** List fine-tuning jobs */
  LIST: 'hf:finetune:list',
  /** Prepare a dataset for fine-tuning */
  PREPARE_DATASET: 'hf:finetune:prepare-dataset',
  /** Start a fine-tuning job */
  START: 'hf:finetune:start',
} as const;

/** Hugging Face version management channels */
export const HF_VERSIONS_CHANNELS = {
  /** Compare two versions */
  COMPARE: 'hf:versions:compare',
  /** List available versions */
  LIST: 'hf:versions:list',
  /** Get version notifications */
  NOTIFICATIONS: 'hf:versions:notifications',
  /** Pin a specific version */
  PIN: 'hf:versions:pin',
  /** Register a version */
  REGISTER: 'hf:versions:register',
  /** Rollback to a previous version */
  ROLLBACK: 'hf:versions:rollback',
} as const;

/** Hugging Face watchlist channels */
export const HF_WATCHLIST_CHANNELS = {
  /** Add a model to the watchlist */
  ADD: 'hf:watchlist:add',
  /** Get the watchlist */
  GET: 'hf:watchlist:get',
  /** Remove a model from the watchlist */
  REMOVE: 'hf:watchlist:remove',
} as const;

// ---------------------------------------------------------------------------
// Stable Diffusion (sd-cpp)
// ---------------------------------------------------------------------------

/** Stable Diffusion C++ integration channels */
export const SD_CPP_CHANNELS = {
  /** Generate images in batch */
  BATCH_GENERATE: 'sd-cpp:batchGenerate',
  /** Cancel a scheduled generation */
  CANCEL_SCHEDULE: 'sd-cpp:cancelSchedule',
  /** Compare generated images */
  COMPARE: 'sd-cpp:compare',
  /** Delete a preset */
  DELETE_PRESET: 'sd-cpp:deletePreset',
  /** Delete a workflow template */
  DELETE_WORKFLOW_TEMPLATE: 'sd-cpp:deleteWorkflowTemplate',
  /** Edit an image */
  EDIT: 'sd-cpp:edit',
  /** Export a comparison */
  EXPORT_COMPARISON: 'sd-cpp:exportComparison',
  /** Export generation history */
  EXPORT_HISTORY: 'sd-cpp:exportHistory',
  /** Export a preset for sharing */
  EXPORT_PRESET_SHARE: 'sd-cpp:exportPresetShare',
  /** Export a workflow template for sharing */
  EXPORT_WORKFLOW_TEMPLATE_SHARE: 'sd-cpp:exportWorkflowTemplateShare',
  /** Get generation analytics */
  GET_ANALYTICS: 'sd-cpp:getAnalytics',
  /** Get generation history */
  GET_HISTORY: 'sd-cpp:getHistory',
  /** Get preset analytics */
  GET_PRESET_ANALYTICS: 'sd-cpp:getPresetAnalytics',
  /** Get generation queue stats */
  GET_QUEUE_STATS: 'sd-cpp:getQueueStats',
  /** Get schedule analytics */
  GET_SCHEDULE_ANALYTICS: 'sd-cpp:getScheduleAnalytics',
  /** Get service status */
  GET_STATUS: 'sd-cpp:getStatus',
  /** Import a preset from share data */
  IMPORT_PRESET_SHARE: 'sd-cpp:importPresetShare',
  /** Import a workflow template from share data */
  IMPORT_WORKFLOW_TEMPLATE_SHARE: 'sd-cpp:importWorkflowTemplateShare',
  /** List presets */
  LIST_PRESETS: 'sd-cpp:listPresets',
  /** List scheduled generations */
  LIST_SCHEDULES: 'sd-cpp:listSchedules',
  /** List workflow templates */
  LIST_WORKFLOW_TEMPLATES: 'sd-cpp:listWorkflowTemplates',
  /** Regenerate with same settings */
  REGENERATE: 'sd-cpp:regenerate',
  /** Reinstall SD-CPP */
  REINSTALL: 'sd-cpp:reinstall',
  /** Save a preset */
  SAVE_PRESET: 'sd-cpp:savePreset',
  /** Save a workflow template */
  SAVE_WORKFLOW_TEMPLATE: 'sd-cpp:saveWorkflowTemplate',
  /** Schedule a generation */
  SCHEDULE: 'sd-cpp:schedule',
  /** Search generation history */
  SEARCH_HISTORY: 'sd-cpp:searchHistory',
  /** Share a comparison */
  SHARE_COMPARISON: 'sd-cpp:shareComparison',
} as const;

/** Image gallery channels */
export const GALLERY_CHANNELS = {
  /** Batch download gallery images */
  BATCH_DOWNLOAD: 'gallery:batch-download',
  /** Delete a gallery image */
  DELETE: 'gallery:delete',
  /** List gallery images */
  LIST: 'gallery:list',
  /** Open a gallery image */
  OPEN: 'gallery:open',
  /** Reveal image in file explorer */
  REVEAL: 'gallery:reveal',
} as const;

// ---------------------------------------------------------------------------
// Code Intelligence
// ---------------------------------------------------------------------------

/** Code analysis and intelligence channels */
export const CODE_CHANNELS = {
  /** Analyze code quality */
  ANALYZE_QUALITY: 'code:analyzeQuality',
  /** Apply a rename symbol refactoring */
  APPLY_RENAME_SYMBOL: 'code:applyRenameSymbol',
  /** Find symbol definitions */
  FIND_DEFINITION: 'code:findDefinition',
  /** Find implementations of a symbol */
  FIND_IMPLEMENTATIONS: 'code:findImplementations',
  /** Find references to a symbol */
  FIND_REFERENCES: 'code:findReferences',
  /** Find symbols in a file or workspace */
  FIND_SYMBOLS: 'code:findSymbols',
  /** Find usages of a symbol */
  FIND_USAGE: 'code:findUsage',
  /** Generate documentation for a file */
  GENERATE_FILE_DOCUMENTATION: 'code:generateFileDocumentation',
  /** Generate workspace-wide documentation */
  GENERATE_WORKSPACE_DOCUMENTATION: 'code:generateWorkspaceDocumentation',
  /** Get an outline of a file */
  GET_FILE_OUTLINE: 'code:getFileOutline',
  /** Get symbol analytics */
  GET_SYMBOL_ANALYTICS: 'code:getSymbolAnalytics',
  /** Get relationships between symbols */
  GET_SYMBOL_RELATIONSHIPS: 'code:getSymbolRelationships',
  /** Index the workspace for code intelligence */
  INDEX_WORKSPACE: 'code:indexWorkspace',
  /** Preview a rename symbol refactoring */
  PREVIEW_RENAME_SYMBOL: 'code:previewRenameSymbol',
  /** Query indexed symbols */
  QUERY_INDEXED_SYMBOLS: 'code:queryIndexedSymbols',
  /** Query symbols */
  QUERY_SYMBOLS: 'code:querySymbols',
  /** Scan for TODO/FIXME comments */
  SCAN_TODOS: 'code:scanTodos',
  /** Search for files */
  SEARCH_FILES: 'code:searchFiles',
} as const;

// ---------------------------------------------------------------------------
// Prompt Templates
// ---------------------------------------------------------------------------

/** Prompt template channels */
export const PROMPT_TEMPLATES_CHANNELS = {
  /** Create a new prompt template */
  CREATE: 'prompt-templates:create',
  /** Delete a prompt template */
  DELETE: 'prompt-templates:delete',
  /** Get a prompt template by ID */
  GET: 'prompt-templates:get',
  /** Get all prompt templates */
  GET_ALL: 'prompt-templates:getAll',
  /** Get templates by category */
  GET_BY_CATEGORY: 'prompt-templates:getByCategory',
  /** Get templates by tag */
  GET_BY_TAG: 'prompt-templates:getByTag',
  /** Get all categories */
  GET_CATEGORIES: 'prompt-templates:getCategories',
  /** Get all tags */
  GET_TAGS: 'prompt-templates:getTags',
  /** Render a template with variables */
  RENDER: 'prompt-templates:render',
  /** Search prompt templates */
  SEARCH: 'prompt-templates:search',
  /** Update a prompt template */
  UPDATE: 'prompt-templates:update',
} as const;

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

/** Tool execution channels */
export const TOOLS_CHANNELS = {
  /** Execute a tool */
  EXECUTE: 'tools:execute',
  /** Get tool definitions */
  GET_DEFINITIONS: 'tools:getDefinitions',
  /** Kill a running tool */
  KILL: 'tools:kill',
} as const;

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

/** Log channels */
export const LOG_CHANNELS = {
  /** Clear the log buffer */
  BUFFER_CLEAR: 'log:buffer:clear',
  /** Get buffered log entries */
  BUFFER_GET: 'log:buffer:get',
  /** Start log streaming */
  STREAM_START: 'log:stream:start',
  /** Stop log streaming */
  STREAM_STOP: 'log:stream:stop',
  /** Write a log entry */
  WRITE: 'log:write',
} as const;

// ---------------------------------------------------------------------------
// Lazy Loading
// ---------------------------------------------------------------------------

/** Lazy loading channels */
export const LAZY_CHANNELS = {
  /** Get lazy loading status */
  GET_STATUS: 'lazy:get-status',
} as const;

// ---------------------------------------------------------------------------
// Aggregate export
// ---------------------------------------------------------------------------

/** All IPC channels grouped by domain */
export const IPC_CHANNELS = {
  ADVANCED_MEMORY: ADVANCED_MEMORY_CHANNELS,
  AGENT: AGENT_CHANNELS,
  APP: APP_CHANNELS,
  AUDIT: AUDIT_CHANNELS,
  AUTH: AUTH_CHANNELS,
  BACKUP: BACKUP_CHANNELS,
  BRAIN: BRAIN_CHANNELS,
  CHAT: CHAT_CHANNELS,
  CODE: CODE_CHANNELS,
  COLLABORATION: COLLABORATION_CHANNELS,
  CONTEXT_WINDOW: CONTEXT_WINDOW_CHANNELS,
  DB: DB_CHANNELS,
  FILES: FILES_CHANNELS,
  GALLERY: GALLERY_CHANNELS,
  GIT: GIT_CHANNELS,
  HEALTH: HEALTH_CHANNELS,
  HF: HF_CHANNELS,
  HF_FINETUNE: HF_FINETUNE_CHANNELS,
  HF_VERSIONS: HF_VERSIONS_CHANNELS,
  HF_WATCHLIST: HF_WATCHLIST_CHANNELS,
  KEY_ROTATION: KEY_ROTATION_CHANNELS,
  LAZY: LAZY_CHANNELS,
  LOG: LOG_CHANNELS,
  MCP: MCP_CHANNELS,
  MCP_MARKETPLACE: MCP_MARKETPLACE_CHANNELS,
  MCP_PERMISSIONS: MCP_PERMISSIONS_CHANNELS,
  MIGRATION: MIGRATION_CHANNELS,
  MODEL_REGISTRY: MODEL_REGISTRY_CHANNELS,
  OLLAMA: OLLAMA_CHANNELS,
  PROCESS: PROCESS_CHANNELS,
  WORKSPACE_AGENT: WORKSPACE_AGENT_CHANNELS,
  PROMPT_TEMPLATES: PROMPT_TEMPLATES_CHANNELS,
  PROXY: PROXY_CHANNELS,
  SD_CPP: SD_CPP_CHANNELS,
  SETTINGS: SETTINGS_CHANNELS,
  SHELL: SHELL_CHANNELS,
  THEME: THEME_CHANNELS,
  TOKEN_ESTIMATION: TOKEN_ESTIMATION_CHANNELS,
  TOOLS: TOOLS_CHANNELS,
  USAGE: USAGE_CHANNELS,
  WINDOW: WINDOW_CHANNELS,
  WORKFLOW: WORKFLOW_CHANNELS,
} as const;

/** Union type of all IPC channel name strings */
export type IpcChannelName = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS][keyof typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS]];

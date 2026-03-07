/**
 * Size, buffer, and iteration limits used throughout the application.
 * Centralizing these values prevents inconsistencies and makes tuning easier.
 */

/** File and buffer size limits (in bytes unless specified) */
export const SIZE_LIMITS = {
    /** Maximum log file size (10MB) */
    MAX_LOG_SIZE: 10 * 1024 * 1024,
    /** Maximum file size for reading (10MB) */
    MAX_FILE_SIZE: 10 * 1024 * 1024,
    /** Maximum image file size (20MB) */
    MAX_IMAGE_SIZE: 20 * 1024 * 1024,
    /** Terminal buffer size (1MB) */
    TERMINAL_BUFFER: 1024 * 1024,
    /** Memory soft limit (4GB in MB) */
    MEMORY_SOFT_LIMIT_MB: 4096,
} as const;

/** Entry and record limits */
export const ENTRY_LIMITS = {
    /** Maximum log entries */
    MAX_LOG_ENTRIES: 10000,
    /** Maximum analytics records */
    MAX_ANALYTICS_RECORDS: 10000,
    /** Maximum metrics data points */
    MAX_METRICS_POINTS: 1000,
    /** Maximum model fallback history */
    MAX_FALLBACK_HISTORY: 1000,
    /** Maximum telemetry queue size */
    MAX_TELEMETRY_QUEUE: 1000,
    /** Maximum command length */
    MAX_COMMAND_LENGTH: 10000,
} as const;

/** Iteration and safety limits */
export const ITERATION_LIMITS = {
    /** Maximum process iterations for chat queue */
    CHAT_QUEUE_MAX_ITERATIONS: 10000,
    /** Maximum agent council session iterations */
    COUNCIL_MAX_ITERATIONS: 20,
    /** Maximum wait iterations for rate limiting */
    RATE_LIMIT_MAX_WAIT: 100,
    /** Maximum retry attempts */
    MAX_RETRIES: 3,
    /** Queue iteration limit for chat stream */
    STREAM_QUEUE_ITERATIONS: 1000,
} as const;

/** Display and slice limits */
export const DISPLAY_LIMITS = {
    /** Recent chats to display in sidebar */
    RECENT_CHATS: 20,
    /** Commands to show in command palette */
    COMMAND_PALETTE_ITEMS: 5,
    /** Prompts to show in dropdown */
    PROMPTS_DROPDOWN: 5,
    /** Tool output preview lines */
    TOOL_OUTPUT_LINES: 6,
    /** Files to show in workspace dashboard */
    WORKSPACE_FILES: 15,
    /** Model explorer results */
    MODEL_EXPLORER_RESULTS: 12,
    /** Tags to display per item */
    TAGS_DISPLAY: 4,
    /** Scripts to show in folder inspector */
    SCRIPTS_DISPLAY: 5,
    /** Dependencies to show in folder inspector */
    DEPENDENCIES_DISPLAY: 8,
    /** Top issues to show in PageSpeed */
    TOP_ISSUES: 5,
    /** Top objects in memory profiling */
    TOP_OBJECTS: 10,
    /** Top leaks in memory profiling */
    TOP_LEAKS: 5,
    /** Top results in analytics */
    TOP_RESULTS: 10,
    /** Git log preview limit */
    GIT_LOG_PREVIEW: 3,
    /** Token batch limit for auth */
    TOKEN_BATCH: 100,
} as const;

/** Content and text limits */
export const CONTENT_LIMITS = {
    /** Maximum content length for processing */
    MAX_CONTENT_LENGTH: 15000,
    /** Chunk size for content processing */
    CONTENT_CHUNK_SIZE: 1000,
    /** Scanner chunk size */
    SCANNER_CHUNK_SIZE: 1000,
    /** Scanner overlap size */
    SCANNER_OVERLAP: 200,
    /** Chat title maximum length */
    CHAT_TITLE_MAX_LENGTH: 50,
    /** Session title maximum length */
    SESSION_TITLE_MAX_LENGTH: 50,
    /** Agent tool output slice limit */
    TOOL_OUTPUT_SLICE: 500,
    /** README preview length */
    README_PREVIEW_LENGTH: 500,
    /** Git diff truncation limit */
    GIT_DIFF_TRUNCATION: 8000,
    /** Diff slice display limit */
    DIFF_SLICE_DISPLAY: 2000,
    /** Line limit for code snippets */
    CODE_SNIPPET_LINES: 10,
    /** Code files slice limit */
    CODE_FILES_SLICE: 100,
    /** Workspace file list limit for IPC */
    WORKSPACE_FILE_LIST: 1000,
    /** Context retrieval symbols limit */
    CONTEXT_SYMBOLS: 3,
    /** Model cache fetch limit */
    MODEL_CACHE_FETCH: 50,
    /** Minimum word length for filtering */
    MIN_WORD_LENGTH: 3,
} as const;

/** Terminal limits */
export const TERMINAL_LIMITS = {
    /** Scrollback buffer lines */
    SCROLLBACK_BUFFER: 10000,
    /** Safe fit delay for terminal resize */
    SAFE_FIT_DELAY: 100,
} as const;

/** Snapshot and retention limits */
export const RETENTION_LIMITS = {
    /** Terminal snapshot retention (7 days in ms) */
    TERMINAL_SNAPSHOT_RETENTION: 7 * 24 * 60 * 60 * 1000,
} as const;

/** Depth limits for recursive operations */
export const DEPTH_LIMITS = {
    /** Maximum recursion depth */
    MAX_DEPTH: 4,
} as const;

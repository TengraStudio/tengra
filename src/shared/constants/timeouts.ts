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
 * Timeout constants used throughout the application (in milliseconds).
 * Centralizing these values makes it easier to tune performance and maintain consistency.
 */

/** UI feedback timeouts */
export const FEEDBACK_TIMEOUTS = {
    /** Duration to show copy confirmation feedback */
    COPY_FEEDBACK: 2000,
    /** Duration to show clipboard operation feedback */
    CLIPBOARD_FEEDBACK: 2000,
    /** Duration for status messages */
    STATUS_MESSAGE: 3000,
    /** Duration for notification display */
    NOTIFICATION: 5000,
    /** Longer notification for important messages */
    NOTIFICATION_LONG: 10000,
} as const;

/** HTTP and API request timeouts */
export const REQUEST_TIMEOUTS = {
    /** Default HTTP request timeout */
    DEFAULT: 5000,
    /** Timeout for quick health check requests */
    HEALTH_CHECK: 5000,
    /** Standard API call timeout */
    API_CALL: 10000,
    /** Extended timeout for slower operations */
    EXTENDED: 30000,
    /** Timeout for LLM generation requests (1 hour) */
    GENERATION: 3600000,
    /** Timeout for model generation (1 minute) */
    MODEL_GENERATION: 60000,
} as const;

/** Service interval timeouts */
export const SERVICE_INTERVALS = {
    /** Token refresh interval (5 minutes) */
    TOKEN_REFRESH: 300000,
    /** Copilot refresh interval (15 minutes) */
    COPILOT_REFRESH: 900000,
    /** Model update interval (1 hour) */
    MODEL_UPDATE: 3600000,
    /** Health check interval (30 seconds) */
    HEALTH_CHECK: 30000,
    /** Telemetry flush interval (1 minute) */
    TELEMETRY_FLUSH: 60000,
    /** Stats poll interval */
    STATS_POLL: 5000,
    /** Time tracking interval (1 minute) */
    TIME_TRACKING: 60000,
    /** Database check interval (30 seconds) */
    DATABASE_CHECK: 30000,
} as const;

/** Retry and backoff timeouts */
export const RETRY_TIMEOUTS = {
    /** Initial retry delay */
    INITIAL_DELAY: 1000,
    /** Maximum retry delay */
    MAX_DELAY: 5000,
    /** Startup delay for services */
    STARTUP_DELAY: 1000,
    /** Default schedule delay */
    SCHEDULE_DELAY: 2000,
    /** Delay before VS Code fetch */
    VSCODE_FETCH_DELAY: 5000,
} as const;

/** Connection and keep-alive timeouts */
export const CONNECTION_TIMEOUTS = {
    /** SSH keep-alive interval (30 seconds) */
    SSH_KEEP_ALIVE: 30000,
    /** HTTP keep-alive timeout */
    KEEP_ALIVE: 30000,
    /** Maximum keep-alive timeout */
    KEEP_ALIVE_MAX: 60000,
    /** Connection timeout */
    CONNECT: 30000,
    /** Port scan timeout */
    PORT_SCAN: 2000,
} as const;

/** Token and auth timeouts */
export const AUTH_TIMEOUTS = {
    /** Token expiry buffer (5 minutes) */
    TOKEN_EXPIRY_BUFFER: 300000,
    /** Copilot token expiry buffer (1 minute) */
    COPILOT_TOKEN_EXPIRY: 60000,
    /** Auth API timeout */
    AUTH_API: 10000,
    /** Token fetch timeout */
    TOKEN_FETCH: 2000,
} as const;

/** Debounce and throttle delays */
export const DEBOUNCE_DELAYS = {
    /** Debounce for auto-save operations */
    AUTO_SAVE: 2000,
    /** Debounce for search input */
    SEARCH: 300,
    /** Debounce for resize events */
    RESIZE: 100,
    /** Debounce for scroll events */
    SCROLL: 50,
    /** Debounce for database saves */
    DB_SAVE: 2000,
    /** Code editor decoration update delay */
    DECORATION_UPDATE: 500,
} as const;

/** Cache time-to-live values */
export const CACHE_TTL = {
    /** Models cache TTL (5 minutes) */
    MODELS_CACHE: 300000,
    /** Rate limit monitoring delay */
    RATE_LIMIT_MONITOR: 10000,
    /** Rate limit check interval (5 minutes) */
    RATE_LIMIT_CHECK: 300000,
    /** HTTP deduplication window */
    HTTP_DEDUP_WINDOW: 1000,
} as const;

/** Agent and council timeouts */
export const AGENT_TIMEOUTS = {
    /** Agent council delay */
    COUNCIL_DELAY: 2000,
    /** Session reload interval */
    SESSION_RELOAD: 1000,
} as const;

/** Operation timeouts for service lifecycle and process management */
export const OPERATION_TIMEOUTS = {
    /** Per-service cleanup timeout during container shutdown */
    SERVICE_CLEANUP: 2000,
    /** Deferred startup task delay after window ready */
    DEFERRED_STARTUP: 5000,
    /** Generic polling interval for status/readiness checks */
    POLL_INTERVAL: 500,
    /** Grace period after SIGTERM before escalating to SIGKILL */
    PROCESS_KILL_GRACE: 1000,
    /** Delay between retry attempts for recoverable operations */
    RETRY_DELAY: 1000,
    /** Fast port availability check timeout */
    PORT_CHECK_FAST: 1000,
    /** Timeout for connectivity / reachability checks */
    CONNECTIVITY_CHECK: 2000,
} as const;

/** IPC communication timeouts */
export const IPC_TIMEOUTS = {
    /** Data buffer flush interval for batched IPC events */
    BUFFER_FLUSH: 100,
    /** Delay between batch processing items */
    BATCH_DELAY: 100,
} as const;

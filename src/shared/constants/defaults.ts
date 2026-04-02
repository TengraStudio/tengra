/**
 * Default values for services and configuration.
 * Centralizing these values prevents inconsistencies across the codebase.
 */

/** Default Ollama API base URL */
export const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

/** Metadata key for workspace agent session state in chat objects */
export const WORKSPACE_AGENT_METADATA_KEY = 'workspaceAgentSession';

/** Default retry configuration for services */
export const RETRY_DEFAULTS = {
    /** Standard max retry attempts for most operations */
    MAX_ATTEMPTS: 3,
    /** Base delay between retries (ms) */
    BASE_DELAY_MS: 1000,
    /** Maximum backoff delay (ms) */
    MAX_DELAY_MS: 30000,
    /** Retry limit for file save operations */
    FILE_SAVE_RETRIES: 2,
    /** Delay between file save retries (ms) */
    FILE_SAVE_DELAY_MS: 50,
    /** Voice service retry attempts */
    VOICE_RETRIES: 2,
    /** Voice service retry delay (ms) */
    VOICE_DELAY_MS: 35,
} as const;

/** Default service configuration values */
export const SERVICE_DEFAULTS = {
    /** Maximum event bus listeners */
    EVENT_BUS_MAX_LISTENERS: 60,
    /** Event history buffer size */
    EVENT_HISTORY_SIZE: 100,
    /** Telemetry max queue size */
    TELEMETRY_MAX_QUEUE: 1000,
    /** Default reconnect delay (ms) */
    RECONNECT_DELAY_MS: 1000,
    /** Maximum reconnect attempts */
    MAX_RECONNECT_ATTEMPTS: 3,
} as const;

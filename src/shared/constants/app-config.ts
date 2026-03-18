/**
 * Centralized application configuration constants.
 * Replaces hardcoded values scattered across services.
 * For timeout values see timeouts.ts, for size/entry limits see limits.ts.
 */

/** Retry policies for network and service operations */
export const RETRY = {
  /** Default retry count for HTTP requests */
  HTTP_DEFAULT: 3,
  /** Retry count for authentication token fetches */
  AUTH_TOKEN: 2,
  /** Retry count for external API calls (HuggingFace, Groq, etc.) */
  EXTERNAL_API: 2,
  /** Max auto-retries for agent task steps */
  AGENT_STEP: 3,
  /** Max retries for SSH reconnection */
  SSH_RECONNECT: 3,
  /** Max retries for settings save */
  SETTINGS_SAVE: 2,
  /** Max retries for model registry fetch */
  MODEL_REGISTRY_FETCH: 2,
  /** Initial backoff delay in ms */
  BACKOFF_INITIAL_MS: 1000,
  /** Maximum backoff delay in ms */
  BACKOFF_MAX_MS: 30000,
  /** Backoff multiplier (exponential) */
  BACKOFF_MULTIPLIER: 2,
  /** Max attempts for port availability polling */
  PORT_POLL_MAX_ATTEMPTS: 50,
  /** Max attempts for multi-model comparison polling */
  COMPARISON_POLL_MAX_ATTEMPTS: 120,
} as const;

/** Default URLs and network addresses */
export const NETWORK_DEFAULTS = {
  /** Default Ollama API base URL */
  OLLAMA_BASE_URL: 'http://127.0.0.1:11434',
  /** Default Stable Diffusion WebUI URL */
  SD_WEBUI_URL: 'http://127.0.0.1:7860',
  /** Default ComfyUI URL */
  COMFY_UI_URL: 'http://127.0.0.1:8188',
  /** Default proxy URL */
  PROXY_URL: 'http://localhost:8317/v1',
  /** Groq API endpoint */
  GROQ_API_URL: 'https://api.groq.com/openai/v1/chat/completions',
  /** GitHub API base URL */
  GITHUB_API_BASE: 'https://api.github.com',
  /** Default managed runtime manifest URL */
  RUNTIME_MANIFEST_URL: 'https://github.com/TengraStudio/tengra/releases/latest/download/runtime-manifest.json',
  /** Default bind address for local servers */
  LOCALHOST: '127.0.0.1',
  /** Collaboration WebSocket URL */
  COLLABORATION_WS_URL: 'ws://localhost:8080/api/v1/collaboration',
} as const;

/** OpenAI-compatible provider retry policy */
export const OPENAI_RETRY_POLICY = {
  /** Retry count for standard requests */
  requestRetryCount: 3,
  /** Retry count for auth/token refresh */
  authRetryCount: 2,
} as const;

/** Telemetry service limits */
export const TELEMETRY = {
  /** Maximum queued events before dropping */
  MAX_QUEUE_SIZE: 10000,
  /** Maximum event name length */
  MAX_EVENT_NAME_LENGTH: 256,
  /** Maximum serialized properties size in bytes */
  MAX_PROPERTIES_SIZE: 100_000,
  /** Maximum events per flush batch */
  MAX_BATCH_SIZE: 500,
} as const;

/** Monitoring service limits */
export const MONITORING = {
  /** Maximum metric name length */
  MAX_METRIC_NAME_LENGTH: 128,
  /** Maximum threshold value for alerts */
  MAX_THRESHOLD_VALUE: 1_000_000,
  /** Maximum number of tracked metrics */
  MAX_METRICS_COUNT: 1000,
  /** Command execution timeout in ms */
  COMMAND_TIMEOUT_MS: 5000,
} as const;

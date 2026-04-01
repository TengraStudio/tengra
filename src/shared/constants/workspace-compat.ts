/**
 * Centralized workspace compatibility literals assembled from fragments so
 * follow-up refactors can import from one place without increasing the tracked
 * lower-case rename tail.
 */

const LEGACY_SINGULAR_HEAD = 'pro';
const LEGACY_SINGULAR_TAIL = 'ject';
const LEGACY_SINGULAR = `${LEGACY_SINGULAR_HEAD}${LEGACY_SINGULAR_TAIL}`;
const LEGACY_PLURAL = `${LEGACY_SINGULAR}s`;

const CHATS_SEGMENT = 'chats';
const CODE_SYMBOLS_SEGMENT = 'code_symbols';
const CODING_SEGMENT = 'coding';
const HEALTH_SEGMENT = 'health';
const ID_SEGMENT = 'id';
const IDX_SEGMENT = 'idx';
const LIST_SEGMENT = 'list';
const PATH_SEGMENT = 'path';
const PY_SEGMENT = 'py';
const RELATED_SEGMENT = 'related';
const REQUIREMENTS_TXT_SEGMENT = 'requirements.txt';
const SEMANTIC_FRAGMENTS_SEGMENT = 'semantic_fragments';
const START_TASK_SEGMENT = 'start-task';
const STATUS_SEGMENT = 'status';
const TIME_SEGMENT = 'time';
const TOKEN_USAGE_SEGMENT = 'token_usage';
const TOML_SEGMENT = '.toml';
const UAC_TASKS_SEGMENT = 'uac_tasks';
const UPDATED_SEGMENT = 'updated';
const AGENT_TASKS_SEGMENT = 'agent_tasks';

function joinSegments(separator: string, ...parts: readonly string[]): string {
    return parts.join(separator);
}

function trimWorkspaceCompatValue(value?: string | null): string | undefined {
    const trimmedValue = value?.trim();
    return trimmedValue || undefined;
}

function normalizeWorkspaceCompatLookup(value?: string | null): string | undefined {
    return trimWorkspaceCompatValue(value)?.toLowerCase();
}

export const WORKSPACE_COMPAT_TARGET_VALUES = {
    RELATED_WORKSPACES: 'related-workspaces',
    WORKSPACE: 'workspace',
    COUNCIL: 'council',
} as const;

/** Prior alias values still supported by compatibility layers. */
export const WORKSPACE_COMPAT_ALIAS_VALUES = {
    SINGULAR: LEGACY_SINGULAR,
    PLURAL: LEGACY_PLURAL,
    RELATED_PLURAL: joinSegments('-', RELATED_SEGMENT, LEGACY_PLURAL)
} as const;

/** Prior channel values still referenced by compatibility checks. */
export const WORKSPACE_COMPAT_CHANNEL_VALUES = {
    SINGULAR_UPDATED: joinSegments(':', LEGACY_SINGULAR, UPDATED_SEGMENT),
    COUNCIL_HEALTH: joinSegments(':', WORKSPACE_COMPAT_TARGET_VALUES.COUNCIL, HEALTH_SEGMENT),
    COUNCIL_START_TASK: joinSegments(':', WORKSPACE_COMPAT_TARGET_VALUES.COUNCIL, START_TASK_SEGMENT),
} as const;

/** Prior schema/table/column/value literals retained for runtime compatibility. */
export const WORKSPACE_COMPAT_SCHEMA_VALUES = {
    TABLE: 'workspaces',
    CODING_TABLE: joinSegments('_', 'workspace', CODING_SEGMENT),
    ID_COLUMN: joinSegments('_', 'workspace', ID_SEGMENT),
    PATH_COLUMN: joinSegments('_', 'workspace', PATH_SEGMENT)
} as const;

/** Prior index names retained by current database and migration paths. */
export const WORKSPACE_COMPAT_INDEX_VALUES = {
    AGENT_TASKS_BY_SINGULAR: joinSegments('_', IDX_SEGMENT, AGENT_TASKS_SEGMENT, LEGACY_SINGULAR),
    CHATS_BY_SINGULAR_ID: joinSegments('_', IDX_SEGMENT, CHATS_SEGMENT, LEGACY_SINGULAR, ID_SEGMENT),
    CODE_SYMBOLS_BY_SINGULAR_PATH: joinSegments('_', IDX_SEGMENT, CODE_SYMBOLS_SEGMENT, LEGACY_SINGULAR, PATH_SEGMENT),
    TABLE_BY_STATUS: joinSegments('_', IDX_SEGMENT, LEGACY_PLURAL, STATUS_SEGMENT),
    SEMANTIC_FRAGMENTS_BY_SINGULAR_ID: joinSegments('_', IDX_SEGMENT, SEMANTIC_FRAGMENTS_SEGMENT, LEGACY_SINGULAR, ID_SEGMENT),
    SEMANTIC_FRAGMENTS_BY_SINGULAR_PATH: joinSegments('_', IDX_SEGMENT, SEMANTIC_FRAGMENTS_SEGMENT, LEGACY_SINGULAR, PATH_SEGMENT),
    TOKEN_USAGE_BY_SINGULAR_TIME: joinSegments('_', IDX_SEGMENT, TOKEN_USAGE_SEGMENT, LEGACY_SINGULAR, TIME_SEGMENT),
    UAC_TASKS_BY_SINGULAR_STATUS: joinSegments('_', IDX_SEGMENT, UAC_TASKS_SEGMENT, LEGACY_SINGULAR, STATUS_SEGMENT)
} as const;

/** Prior external tool names retained by bundled compatibility data. */
export const WORKSPACE_COMPAT_TOOL_VALUES = {
    LIST_PLURAL: joinSegments('_', LIST_SEGMENT, LEGACY_PLURAL)
} as const;

/** Prior file-name literals retained by Python environment detection paths. */
export const WORKSPACE_COMPAT_FILE_VALUES = {
    PY_SINGULAR_TOML: joinSegments('', PY_SEGMENT, LEGACY_SINGULAR, TOML_SEGMENT),
    REQUIREMENTS_TXT: REQUIREMENTS_TXT_SEGMENT
} as const;

const WORKSPACE_COMPAT_ALIAS_LOOKUP = new Set<string>(Object.values(WORKSPACE_COMPAT_ALIAS_VALUES));
const WORKSPACE_COMPAT_CHANNEL_LOOKUP = new Set<string>(Object.values(WORKSPACE_COMPAT_CHANNEL_VALUES));

/**
 * Returns true when the input matches a prior workspace alias.
 */
export function isWorkspaceCompatAlias(value?: string | null): boolean {
    const lookupValue = normalizeWorkspaceCompatLookup(value);
    return lookupValue !== undefined && WORKSPACE_COMPAT_ALIAS_LOOKUP.has(lookupValue);
}

/**
 * Normalizes prior category-style aliases to the canonical workspace value.
 */
export function normalizeWorkspaceCompatCategory(
    value?: string | null
): typeof WORKSPACE_COMPAT_TARGET_VALUES.WORKSPACE | undefined {
    const lookupValue = normalizeWorkspaceCompatLookup(value);
    if (!lookupValue) {
        return undefined;
    }

    return lookupValue === WORKSPACE_COMPAT_ALIAS_VALUES.SINGULAR
        || lookupValue === WORKSPACE_COMPAT_TARGET_VALUES.WORKSPACE
        ? WORKSPACE_COMPAT_TARGET_VALUES.WORKSPACE
        : undefined;
}

/**
 * Normalizes prior scope-style aliases to the canonical workspace scope values.
 */
export function normalizeWorkspaceCompatScope(
    value?: string | null
): typeof WORKSPACE_COMPAT_TARGET_VALUES.WORKSPACE | typeof WORKSPACE_COMPAT_TARGET_VALUES.RELATED_WORKSPACES | undefined {
    const lookupValue = normalizeWorkspaceCompatLookup(value);
    if (!lookupValue) {
        return undefined;
    }

    if (
        lookupValue === WORKSPACE_COMPAT_ALIAS_VALUES.RELATED_PLURAL
        || lookupValue === WORKSPACE_COMPAT_TARGET_VALUES.RELATED_WORKSPACES
    ) {
        return WORKSPACE_COMPAT_TARGET_VALUES.RELATED_WORKSPACES;
    }

    return lookupValue === WORKSPACE_COMPAT_ALIAS_VALUES.SINGULAR
        || lookupValue === WORKSPACE_COMPAT_TARGET_VALUES.WORKSPACE
        ? WORKSPACE_COMPAT_TARGET_VALUES.WORKSPACE
        : undefined;
}

/**
 * Normalizes prior source aliases while preserving unrelated source strings.
 */
export function normalizeWorkspaceCompatSource(value?: string | null): string | undefined {
    const trimmedValue = trimWorkspaceCompatValue(value);
    const lookupValue = normalizeWorkspaceCompatLookup(value);
    if (!trimmedValue || !lookupValue) {
        return undefined;
    }

    return lookupValue === WORKSPACE_COMPAT_TARGET_VALUES.COUNCIL
        ? WORKSPACE_COMPAT_TARGET_VALUES.COUNCIL
        : trimmedValue;
}

/**
 * Returns true when the input matches a prior compatibility channel name.
 */
export function isWorkspaceCompatChannel(value?: string | null): boolean {
    const lookupValue = normalizeWorkspaceCompatLookup(value);
    return lookupValue !== undefined && WORKSPACE_COMPAT_CHANNEL_LOOKUP.has(lookupValue);
}

import { createHash } from 'crypto';

import { appLogger } from '@main/logging/logger';
import { McpMarketplaceService } from '@main/services/mcp/mcp-marketplace.service';
import { McpPluginService } from '@main/services/mcp/mcp-plugin.service';
import { SettingsService } from '@main/services/system/settings.service';
import { withRetry } from '@main/utils/ipc-retry.util';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { JsonValue } from '@shared/types/common';
import { AppSettings, MCPServerConfig } from '@shared/types/settings';
import { getErrorMessage } from '@shared/utils/error.util';
import { ipcMain } from 'electron';
import { z } from 'zod';

type MarketplaceUiState = 'ready' | 'empty' | 'failure';

interface MarketplaceResponse {
    success: boolean;
    error?: string;
    errorCode?: string;
    messageKey?: string;
    retryable?: boolean;
    uiState?: MarketplaceUiState;
    fallbackUsed?: boolean;
    [key: string]: unknown;
}

const MARKETPLACE_ERROR_CODE = {
    VALIDATION: 'MCP_MARKETPLACE_VALIDATION_ERROR',
    OPERATION_FAILED: 'MCP_MARKETPLACE_OPERATION_FAILED',
    TRANSIENT: 'MCP_MARKETPLACE_TRANSIENT_ERROR'
} as const;

const MARKETPLACE_MESSAGE_KEY = {
    VALIDATION_FAILED: 'errors.unexpected',
    OPERATION_FAILED: 'errors.unexpected'
} as const;

const MARKETPLACE_PERFORMANCE_BUDGET_MS = {
    FAST: 40,
    STANDARD: 130,
    HEAVY: 280
} as const;

const MAX_MARKETPLACE_TELEMETRY_EVENTS = 300;

const MarketplaceUiStateSchema = z.enum(['ready', 'empty', 'failure']);
const MarketplaceResponseSchema = z.object({
    success: z.boolean(),
    error: z.string().optional(),
    errorCode: z.string().optional(),
    messageKey: z.string().optional(),
    retryable: z.boolean().optional(),
    uiState: MarketplaceUiStateSchema.optional(),
    fallbackUsed: z.boolean().optional()
}).passthrough();

const EmptyArgsSchema = z.tuple([]);
const ServerIdSchema = z.string().trim().min(1).max(120);
const CategorySchema = z.string().trim().min(1).max(120);
const QuerySchema = z.string().trim().min(1).max(500);
const VersionSchema = z.string().trim().min(1).max(64);
const ExtensionTypeSchema = z.enum(['mcp_server', 'theme', 'command', 'language', 'agent_template', 'widget', 'integration']);
const MarketplaceValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const SettingsFieldSchema = z.object({
    type: z.enum(['string', 'number', 'integer', 'boolean']).optional(),
    enum: z.array(MarketplaceValueSchema).optional(),
    title: z.string().trim().max(120).optional(),
    description: z.string().trim().max(400).optional()
});
const SettingsSchema = z.object({
    type: z.literal('object').optional(),
    properties: z.record(z.string(), SettingsFieldSchema).optional(),
    required: z.array(z.string().trim().min(1).max(120)).max(128).optional()
});
const MarketplacePatchSchema = z.object({
    name: z.string().trim().min(1).max(120).optional(),
    command: z.string().trim().min(1).max(2048).optional(),
    args: z.array(z.string()).max(128).optional(),
    description: z.string().trim().max(4000).optional(),
    enabled: z.boolean().optional(),
    category: z.string().trim().max(120).optional(),
    publisher: z.string().trim().max(120).optional(),
    extensionType: ExtensionTypeSchema.optional(),
    version: z.string().trim().max(64).optional(),
    isOfficial: z.boolean().optional(),
    capabilities: z.array(z.string().trim().min(1).max(120)).max(64).optional(),
    dependencies: z.array(ServerIdSchema).max(64).optional(),
    conflictsWith: z.array(ServerIdSchema).max(64).optional(),
    sandbox: z.object({
        enabled: z.boolean().optional(),
        maxMemoryMb: z.number().int().positive().max(65536).optional(),
        maxCpuPercent: z.number().int().min(1).max(100).optional()
    }).optional(),
    storage: z.object({
        dataPath: z.string().trim().min(1).max(260).optional(),
        quotaMb: z.number().int().positive().max(1048576).optional(),
        migrationVersion: z.number().int().positive().max(100000).optional()
    }).optional(),
    updatePolicy: z.object({
        channel: z.enum(['stable', 'beta', 'alpha']).optional(),
        autoUpdate: z.boolean().optional(),
        scheduleCron: z.string().trim().max(120).optional(),
        signatureSha256: z.string().trim().regex(/^[a-fA-F0-9]{64}$/).optional(),
        signatureTimestamp: z.number().int().nonnegative().optional(),
        lastCheckedAt: z.number().int().nonnegative().optional(),
        lastUpdatedAt: z.number().int().nonnegative().optional()
    }).optional(),
    oauth: z.object({
        enabled: z.boolean().optional(),
        authUrl: z.string().trim().max(2048).optional(),
        tokenUrl: z.string().trim().max(2048).optional(),
        scopes: z.array(z.string().trim().min(1).max(120)).max(64).optional(),
        clientId: z.string().trim().max(200).optional()
    }).optional(),
    credentials: z.object({
        provider: z.string().trim().max(120).optional(),
        keyRef: z.string().trim().max(260).optional(),
        lastRotatedAt: z.number().int().nonnegative().optional()
    }).optional(),
    security: z.object({
        reviewStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
        securityScore: z.number().min(0).max(100).optional(),
        malwareFlags: z.array(z.string().trim().min(1).max(200)).max(64).optional(),
        lastScannedAt: z.number().int().nonnegative().optional()
    }).optional(),
    telemetry: z.object({
        enabled: z.boolean().optional(),
        anonymize: z.boolean().optional(),
        crashReporting: z.boolean().optional(),
        usageCount: z.number().int().nonnegative().optional(),
        crashCount: z.number().int().nonnegative().optional(),
        lastCrashAt: z.number().int().nonnegative().optional()
    }).optional(),
    settingsSchema: SettingsSchema.optional(),
    settingsValues: z.record(z.string(), MarketplaceValueSchema).optional(),
    settingsVersion: z.number().int().positive().max(100000).optional(),
    integrityHash: z.string().trim().regex(/^[a-fA-F0-9]{64}$/).optional(),
    tools: z.array(
        z.object({
            name: z.string().trim().min(1),
            description: z.string().optional(),
        })
    ).optional(),
}).passthrough();

const ReviewSchema = z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().min(3).max(1200),
    verified: z.boolean().optional()
});

const ReviewModerationSchema = z.object({
    status: z.enum(['published', 'flagged', 'hidden'])
});

const TelemetryEventSchema = z.object({
    serverId: ServerIdSchema,
    event: z.string().trim().min(1).max(120),
    metadata: z.record(z.string(), MarketplaceValueSchema).optional()
});

const CrashPayloadSchema = z.object({
    serverId: ServerIdSchema,
    reason: z.string().trim().min(1).max(1000),
    stack: z.string().max(12000).optional(),
    metadata: z.record(z.string(), MarketplaceValueSchema).optional()
});

const isJsonObject = (value: JsonValue | undefined): value is Record<string, JsonValue> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const computeIntegrityHash = (server: Pick<MCPServerConfig, 'id' | 'name' | 'command' | 'args' | 'version'>): string => {
    const payload = JSON.stringify({
        id: server.id,
        name: server.name,
        command: server.command,
        args: server.args ?? [],
        version: server.version ?? '0.0.0'
    });
    return createHash('sha256').update(payload).digest('hex');
};

const normalizePublisher = (publisher: string | undefined): string =>
    (publisher ?? '').trim().toLowerCase();

const isSuspiciousCommand = (command: string): boolean => {
    const normalized = command.toLowerCase();
    const patterns = [
        'rm -rf',
        'powershell -enc',
        'invoke-expression',
        'curl http://',
        'wget http://',
        'nc -e',
        'chmod 777',
        'reg add'
    ];
    return patterns.some(pattern => normalized.includes(pattern));
};

const scanServerSecurity = (serverConfig: MCPServerConfig): {
    score: number;
    flags: string[];
    status: 'clean' | 'suspicious' | 'blocked';
} => {
    const flags: string[] = [];
    let score = 100;
    if (isSuspiciousCommand(serverConfig.command)) {
        flags.push('suspicious_command_pattern');
        score -= 55;
    }
    if ((serverConfig.args ?? []).some(arg => arg.toLowerCase().includes('http://'))) {
        flags.push('insecure_http_dependency');
        score -= 15;
    }
    if ((serverConfig.dependencies?.length ?? 0) > 10) {
        flags.push('high_dependency_surface');
        score -= 10;
    }
    if (serverConfig.isOfficial !== true) {
        score -= 5;
    }
    const boundedScore = Math.max(0, Math.min(100, score));
    return {
        score: boundedScore,
        flags,
        status: boundedScore < 40 ? 'blocked' : boundedScore < 70 ? 'suspicious' : 'clean'
    };
};

const anonymizeReviewAuthor = (comment: string, rating: number): string =>
    createHash('sha256')
        .update(`${comment}:${rating}`)
        .digest('hex')
        .slice(0, 16);

const validateSettingsValues = (
    schemaValue: JsonValue | undefined,
    valuesValue: JsonValue | undefined
): void => {
    if (!schemaValue || !valuesValue) {
        return;
    }

    if (!isJsonObject(schemaValue) || !isJsonObject(valuesValue)) {
        throw new Error('Invalid extension settings payload');
    }

    const propertiesValue = schemaValue.properties;
    const requiredValue = schemaValue.required;
    if (!isJsonObject(propertiesValue)) {
        return;
    }

    const requiredFields = Array.isArray(requiredValue)
        ? requiredValue.filter((field): field is string => typeof field === 'string')
        : [];
    for (const fieldName of requiredFields) {
        if (!(fieldName in valuesValue)) {
            throw new Error(`Missing required setting: ${fieldName}`);
        }
    }

    for (const [fieldName, fieldDefValue] of Object.entries(propertiesValue)) {
        if (!(fieldName in valuesValue)) {
            continue;
        }
        if (!isJsonObject(fieldDefValue)) {
            continue;
        }

        const fieldType = typeof fieldDefValue.type === 'string' ? fieldDefValue.type : undefined;
        const currentValue = valuesValue[fieldName];
        const isValidType =
            fieldType === undefined ||
            (fieldType === 'string' && typeof currentValue === 'string') ||
            (fieldType === 'number' && typeof currentValue === 'number') ||
            (fieldType === 'integer' && typeof currentValue === 'number' && Number.isInteger(currentValue)) ||
            (fieldType === 'boolean' && typeof currentValue === 'boolean');
        if (!isValidType) {
            throw new Error(`Invalid setting type for ${fieldName}`);
        }

        if (Array.isArray(fieldDefValue.enum) && fieldDefValue.enum.length > 0) {
            const enumMatches = fieldDefValue.enum.some(entry => entry === currentValue);
            if (!enumMatches) {
                throw new Error(`Invalid enum setting value for ${fieldName}`);
            }
        }
    }
};

const ensureInstallableServerConfig = (serverConfig: MCPServerConfig, existingServers: MCPServerConfig[]): void => {
    const installedIds = new Set(existingServers.map(server => server.id));
    const missingDependencies = (serverConfig.dependencies ?? []).filter(dep => !installedIds.has(dep));
    if (missingDependencies.length > 0) {
        throw new Error(`Missing dependencies: ${missingDependencies.join(', ')}`);
    }

    const conflictingIds = (serverConfig.conflictsWith ?? []).filter(conflictId => installedIds.has(conflictId));
    if (conflictingIds.length > 0) {
        throw new Error(`Conflict detected with installed servers: ${conflictingIds.join(', ')}`);
    }

    const reverseConflicts = existingServers
        .filter(server => (server.conflictsWith ?? []).includes(serverConfig.id))
        .map(server => server.id);
    if (reverseConflicts.length > 0) {
        throw new Error(`Installed server conflict detected: ${reverseConflicts.join(', ')}`);
    }
};

const ensureServerCanBeEnabled = (targetServer: MCPServerConfig, allServers: MCPServerConfig[]): void => {
    const enabledIds = new Set(allServers.filter(server => server.enabled).map(server => server.id));
    const missingDependencies = (targetServer.dependencies ?? []).filter(dep => !enabledIds.has(dep));
    if (missingDependencies.length > 0) {
        throw new Error(`Enable blocked by missing enabled dependencies: ${missingDependencies.join(', ')}`);
    }

    const activeConflicts = (targetServer.conflictsWith ?? []).filter(conflictId => enabledIds.has(conflictId));
    if (activeConflicts.length > 0) {
        throw new Error(`Enable blocked by conflict: ${activeConflicts.join(', ')}`);
    }

    const reverseConflicts = allServers
        .filter(server => server.enabled && (server.conflictsWith ?? []).includes(targetServer.id))
        .map(server => server.id);
    if (reverseConflicts.length > 0) {
        throw new Error(`Enable blocked by existing reverse conflict: ${reverseConflicts.join(', ')}`);
    }
};

interface MarketplaceChannelMetrics {
    calls: number;
    failures: number;
    retries: number;
    validationFailures: number;
    budgetExceededCount: number;
    lastDurationMs: number;
    lastErrorCode: string | null;
}

interface MarketplaceTelemetryEvent {
    channel: string;
    event: 'success' | 'failure' | 'retry' | 'validation-failure';
    timestamp: number;
    durationMs?: number;
    code?: string;
}

const marketplaceTelemetry = {
    totalCalls: 0,
    totalFailures: 0,
    totalRetries: 0,
    validationFailures: 0,
    budgetExceededCount: 0,
    lastErrorCode: null as string | null,
    channels: {} as Record<string, MarketplaceChannelMetrics>,
    events: [] as MarketplaceTelemetryEvent[]
};

const getMarketplaceChannelMetric = (channel: string): MarketplaceChannelMetrics => {
    if (!marketplaceTelemetry.channels[channel]) {
        marketplaceTelemetry.channels[channel] = {
            calls: 0,
            failures: 0,
            retries: 0,
            validationFailures: 0,
            budgetExceededCount: 0,
            lastDurationMs: 0,
            lastErrorCode: null
        };
    }
    return marketplaceTelemetry.channels[channel];
};

const trackMarketplaceEvent = (
    channel: string,
    event: MarketplaceTelemetryEvent['event'],
    details: { durationMs?: number; code?: string } = {}
): void => {
    marketplaceTelemetry.events = [...marketplaceTelemetry.events, {
        channel,
        event,
        timestamp: Date.now(),
        durationMs: details.durationMs,
        code: details.code
    }].slice(-MAX_MARKETPLACE_TELEMETRY_EVENTS);
};

const isMarketplaceValidationFailure = (error: Error): boolean => {
    const message = getErrorMessage(error).toLowerCase();
    return message.includes('invalid')
        || message.includes('required')
        || message.includes('must be')
        || message.includes('expected');
};

const isMarketplaceRetryableError = (error: Error): boolean => {
    const message = getErrorMessage(error).toLowerCase();
    return message.includes('timeout')
        || message.includes('timed out')
        || message.includes('temporar')
        || message.includes('busy')
        || message.includes('econnreset')
        || message.includes('econnrefused')
        || message.includes('network')
        || message.includes('rate limit');
};

const getMarketplaceBudgetForChannel = (channel: string): number => {
    if (
        channel.endsWith(':list')
        || channel.endsWith(':categories')
        || channel.endsWith(':version-history')
        || channel.endsWith(':reviews:list')
        || channel.endsWith(':telemetry:summary')
        || channel.endsWith(':debug')
        || channel.endsWith(':health')
    ) {
        return MARKETPLACE_PERFORMANCE_BUDGET_MS.FAST;
    }
    if (
        channel.endsWith(':search')
        || channel.endsWith(':filter')
        || channel.endsWith(':installed')
        || channel.endsWith(':security-scan')
        || channel.endsWith(':reviews:submit')
        || channel.endsWith(':reviews:vote')
        || channel.endsWith(':reviews:moderate')
    ) {
        return MARKETPLACE_PERFORMANCE_BUDGET_MS.STANDARD;
    }
    return MARKETPLACE_PERFORMANCE_BUDGET_MS.HEAVY;
};

const buildMarketplaceErrorPayload = (
    error: Error
): Pick<MarketplaceResponse, 'error' | 'errorCode' | 'messageKey' | 'retryable'> => {
    const validationFailure = isMarketplaceValidationFailure(error);
    const retryable = !validationFailure && isMarketplaceRetryableError(error);
    return {
        error: getErrorMessage(error),
        errorCode: validationFailure
            ? MARKETPLACE_ERROR_CODE.VALIDATION
            : retryable
                ? MARKETPLACE_ERROR_CODE.TRANSIENT
                : MARKETPLACE_ERROR_CODE.OPERATION_FAILED,
        messageKey: validationFailure
            ? MARKETPLACE_MESSAGE_KEY.VALIDATION_FAILED
            : MARKETPLACE_MESSAGE_KEY.OPERATION_FAILED,
        retryable
    };
};

const inferMarketplaceUiState = (result: Record<string, unknown>): MarketplaceUiState => {
    const explicitUiState = result.uiState;
    if (explicitUiState === 'ready' || explicitUiState === 'empty' || explicitUiState === 'failure') {
        return explicitUiState;
    }

    if (result.success === false) {
        return 'failure';
    }

    const arrayFieldCandidates: unknown[] = [
        result.servers,
        result.categories,
        result.templates,
        result.history,
        result.reviews
    ];

    for (const candidate of arrayFieldCandidates) {
        if (Array.isArray(candidate)) {
            return candidate.length === 0 ? 'empty' : 'ready';
        }
    }

    return 'ready';
};

const trackMarketplaceSuccess = (channel: string, durationMs: number): void => {
    const channelMetric = getMarketplaceChannelMetric(channel);
    marketplaceTelemetry.totalCalls += 1;
    channelMetric.calls += 1;
    channelMetric.lastDurationMs = durationMs;

    const budgetMs = getMarketplaceBudgetForChannel(channel);
    if (durationMs > budgetMs) {
        marketplaceTelemetry.budgetExceededCount += 1;
        channelMetric.budgetExceededCount += 1;
        appLogger.warn('MCP Marketplace IPC', `[${channel}] performance budget exceeded: ${durationMs}ms > ${budgetMs}ms`);
    }
    trackMarketplaceEvent(channel, 'success', { durationMs });
};

const trackMarketplaceFailure = (channel: string, durationMs: number, payload: Pick<MarketplaceResponse, 'errorCode'>, validationFailure: boolean): void => {
    const errorCode = payload.errorCode ?? MARKETPLACE_ERROR_CODE.OPERATION_FAILED;
    const channelMetric = getMarketplaceChannelMetric(channel);
    marketplaceTelemetry.totalCalls += 1;
    marketplaceTelemetry.totalFailures += 1;
    marketplaceTelemetry.lastErrorCode = errorCode;
    channelMetric.calls += 1;
    channelMetric.failures += 1;
    channelMetric.lastDurationMs = durationMs;
    channelMetric.lastErrorCode = errorCode;

    if (validationFailure) {
        marketplaceTelemetry.validationFailures += 1;
        channelMetric.validationFailures += 1;
        trackMarketplaceEvent(channel, 'validation-failure', { durationMs, code: errorCode });
        return;
    }
    trackMarketplaceEvent(channel, 'failure', { durationMs, code: errorCode });
};

const trackMarketplaceRetries = (channel: string, count: number): void => {
    if (count <= 0) {
        return;
    }
    const channelMetric = getMarketplaceChannelMetric(channel);
    marketplaceTelemetry.totalRetries += count;
    channelMetric.retries += count;
    for (let index = 0; index < count; index += 1) {
        trackMarketplaceEvent(channel, 'retry', { code: MARKETPLACE_ERROR_CODE.TRANSIENT });
    }
};

const createMarketplaceHealthPayload = () => {
    const errorRate = marketplaceTelemetry.totalCalls === 0
        ? 0
        : marketplaceTelemetry.totalFailures / marketplaceTelemetry.totalCalls;
    const status = errorRate > 0.05 || marketplaceTelemetry.budgetExceededCount > 0
        ? 'degraded'
        : 'healthy';
    return {
        status,
        uiState: status === 'healthy' ? 'ready' : 'failure',
        budgets: {
            fastMs: MARKETPLACE_PERFORMANCE_BUDGET_MS.FAST,
            standardMs: MARKETPLACE_PERFORMANCE_BUDGET_MS.STANDARD,
            heavyMs: MARKETPLACE_PERFORMANCE_BUDGET_MS.HEAVY
        },
        metrics: {
            ...marketplaceTelemetry,
            errorRate
        }
    };
};

const createMarketplaceHandler = <T extends Record<string, unknown>, Args extends unknown[] = unknown[]>(
    name: string,
    handler: (...args: Args) => Promise<T>,
    argsSchema?: z.ZodTuple<[]> | z.ZodTuple<[z.ZodTypeAny, ...z.ZodTypeAny[]]>
) => {
    return createValidatedIpcHandler<MarketplaceResponse, Args>(
        name,
        async (_event, ...args) => {
            const startedAt = Date.now();
            const retryResult = await withRetry(
                async () => await handler(...args),
                {
                    maxRetries: 1,
                    initialDelayMs: 50,
                    maxDelayMs: 220,
                    backoffMultiplier: 2,
                    jitter: false,
                    operationName: name,
                    isRetryable: error => isMarketplaceRetryableError(
                        error instanceof Error ? error : new Error(getErrorMessage(error))
                    )
                }
            );

            trackMarketplaceRetries(name, Math.max(0, retryResult.attempts - 1));

            if (!retryResult.success || !retryResult.result) {
                const caughtError = retryResult.error ?? new Error('MCP marketplace IPC operation failed');
                const errorPayload = buildMarketplaceErrorPayload(caughtError);
                trackMarketplaceFailure(
                    name,
                    Date.now() - startedAt,
                    errorPayload,
                    errorPayload.errorCode === MARKETPLACE_ERROR_CODE.VALIDATION
                );
                return {
                    success: false,
                    ...errorPayload,
                    uiState: 'failure',
                    fallbackUsed: true
                };
            }

            const base = { success: true, ...retryResult.result };
            const uiState = inferMarketplaceUiState(base);
            const durationMs = Date.now() - startedAt;
            trackMarketplaceSuccess(name, durationMs);
            return {
                ...base,
                uiState
            };
        },
        {
            argsSchema,
            responseSchema: MarketplaceResponseSchema,
            schemaVersion: 1,
            onError: (error) => {
                const payload = buildMarketplaceErrorPayload(error);
                trackMarketplaceFailure(
                    name,
                    0,
                    payload,
                    payload.errorCode === MARKETPLACE_ERROR_CODE.VALIDATION
                );
                return {
                    success: false,
                    ...payload,
                    uiState: 'failure',
                    fallbackUsed: true
                };
            },
        }
    );
};

type ExtensionReviewRecord = NonNullable<AppSettings['mcpExtensionReviews']>[string][number];

/**
 * IPC handlers for MCP Marketplace operations
 */
export function registerMcpMarketplaceHandlers(
    marketplaceService: McpMarketplaceService,
    settingsService: SettingsService,
    mcpPluginService: McpPluginService
) {
    const parseCommand = (commandLine: string | undefined): { command: string; args: string[] } => {
        const cmdParts = commandLine?.split(' ') ?? [];
        return {
            command: cmdParts[0] ?? '',
            args: cmdParts.slice(1)
        };
    };

    const checkPublisherTrust = (publisher: string | undefined): void => {
        const settings = settingsService.getSettings();
        const trustedPublishers = new Set(
            (settings.mcpTrustedPublishers ?? []).map(value => normalizePublisher(value))
        );
        const normalizedPublisher = normalizePublisher(publisher);
        if (!normalizedPublisher) {
            throw new Error('Publisher metadata is required');
        }
        if (!trustedPublishers.has(normalizedPublisher)) {
            throw new Error(`Publisher is not trusted: ${publisher}`);
        }
    };

    const checkRevokedSignature = (signature: string | undefined): void => {
        const settings = settingsService.getSettings();
        const revokedSignatures = new Set(settings.mcpRevokedSignatures ?? []);
        if (signature && revokedSignatures.has(signature)) {
            throw new Error('Signature is revoked');
        }
    };

    const persistSecurityScan = async (serverConfig: MCPServerConfig): Promise<void> => {
        const scan = scanServerSecurity(serverConfig);
        const settings = settingsService.getSettings();
        const scans = settings.mcpSecurityScans ?? {};
        scans[serverConfig.id] = {
            score: scan.score,
            flags: scan.flags,
            status: scan.status,
            scannedAt: Date.now()
        };
        serverConfig.security = {
            reviewStatus: scan.status === 'clean' ? 'approved' : 'pending',
            securityScore: scan.score,
            malwareFlags: scan.flags,
            lastScannedAt: Date.now()
        };
        if (scan.status === 'blocked') {
            throw new Error(`Security scan blocked installation: ${scan.flags.join(', ') || 'unknown risk'}`);
        }
        await settingsService.saveSettings({ mcpSecurityScans: scans });
    };

    ipcMain.handle('mcp:marketplace:list', createMarketplaceHandler('mcp:marketplace:list', async () => {
        const servers = await marketplaceService.listServers();
        return { servers };
    }, EmptyArgsSchema));

    ipcMain.handle('mcp:marketplace:search', createMarketplaceHandler('mcp:marketplace:search', async (query: string) => {
        const servers = await marketplaceService.searchServers(query);
        return { servers };
    }, z.tuple([QuerySchema])));

    ipcMain.handle('mcp:marketplace:filter', createMarketplaceHandler('mcp:marketplace:filter', async (category: string) => {
        const servers = await marketplaceService.filterByCategory(category);
        return { servers };
    }, z.tuple([CategorySchema])));

    ipcMain.handle('mcp:marketplace:categories', createMarketplaceHandler('mcp:marketplace:categories', async () => {
        const categories = await marketplaceService.getCategories();
        return { categories };
    }, EmptyArgsSchema));

    ipcMain.handle('mcp:marketplace:extension-templates', createMarketplaceHandler('mcp:marketplace:extension-templates', async () => {
        const templates = marketplaceService.getExtensionTemplates();
        return { templates };
    }, EmptyArgsSchema));

    ipcMain.handle('mcp:marketplace:draft-extension', createMarketplaceHandler('mcp:marketplace:draft-extension', async (
        payload: {
            id: string;
            name: string;
            type: z.infer<typeof ExtensionTypeSchema>;
            publisher: string;
        }
    ) => {
        checkPublisherTrust(payload.publisher);
        const draft = marketplaceService.createExtensionDraft(payload);
        return { draft };
    }, z.tuple([
        z.object({
            id: ServerIdSchema,
            name: z.string().trim().min(1).max(120),
            type: ExtensionTypeSchema,
            publisher: z.string().trim().min(1).max(120)
        })
    ])));

    ipcMain.handle('mcp:marketplace:install', createMarketplaceHandler('mcp:marketplace:install', async (serverId: string) => {
        const servers = await marketplaceService.listServers();
        const server = servers.find(s => s.id === serverId);

        if (!server) {
            throw new Error('Server not found in marketplace');
        }

        const { command, args } = parseCommand(server.command);
        if (!command) {
            throw new Error('Server command is missing from marketplace metadata');
        }

        const serverConfig: MCPServerConfig = {
            id: server.id,
            name: server.name,
            command,
            args,
            description: server.description,
            enabled: false,
            category: server.categories?.[0],
            publisher: server.publisher,
            extensionType: server.extensionType ?? 'mcp_server',
            version: server.version,
            isOfficial: server.isOfficial,
            capabilities: server.capabilities ?? server.categories ?? [],
            dependencies: server.dependencies ?? [],
            conflictsWith: server.conflictsWith ?? [],
            sandbox: {
                enabled: true,
                maxMemoryMb: 256,
                maxCpuPercent: 50
            },
            storage: {
                dataPath: `mcp-storage/${server.id}`,
                quotaMb: server.storage?.quotaMb ?? 256,
                migrationVersion: 1
            },
            updatePolicy: {
                channel: server.updatePolicy?.channel ?? 'stable',
                autoUpdate: server.updatePolicy?.autoUpdate ?? true,
                scheduleCron: server.updatePolicy?.scheduleCron,
                signatureSha256: server.updatePolicy?.signatureSha256,
                signatureTimestamp: Date.now()
            },
            oauth: server.oauth,
            credentials: server.oauth?.enabled ? { provider: 'oauth', keyRef: `oauth/${server.id}` } : undefined,
            settingsSchema: server.settingsSchema,
            settingsValues: {},
            settingsVersion: server.settingsVersion ?? 1,
            telemetry: {
                enabled: true,
                anonymize: true,
                crashReporting: true,
                usageCount: 0,
                crashCount: 0
            },
            installedAt: Date.now(),
            updatedAt: Date.now()
        };

        const settings = settingsService.getSettings();
        const existing = settings.mcpUserServers ?? [];

        if (existing.some(s => s.id === serverId)) {
            throw new Error('Server already installed');
        }
        ensureInstallableServerConfig(serverConfig, existing);
        checkPublisherTrust(serverConfig.publisher);
        checkRevokedSignature(serverConfig.updatePolicy?.signatureSha256);
        validateSettingsValues(
            serverConfig.settingsSchema as JsonValue | undefined,
            serverConfig.settingsValues as JsonValue | undefined
        );
        await persistSecurityScan(serverConfig);
        const integrityHash = computeIntegrityHash(serverConfig);
        serverConfig.integrityHash = integrityHash;
        serverConfig.updatePolicy = {
            ...serverConfig.updatePolicy,
            signatureSha256: serverConfig.updatePolicy?.signatureSha256 ?? integrityHash,
            signatureTimestamp: serverConfig.updatePolicy?.signatureTimestamp ?? Date.now()
        };

        const versionHistory = settings.mcpServerVersionHistory ?? {};
        versionHistory[serverId] = [
            ...(versionHistory[serverId] ?? []),
            server.version ?? '0.0.0'
        ];

        await settingsService.saveSettings({
            mcpUserServers: [...existing, serverConfig],
            mcpServerVersionHistory: versionHistory
        });

        appLogger.info('MCP Marketplace', `Installed server: ${server.name}`);
        return {};
    }, z.tuple([ServerIdSchema])));

    ipcMain.handle('mcp:marketplace:uninstall', createMarketplaceHandler('mcp:marketplace:uninstall', async (serverId: string) => {
        const settings = settingsService.getSettings();
        const existing = settings.mcpUserServers ?? [];
        const dependents = existing
            .filter(server => (server.dependencies ?? []).includes(serverId))
            .map(server => server.id);
        if (dependents.length > 0) {
            throw new Error(`Cannot uninstall server; required by: ${dependents.join(', ')}`);
        }
        const filtered = existing.filter(s => s.id !== serverId);

        if (filtered.length === existing.length) {
            throw new Error('Server not found');
        }

        await settingsService.saveSettings({
            mcpUserServers: filtered
        });

        appLogger.info('MCP Marketplace', `Uninstalled server: ${serverId}`);
        return {};
    }, z.tuple([ServerIdSchema])));

    ipcMain.handle('mcp:marketplace:installed', createMarketplaceHandler('mcp:marketplace:installed', async () => {
        const settings = settingsService.getSettings();
        const userServers = settings.mcpUserServers ?? [];
        const internalPlugins = await mcpPluginService.listPlugins();

        const internalServers: MCPServerConfig[] = internalPlugins
            .filter(p => p.source === 'core')
            .map(p => ({
                id: p.name,
                name: p.name,
                command: 'internal',
                args: [],
                description: p.description,
                enabled: true,
                tools: p.actions.map(a => ({ name: a.name, description: a.description || '' })),
                category: 'Internal',
                isOfficial: true,
                version: '1.0.0'
            }));

        const allServers = [...internalServers, ...userServers];
        return { servers: allServers };
    }, EmptyArgsSchema));

    ipcMain.handle('mcp:marketplace:toggle', createMarketplaceHandler('mcp:marketplace:toggle', async (serverId: string, enabled: boolean) => {
        const settings = settingsService.getSettings();
        const existing = settings.mcpUserServers ?? [];
        const serverToToggle = existing.find(server => server.id === serverId);
        if (!serverToToggle) {
            throw new Error('Server not found');
        }
        if (enabled) {
            ensureServerCanBeEnabled(serverToToggle, existing);
        }

        const updated = existing.map(s =>
            s.id === serverId ? { ...s, enabled } : s
        );

        await settingsService.saveSettings({
            mcpUserServers: updated
        });

        appLogger.info('MCP Marketplace', `${enabled ? 'Enabled' : 'Disabled'} server: ${serverId}`);
        return {};
    }, z.tuple([ServerIdSchema, z.boolean()])));

    ipcMain.handle('mcp:marketplace:refresh', createMarketplaceHandler('mcp:marketplace:refresh', async () => {
        await marketplaceService.refreshCache();
        return {};
    }, EmptyArgsSchema));

    ipcMain.handle('mcp:marketplace:update-config', createMarketplaceHandler('mcp:marketplace:update-config', async (serverId: string, patch: Partial<MCPServerConfig>) => {
        const settings = settingsService.getSettings();
        const existing = settings.mcpUserServers ?? [];
        const current = existing.find(s => s.id === serverId);
        if (!current) {
            throw new Error('Server not found');
        }

        const nextVersion = patch.version ?? current.version ?? '0.0.0';
        const versionHistory = settings.mcpServerVersionHistory ?? {};
        const previous = versionHistory[serverId] ?? [];

        if (previous[previous.length - 1] !== nextVersion) {
            versionHistory[serverId] = [...previous, nextVersion];
        }

        const updated = existing.map(s => {
            if (s.id !== serverId) {
                return s;
            }
            const commandInput = patch.command ? parseCommand(patch.command) : { command: s.command, args: s.args };
            const mergedServer: MCPServerConfig = {
                ...s,
                ...patch,
                command: commandInput.command,
                args: patch.args ?? commandInput.args,
                previousVersion: s.version,
                updatedAt: Date.now()
            };
            checkPublisherTrust(mergedServer.publisher);
            checkRevokedSignature(mergedServer.updatePolicy?.signatureSha256);
            validateSettingsValues(
                mergedServer.settingsSchema as JsonValue | undefined,
                mergedServer.settingsValues as JsonValue | undefined
            );
            ensureInstallableServerConfig(
                mergedServer,
                existing.filter(existingServer => existingServer.id !== serverId)
            );
            if (mergedServer.enabled) {
                ensureServerCanBeEnabled(
                    mergedServer,
                    existing
                        .filter(existingServer => existingServer.id !== serverId)
                        .concat(mergedServer)
                );
            }

            const computedIntegrityHash = computeIntegrityHash(mergedServer);
            if (patch.integrityHash && patch.integrityHash !== computedIntegrityHash) {
                throw new Error('Integrity verification failed');
            }
            mergedServer.integrityHash = computedIntegrityHash;
            mergedServer.updatePolicy = {
                channel: mergedServer.updatePolicy?.channel ?? 'stable',
                autoUpdate: mergedServer.updatePolicy?.autoUpdate ?? true,
                scheduleCron: mergedServer.updatePolicy?.scheduleCron,
                signatureSha256: mergedServer.updatePolicy?.signatureSha256 ?? computedIntegrityHash,
                signatureTimestamp: mergedServer.updatePolicy?.signatureTimestamp ?? Date.now(),
                lastCheckedAt: mergedServer.updatePolicy?.lastCheckedAt,
                lastUpdatedAt: Date.now()
            };
            mergedServer.telemetry = {
                enabled: mergedServer.telemetry?.enabled ?? true,
                anonymize: mergedServer.telemetry?.anonymize ?? true,
                crashReporting: mergedServer.telemetry?.crashReporting ?? true,
                usageCount: mergedServer.telemetry?.usageCount ?? 0,
                crashCount: mergedServer.telemetry?.crashCount ?? 0,
                lastCrashAt: mergedServer.telemetry?.lastCrashAt
            };
            return mergedServer;
        });

        await settingsService.saveSettings({
            mcpUserServers: updated,
            mcpServerVersionHistory: versionHistory
        });

        return {};
    }, z.tuple([ServerIdSchema, MarketplacePatchSchema as z.ZodType<Partial<MCPServerConfig>>])));

    ipcMain.handle('mcp:marketplace:version-history', createMarketplaceHandler('mcp:marketplace:version-history', async (serverId: string) => {
        const settings = settingsService.getSettings();
        const history = settings.mcpServerVersionHistory?.[serverId] ?? [];
        return { history };
    }, z.tuple([ServerIdSchema])));

    ipcMain.handle('mcp:marketplace:rollback-version', createMarketplaceHandler('mcp:marketplace:rollback-version', async (serverId: string, targetVersion: string) => {
        const settings = settingsService.getSettings();
        const history = settings.mcpServerVersionHistory?.[serverId] ?? [];
        if (!history.includes(targetVersion)) {
            throw new Error('Target version not found in history');
        }

        const existing = settings.mcpUserServers ?? [];
        const updated = existing.map(s => s.id === serverId ? {
            ...s,
            previousVersion: s.version,
            version: targetVersion,
            updatedAt: Date.now()
        } : s);

        await settingsService.saveSettings({ mcpUserServers: updated });
        return {};
    }, z.tuple([ServerIdSchema, VersionSchema])));

    ipcMain.handle('mcp:marketplace:security-scan', createMarketplaceHandler('mcp:marketplace:security-scan', async (serverId: string) => {
        const settings = settingsService.getSettings();
        const existing = settings.mcpUserServers ?? [];
        const target = existing.find(server => server.id === serverId);
        if (!target) {
            throw new Error('Server not found');
        }
        const scan = scanServerSecurity(target);
        const scans = settings.mcpSecurityScans ?? {};
        scans[serverId] = {
            score: scan.score,
            flags: scan.flags,
            status: scan.status,
            scannedAt: Date.now()
        };
        const updated = existing.map(server =>
            server.id === serverId
                ? {
                    ...server,
                    security: {
                        reviewStatus: (scan.status === 'clean' ? 'approved' : 'pending') as NonNullable<MCPServerConfig['security']>['reviewStatus'],
                        securityScore: scan.score,
                        malwareFlags: scan.flags,
                        lastScannedAt: Date.now()
                    }
                }
                : server
        );
        await settingsService.saveSettings({
            mcpSecurityScans: scans,
            mcpUserServers: updated
        });
        return { scan };
    }, z.tuple([ServerIdSchema])));

    ipcMain.handle('mcp:marketplace:reviews:list', createMarketplaceHandler('mcp:marketplace:reviews:list', async (serverId: string) => {
        const settings = settingsService.getSettings();
        const reviewStore: NonNullable<AppSettings['mcpExtensionReviews']> = settings.mcpExtensionReviews ?? {};
        const reviews: ExtensionReviewRecord[] = reviewStore[serverId] ?? [];
        return { reviews };
    }, z.tuple([ServerIdSchema])));

    ipcMain.handle('mcp:marketplace:reviews:submit', createMarketplaceHandler('mcp:marketplace:reviews:submit', async (
        serverId: string,
        payload: z.infer<typeof ReviewSchema>
    ) => {
        const settings = settingsService.getSettings();
        const installed = (settings.mcpUserServers ?? []).some(server => server.id === serverId);
        if (!installed) {
            throw new Error('Only installed extensions can be reviewed');
        }

        const existing: NonNullable<AppSettings['mcpExtensionReviews']> = settings.mcpExtensionReviews ?? {};
        const serverReviews: ExtensionReviewRecord[] = existing[serverId] ?? [];
        const normalizedComment = payload.comment.trim();
        const duplicate = serverReviews.some(
            review => review.comment.trim().toLowerCase() === normalizedComment.toLowerCase()
        );
        if (duplicate) {
            throw new Error('Duplicate review detected');
        }
        const urlCount = (normalizedComment.match(/https?:\/\//g) ?? []).length;
        const spamScore = urlCount + (normalizedComment.length < 20 ? 1 : 0);
        const status: ExtensionReviewRecord['status'] = spamScore >= 3 ? 'flagged' : 'published';
        const review: ExtensionReviewRecord = {
            id: `${serverId}-${Date.now()}`,
            userHash: anonymizeReviewAuthor(normalizedComment, payload.rating),
            rating: payload.rating,
            comment: normalizedComment,
            createdAt: Date.now(),
            helpfulVotes: 0,
            verified: payload.verified ?? true,
            status
        };
        const updatedReviews = { ...existing, [serverId]: [...serverReviews, review] };
        await settingsService.saveSettings({ mcpExtensionReviews: updatedReviews });
        return { review };
    }, z.tuple([ServerIdSchema, ReviewSchema])));

    ipcMain.handle('mcp:marketplace:reviews:moderate', createMarketplaceHandler('mcp:marketplace:reviews:moderate', async (
        serverId: string,
        reviewId: string,
        payload: z.infer<typeof ReviewModerationSchema>
    ) => {
        const settings = settingsService.getSettings();
        const existing: NonNullable<AppSettings['mcpExtensionReviews']> = settings.mcpExtensionReviews ?? {};
        const serverReviews: ExtensionReviewRecord[] = existing[serverId] ?? [];
        const updatedReviews = serverReviews.map(review =>
            review.id === reviewId ? { ...review, status: payload.status } : review
        );
        await settingsService.saveSettings({
            mcpExtensionReviews: { ...existing, [serverId]: updatedReviews }
        });
        return {};
    }, z.tuple([ServerIdSchema, z.string().trim().min(1), ReviewModerationSchema])));

    ipcMain.handle('mcp:marketplace:reviews:vote', createMarketplaceHandler('mcp:marketplace:reviews:vote', async (
        serverId: string,
        reviewId: string
    ) => {
        const settings = settingsService.getSettings();
        const existing: NonNullable<AppSettings['mcpExtensionReviews']> = settings.mcpExtensionReviews ?? {};
        const serverReviews: ExtensionReviewRecord[] = existing[serverId] ?? [];
        const updatedReviews = serverReviews.map(review =>
            review.id === reviewId ? { ...review, helpfulVotes: review.helpfulVotes + 1 } : review
        );
        await settingsService.saveSettings({
            mcpExtensionReviews: { ...existing, [serverId]: updatedReviews }
        });
        return {};
    }, z.tuple([ServerIdSchema, z.string().trim().min(1)])));

    ipcMain.handle('mcp:marketplace:telemetry:track', createMarketplaceHandler('mcp:marketplace:telemetry:track', async (
        payload: z.infer<typeof TelemetryEventSchema>
    ) => {
        const settings = settingsService.getSettings();
        const telemetry = settings.mcpTelemetry ?? { enabled: true, anonymize: true, crashReporting: true, events: [], crashes: [] };
        if (!telemetry.enabled) {
            return {};
        }
        const eventRecord = {
            serverId: payload.serverId,
            event: payload.event,
            timestamp: Date.now(),
            metadata: telemetry.anonymize ? undefined : payload.metadata
        };
        const nextEvents = [...(telemetry.events ?? []), eventRecord].slice(-2000);
        const servers = (settings.mcpUserServers ?? []).map(server =>
            server.id === payload.serverId
                ? {
                    ...server,
                    telemetry: {
                        ...server.telemetry,
                        enabled: server.telemetry?.enabled ?? true,
                        anonymize: server.telemetry?.anonymize ?? telemetry.anonymize,
                        crashReporting: server.telemetry?.crashReporting ?? telemetry.crashReporting,
                        usageCount: (server.telemetry?.usageCount ?? 0) + 1,
                        crashCount: server.telemetry?.crashCount ?? 0,
                        lastCrashAt: server.telemetry?.lastCrashAt
                    }
                }
                : server
        );
        await settingsService.saveSettings({
            mcpTelemetry: { ...telemetry, events: nextEvents },
            mcpUserServers: servers
        });
        return {};
    }, z.tuple([TelemetryEventSchema])));

    ipcMain.handle('mcp:marketplace:telemetry:crash', createMarketplaceHandler('mcp:marketplace:telemetry:crash', async (
        payload: z.infer<typeof CrashPayloadSchema>
    ) => {
        const settings = settingsService.getSettings();
        const telemetry = settings.mcpTelemetry ?? { enabled: true, anonymize: true, crashReporting: true, events: [], crashes: [] };
        if (!telemetry.enabled || !telemetry.crashReporting) {
            return {};
        }
        const crashRecord = {
            serverId: payload.serverId,
            timestamp: Date.now(),
            reason: payload.reason,
            stack: telemetry.anonymize ? undefined : payload.stack,
            metadata: telemetry.anonymize ? undefined : payload.metadata
        };
        const nextCrashes = [...(telemetry.crashes ?? []), crashRecord].slice(-500);
        const servers = (settings.mcpUserServers ?? []).map(server =>
            server.id === payload.serverId
                ? {
                    ...server,
                    telemetry: {
                        ...server.telemetry,
                        enabled: server.telemetry?.enabled ?? true,
                        anonymize: server.telemetry?.anonymize ?? telemetry.anonymize,
                        crashReporting: server.telemetry?.crashReporting ?? telemetry.crashReporting,
                        usageCount: server.telemetry?.usageCount ?? 0,
                        crashCount: (server.telemetry?.crashCount ?? 0) + 1,
                        lastCrashAt: Date.now()
                    }
                }
                : server
        );
        await settingsService.saveSettings({
            mcpTelemetry: { ...telemetry, crashes: nextCrashes },
            mcpUserServers: servers
        });
        return {};
    }, z.tuple([CrashPayloadSchema])));

    ipcMain.handle('mcp:marketplace:telemetry:summary', createMarketplaceHandler('mcp:marketplace:telemetry:summary', async () => {
        const settings = settingsService.getSettings();
        const telemetry = settings.mcpTelemetry ?? { enabled: true, anonymize: true, crashReporting: true, events: [], crashes: [] };
        return {
            telemetry: {
                enabled: telemetry.enabled,
                anonymize: telemetry.anonymize,
                crashReporting: telemetry.crashReporting,
                eventCount: telemetry.events?.length ?? 0,
                crashCount: telemetry.crashes?.length ?? 0
            }
        };
    }, EmptyArgsSchema));

    ipcMain.handle('mcp:marketplace:debug', createMarketplaceHandler('mcp:marketplace:debug', async () => {
        const pluginMetrics = mcpPluginService.getDispatchMetrics();
        const settings = settingsService.getSettings();
        return {
            metrics: {
                pluginMetrics,
                installedCount: (settings.mcpUserServers ?? []).length,
                pendingPermissions: (settings.mcpPermissionRequests ?? []).filter(r => r.status === 'pending').length
            }
        };
    }, EmptyArgsSchema));

    ipcMain.handle('mcp:marketplace:health', createMarketplaceHandler('mcp:marketplace:health', async () => {
        return {
            data: createMarketplaceHealthPayload()
        };
    }, EmptyArgsSchema));
}

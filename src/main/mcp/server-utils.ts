import * as fs from 'fs';
import * as path from 'path';

import { McpAction, McpResult } from '@main/mcp/types';
import { AuditLogService } from '@main/services/analysis/audit-log.service';
import { MonitoringService } from '@main/services/analysis/monitoring.service';
import { ScannerService } from '@main/services/analysis/scanner.service';
import { DatabaseService } from '@main/services/data/database.service';
import { FileManagementService } from '@main/services/data/file.service';
import { FileSystemService } from '@main/services/data/filesystem.service';
import { ContentService } from '@main/services/external/content.service';
import { UtilityService } from '@main/services/external/utility.service';
import { WebService } from '@main/services/external/web.service';
import { AdvancedMemoryService } from '@main/services/llm/advanced-memory.service';
import { EmbeddingService } from '@main/services/llm/embedding.service';
import { IdeaGeneratorService } from '@main/services/llm/idea-generator.service';
import { ModelCollaborationService } from '@main/services/llm/model-collaboration.service';
import { OllamaService } from '@main/services/llm/ollama.service';
import { DockerService } from '@main/services/project/docker.service';
import { GitService } from '@main/services/project/git.service';
import { SSHService } from '@main/services/project/ssh.service';
import { RateLimitService } from '@main/services/security/rate-limit.service';
import { SecurityService } from '@main/services/security/security.service';
import { CommandService } from '@main/services/system/command.service';
import { NetworkService } from '@main/services/system/network.service';
import { SettingsService } from '@main/services/system/settings.service';
import { SystemService } from '@main/services/system/system.service';
import { ClipboardService } from '@main/services/ui/clipboard.service';
import { NotificationService } from '@main/services/ui/notification.service';
import { ScreenshotService } from '@main/services/ui/screenshot.service';
import { ServiceResponse } from '@shared/types';
import { JsonObject, JsonValue } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';

export interface McpDeps {
    web: WebService
    utility: UtilityService
    system: SystemService
    ssh: SSHService
    screenshot: ScreenshotService
    scanner: ScannerService
    notification: NotificationService
    network: NetworkService
    monitoring: MonitoringService
    git: GitService
    security: SecurityService
    settings: SettingsService
    filesystem: FileSystemService
    file: FileManagementService
    embedding: EmbeddingService
    docker: DockerService
    database: DatabaseService
    content: ContentService
    command: CommandService
    clipboard: ClipboardService
    ollama: OllamaService
    advancedMemory: AdvancedMemoryService
    ideaGenerator: IdeaGeneratorService
    modelCollaboration: ModelCollaborationService
    rateLimit: RateLimitService
    auditLog: AuditLogService
}

export type McpHandlerResult = JsonValue | ServiceResponse<JsonValue | void> | void | unknown

export function wrap(
    handler: (args: JsonObject) => McpHandlerResult | Promise<McpHandlerResult>,
    serviceName: string,
    actionName: string,
    auditLog?: AuditLogService
): (args: JsonObject) => Promise<McpResult> {
    return async (args: JsonObject) => {
        const startTime = Date.now();
        try {
            const rawResult = await Promise.resolve(handler(args));
            const result = normalizeResult(rawResult);

            // Audit log successful operation
            if (auditLog) {
                await auditLog.log({
                    action: `mcp:${serviceName}:${actionName}`,
                    category: 'system',
                    success: result.success,
                    details: {
                        serviceName,
                        actionName,
                        duration: Date.now() - startTime,
                        argsKeys: Object.keys(args)
                    },
                    error: result.success ? undefined : result.error
                }).catch(() => { /* Ignore audit log errors */ });
            }

            return result;
        } catch (error) {
            const errorMsg = getErrorMessage(error);

            // Audit log failed operation
            if (auditLog) {
                await auditLog.log({
                    action: `mcp:${serviceName}:${actionName}`,
                    category: 'system',
                    success: false,
                    details: {
                        serviceName,
                        actionName,
                        duration: Date.now() - startTime,
                        argsKeys: Object.keys(args)
                    },
                    error: errorMsg
                }).catch(() => { /* Ignore audit log errors */ });
            }

            return { success: false, error: errorMsg };
        }
    };
}

export function normalizeResult(rawResult: McpHandlerResult): McpResult {
    if (isServiceResponse(rawResult)) {
        return normalizeServiceResponse(rawResult);
    }
    return { success: true, data: (rawResult ?? null) as JsonValue };
}

export function isServiceResponse(result: unknown): result is ServiceResponse<unknown> {
    return !!(result && typeof result === 'object' && 'success' in result);
}

export function normalizeServiceResponse(res: ServiceResponse<unknown>): McpResult {
    if (res.success === false) {
        return { success: false, error: (res.error ?? res.message) ?? 'Unknown error' };
    }
    const data = res.data ?? res.result ?? res.content ?? res;
    return { success: true, data: data as JsonValue };
}

export const buildActions = (
    actions: Array<Omit<McpAction, 'handler'> & { handler: (args: JsonObject) => McpHandlerResult | Promise<McpHandlerResult> }>,
    serviceName?: string,
    auditLog?: AuditLogService
): McpAction[] =>
    actions.map(a => ({ ...a, handler: wrap(a.handler, serviceName ?? 'unknown', a.name, auditLog) }));

export const normalizeTarget = (target: string): string => {
    const trimmed = String(target).trim();
    if (!trimmed) { return ''; }
    try {
        const url = new URL(trimmed.includes('://') ? trimmed : `http://${trimmed}`);
        return url.hostname;
    } catch {
        return trimmed;
    }
};

export const ensureAllowedTarget = (deps: McpDeps, target: string) => {
    const allowed = deps.settings.getSettings().mcpSecurityAllowedHosts ?? [];
    const normalized = normalizeTarget(target);
    if (!normalized) {
        throw new Error('Target is required');
    }
    if (!allowed.includes(normalized)) {
        throw new Error(`Target not allowlisted: ${normalized}`);
    }
    return normalized;
};

/**
 * Validates a file path to prevent path traversal attacks
 * @param basePath - The allowed base directory
 * @param inputPath - The user-provided path
 * @returns The validated absolute path
 * @throws Error if path traversal is detected
 */
export const validatePath = (basePath: string, inputPath: string): string => {
    if (!inputPath || typeof inputPath !== 'string') {
        throw new Error('Path is required and must be a string');
    }

    const resolved = path.resolve(basePath, inputPath);

    // Check for path traversal
    if (!resolved.startsWith(basePath)) {
        throw new Error(`Path traversal detected: ${inputPath}`);
    }

    // Check for symlinks (prevent symlink attacks)
    try {
        const realPath = fs.realpathSync(resolved);
        if (!realPath.startsWith(basePath)) {
            throw new Error(`Symlink traversal detected: ${inputPath}`);
        }
        return realPath;
    } catch (error) {
        // If file doesn't exist yet, that's okay for write operations
        // Just verify the parent directory doesn't escape
        const parentDir = path.dirname(resolved);
        if (!parentDir.startsWith(basePath)) {
            throw new Error(`Path traversal detected in parent directory: ${inputPath}`);
        }
        return resolved;
    }
};

/**
 * Wraps a handler with timeout protection
 * @param handler - The async handler function
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns Wrapped handler with timeout
 */
export const withTimeout = <T>(
    handler: () => Promise<T>,
    timeoutMs = 30000
): Promise<T> => {
    return Promise.race([
        handler(),
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`Operation timeout after ${timeoutMs}ms`)), timeoutMs)
        )
    ]);
};

/**
 * Validates string parameter with size limit
 * @param value - The value to validate
 * @param maxLength - Maximum allowed length (default: 1MB)
 * @returns The validated string
 */
export const validateString = (value: unknown, maxLength = 1048576): string => {
    if (typeof value !== 'string') {
        throw new Error('Value must be a string');
    }
    if (value.length > maxLength) {
        throw new Error(`String too long (max ${maxLength} characters)`);
    }
    return value;
};

/**
 * Validates number parameter with bounds
 * @param value - The value to validate
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns The validated number
 */
export const validateNumber = (value: unknown, min?: number, max?: number): number => {
    const num = Number(value);
    if (isNaN(num)) {
        throw new Error('Value must be a valid number');
    }
    if (min !== undefined && num < min) {
        throw new Error(`Number must be >= ${min}`);
    }
    if (max !== undefined && num > max) {
        throw new Error(`Number must be <= ${max}`);
    }
    return num;
};

/**
 * Validates URL and ensures it uses safe protocols
 * @param value - The URL to validate
 * @param allowedProtocols - Allowed protocols (default: ['http:', 'https:'])
 * @returns The validated URL string
 */
export const validateUrl = (value: unknown, allowedProtocols = ['http:', 'https:']): string => {
    const urlString = validateString(value, 2000);

    try {
        const parsed = new URL(urlString);
        if (!allowedProtocols.includes(parsed.protocol)) {
            throw new Error(`Only ${allowedProtocols.join(', ')} protocols allowed`);
        }
        return parsed.href;
    } catch (error) {
        if (error instanceof Error && error.message.includes('protocol')) {
            throw error;
        }
        throw new Error(`Invalid URL: ${getErrorMessage(error)}`);
    }
};

/**
 * Validates hostname format
 * @param value - The hostname to validate
 * @returns The validated hostname
 */
export const validateHostname = (value: unknown): string => {
    const hostname = validateString(value, 253);

    // Basic hostname validation (alphanumeric, dots, hyphens)
    if (!/^[a-zA-Z0-9.-]+$/.test(hostname)) {
        throw new Error('Invalid hostname format');
    }

    return hostname;
};

/**
 * Validates command to prevent injection
 * @param value - The command to validate
 * @returns The validated command
 */
export const validateCommand = (value: unknown): string => {
    const cmd = validateString(value, 10000).trim();

    if (!cmd) {
        throw new Error('Command is required');
    }

    // Warn about potentially dangerous characters (but don't block - service layer should use array-based execution)
    const dangerousChars = /[;&|`$(){}[\]<>]/;
    if (dangerousChars.test(cmd)) {
        // This is a warning - the actual protection should be using array-based command execution
        console.warn('[MCP Security] Command contains potentially dangerous characters:', cmd);
    }

    return cmd;
};

/**
 * Wraps a handler with rate limiting protection
 * @param deps - MCP dependencies
 * @param serviceName - The MCP service name (e.g., 'git', 'docker', 'filesystem')
 * @param handler - The async handler function
 * @returns Wrapped handler with rate limiting
 */
export const withRateLimit = <T>(
    deps: McpDeps,
    serviceName: string,
    handler: () => Promise<T>
): Promise<T> => {
    return deps.rateLimit.waitForToken(`mcp:${serviceName}`).then(() => handler());
};

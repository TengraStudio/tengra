import { McpAction, McpResult } from '@main/mcp/types';
import { MonitoringService } from '@main/services/analysis/monitoring.service';
import { ScannerService } from '@main/services/analysis/scanner.service';
import { DatabaseService } from '@main/services/data/database.service';
import { FileManagementService } from '@main/services/data/file.service';
import { FileSystemService } from '@main/services/data/filesystem.service';
import { ContentService } from '@main/services/external/content.service';
import { UtilityService } from '@main/services/external/utility.service';
import { WebService } from '@main/services/external/web.service';
import { EmbeddingService } from '@main/services/llm/embedding.service';
import { OllamaService } from '@main/services/llm/ollama.service';
import { DockerService } from '@main/services/project/docker.service';
import { GitService } from '@main/services/project/git.service';
import { SSHService } from '@main/services/project/ssh.service';
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
import { AdvancedMemoryService } from '@main/services/llm/advanced-memory.service';
import { IdeaGeneratorService } from '@main/services/llm/idea-generator.service';
import { ModelCollaborationService } from '@main/services/llm/model-collaboration.service';

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
}

export type McpHandlerResult = JsonValue | ServiceResponse<JsonValue | void> | void | unknown

export function wrap(handler: (args: JsonObject) => McpHandlerResult | Promise<McpHandlerResult>): (args: JsonObject) => Promise<McpResult> {
    return async (args: JsonObject) => {
        try {
            const rawResult = await Promise.resolve(handler(args));
            return normalizeResult(rawResult);
        } catch (error) {
            return { success: false, error: getErrorMessage(error) };
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

export const buildActions = (actions: Array<Omit<McpAction, 'handler'> & { handler: (args: JsonObject) => McpHandlerResult | Promise<McpHandlerResult> }>): McpAction[] =>
    actions.map(a => ({ ...a, handler: wrap(a.handler) }));

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

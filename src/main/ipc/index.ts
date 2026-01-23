import { registerAgentIpc } from '@main/ipc/agent';
import { registerAuditIpc } from '@main/ipc/audit';
import { registerAuthIpc } from '@main/ipc/auth';
import { registerBackupIpc } from '@main/ipc/backup';
import { registerChatIpc } from '@main/ipc/chat';
import { registerCodeIntelligenceIpc } from '@main/ipc/code-intelligence';
import { registerCollaborationIpc } from '@main/ipc/collaboration';
import { registerCouncilIpc } from '@main/ipc/council';
import { registerDbIpc } from '@main/ipc/db';
import { registerDialogIpc } from '@main/ipc/dialog';
import { registerExportIpc } from '@main/ipc/export';
import { registerFilesIpc } from '@main/ipc/files';
import { registerGalleryIpc } from '@main/ipc/gallery';
import { registerGitIpc } from '@main/ipc/git';
import { registerHealthIpc } from '@main/ipc/health';
import { registerHistoryIpc } from '@main/ipc/history';
import { registerHFModelIpc } from '@main/ipc/huggingface';
import { registerKeyRotationIpc } from '@main/ipc/key-rotation';
import { registerLlamaIpc } from '@main/ipc/llama';
import { registerLoggingIpc } from '@main/ipc/logging';
import { registerMcpIpc } from '@main/ipc/mcp';
import { registerMemoryIpc } from '@main/ipc/memory';
import { registerMetricsIpc } from '@main/ipc/metrics';
import { registerMigrationIpc } from '@main/ipc/migration';
import { registerMultiModelIpc } from '@main/ipc/multi-model';
import { registerOllamaIpc } from '@main/ipc/ollama';
import { registerPerformanceIpc } from '@main/ipc/performance';
import { registerProcessIpc, setupProcessEvents } from '@main/ipc/process';
import { registerProjectIpc } from '@main/ipc/project';
import { registerPromptTemplatesIpc } from '@main/ipc/prompt-templates';
import { registerProxyIpc } from '@main/ipc/proxy';
import { registerProxyEmbedIpc } from '@main/ipc/proxy-embed';
import { registerScreenshotIpc } from '@main/ipc/screenshot';
import { registerSettingsIpc } from '@main/ipc/settings';
import { registerSshIpc } from '@main/ipc/ssh';
import { registerTerminalIpc } from '@main/ipc/terminal';
import { registerTokenEstimationIpc } from '@main/ipc/token-estimation';
import { registerToolsIpc } from '@main/ipc/tools';
import { registerUsageIpc } from '@main/ipc/usage';
// Import all IPC registration functions
import { registerWindowIpc } from '@main/ipc/window';
import { McpDispatcher } from '@main/mcp/dispatcher';
import { Services } from '@main/startup/services';
import { ToolExecutor } from '@main/tools/tool-executor';
import { registerBatchIpc } from '@main/utils/ipc-batch.util';
import { BrowserWindow } from 'electron';

/**
 * Registers all Inter-Process Communication handlers.
 * NASA Rule 5: Keep functions short. This function delegates to specific registers.
 */
export function registerAllIpc(
    mainWindowGetter: () => BrowserWindow | null,
    services: Services,
    mcpDispatcher: McpDispatcher,
    toolExecutor: ToolExecutor,
    allowedFileRoots: Set<string>
): void {
    const getWin = mainWindowGetter;

    // Window & System
    registerWindowIpc(getWin);
    registerProcessIpc(services.processService);
    setupProcessEvents(services.processService);
    registerLoggingIpc();
    registerDialogIpc(getWin);
    registerHealthIpc(services.healthCheckService);
    registerMigrationIpc(services.databaseService);
    registerScreenshotIpc();

    // UI & Navigation
    registerGalleryIpc(services.dataService.getPath('gallery'));
    registerExportIpc(getWin);
    registerSettingsIpc({
        settingsService: services.settingsService,
        llmService: services.llmService,
        copilotService: services.copilotService,
        auditLogService: services.auditLogService,
        updateOpenAIConnection: () => {
            getWin()?.webContents.send('openai:connection-status', services.llmService.isOpenAIConnected());
        },
        updateOllamaConnection: async () => {
            try {
                const status = await services.ollamaHealthService.checkHealth();
                getWin()?.webContents.send('ollama:connection-status', status.online);
            } catch (error) {
                console.error('[IPC] Failed to check Ollama connection:', error);
                getWin()?.webContents.send('ollama:connection-status', false);
            }
        }
    });

    // Content & Data
    registerDbIpc(getWin, services.databaseService, services.embeddingService, services.auditLogService);
    registerFilesIpc(getWin, services.fileSystemService, allowedFileRoots);
    registerAuditIpc(services.auditLogService);
    registerPerformanceIpc(services.performanceService);
    registerMetricsIpc();

    // AI & LLM
    registerAuthIpc(services.proxyService, services.settingsService, services.copilotService, services.authService);
    registerProxyIpc(services.proxyService);
    registerProxyEmbedIpc(services.proxyService);
    registerUsageIpc(services.usageTrackingService, services.settingsService, services.proxyService);
    registerChatIpc({
        settingsService: services.settingsService,
        copilotService: services.copilotService,
        llmService: services.llmService,
        proxyService: services.proxyService,
        codeIntelligenceService: services.codeIntelligenceService,
        contextRetrievalService: services.contextRetrievalService
    });
    registerOllamaIpc({
        localAIService: services.localAIService,
        settingsService: services.settingsService,
        llmService: services.llmService,
        ollamaService: services.ollamaService,
        ollamaHealthService: services.ollamaHealthService,
        proxyService: services.proxyService
    });
    registerLlamaIpc(services.llamaService);
    registerHFModelIpc(services.llmService, services.huggingFaceService);
    registerTokenEstimationIpc();
    registerKeyRotationIpc(services.keyRotationService);
    registerCollaborationIpc(services.modelCollaborationService);
    registerMultiModelIpc(services.multiModelComparisonService);

    // Productivity & Tools
    registerSshIpc(getWin, services.sshService);
    registerProjectIpc(getWin, {
        projectService: services.projectService,
        logoService: services.logoService,
        codeIntelligenceService: services.codeIntelligenceService,
        jobSchedulerService: services.jobSchedulerService,
        databaseService: services.databaseService
    });
    registerAgentIpc(services.agentService);
    registerCodeIntelligenceIpc(services.codeIntelligenceService);
    registerMemoryIpc(services.memoryService);
    registerGitIpc(services.gitService);
    registerPromptTemplatesIpc(services.promptTemplatesService);
    registerHistoryIpc(services.historyImportService);
    registerCouncilIpc(services.agentCouncilService, services.databaseService);
    registerTerminalIpc(getWin);

    // External Integrations
    registerToolsIpc(toolExecutor, services.commandService);
    registerMcpIpc(mcpDispatcher);

    // Backup & Restore
    registerBackupIpc(services.backupService);

    // IPC Batching
    registerBatchIpc();
}

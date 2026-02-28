import { registerAgentIpc } from '@main/ipc/agent';
import { registerAuditIpc } from '@main/ipc/audit';
import { registerAuthIpc } from '@main/ipc/auth';
import { registerBackupIpc } from '@main/ipc/backup';
import { registerBrainIpcHandlers } from '@main/ipc/brain';
import { registerChatIpc } from '@main/ipc/chat';
import { registerCodeIntelligenceIpc } from '@main/ipc/code-intelligence';
import { registerCodeSandboxIpc } from '@main/ipc/code-sandbox';
import { registerCollaborationIpc } from '@main/ipc/collaboration';
import { registerContractIpc } from '@main/ipc/contract';
import { registerDbIpc } from '@main/ipc/db';
import { registerDialogIpc } from '@main/ipc/dialog';
import { registerExportIpc } from '@main/ipc/export';
import { registerFilesIpc } from '@main/ipc/files';
import { registerGalleryIpc } from '@main/ipc/gallery';
import { registerGitIpc } from '@main/ipc/git';
import { registerHealthIpc } from '@main/ipc/health';
import { registerHFModelIpc } from '@main/ipc/huggingface';
import { registerKeyRotationIpc } from '@main/ipc/key-rotation';
import { registerLazyServicesIpc } from '@main/ipc/lazy-services';
import { registerLlamaIpc } from '@main/ipc/llama';
import { registerLoggingIpc } from '@main/ipc/logging';
import { registerMarketplaceIpc } from '@main/ipc/marketplace';
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
import { registerSdCppIpc } from '@main/ipc/sd-cpp';
import { registerSettingsIpc } from '@main/ipc/settings';
import { registerSshIpc } from '@main/ipc/ssh';
import { registerTerminalIpc } from '@main/ipc/terminal';
import { registerTokenEstimationIpc } from '@main/ipc/token-estimation';
import { registerToolsIpc } from '@main/ipc/tools';
import { registerUsageIpc } from '@main/ipc/usage';
import { registerVoiceIpc } from '@main/ipc/voice';
// Import all IPC registration functions
import { registerWindowIpc } from '@main/ipc/window';
import { appLogger } from '@main/logging/logger';
import { McpDispatcher } from '@main/mcp/dispatcher';
import { Services } from '@main/startup/services';
import { ToolExecutor } from '@main/tools/tool-executor';
import { registerBatchIpc } from '@main/utils/ipc-batch.util';
import { BrowserWindow } from 'electron';

/**
 * Registers all Inter-Process Communication handlers.
 * NASA Rule 5: Keep functions short. This function delegates to specific registers.
 */
export async function registerAllIpc(
    mainWindowGetter: () => BrowserWindow | null,
    services: Services,
    mcpDispatcher: McpDispatcher,
    toolExecutor: ToolExecutor,
    allowedFileRoots: Set<string>
): Promise<void> {
    const getWin = mainWindowGetter;
    const [logoService, sshService, dockerService, marketplaceService] = await Promise.all([
        services.logoService.resolve(),
        services.sshService.resolve(),
        services.dockerService.resolve(),
        services.marketplaceService.resolve(),
    ]);

    // Window & System
    registerWindowIpc(getWin, allowedFileRoots);
    registerLazyServicesIpc();
    registerContractIpc();
    registerCodeSandboxIpc();
    registerProcessIpc(getWin, services.processService);
    setupProcessEvents(services.processService);
    registerLoggingIpc();
    registerDialogIpc(getWin);
    registerHealthIpc(services.healthCheckService);
    registerMigrationIpc(services.databaseService);
    registerScreenshotIpc();

    // UI & Navigation
    registerGalleryIpc(services.dataService.getPath('gallery'));
    registerExportIpc(services.exportService);
    registerSettingsIpc({
        settingsService: services.settingsService,
        llmService: services.llmService,
        copilotService: services.copilotService,
        auditLogService: services.auditLogService,
        updateOpenAIConnection: () => {
            getWin()?.webContents.send(
                'openai:connection-status',
                services.llmService.isOpenAIConnected()
            );
        },
        updateOllamaConnection: async () => {
            try {
                const status = await services.ollamaHealthService.checkHealth();
                getWin()?.webContents.send('ollama:connection-status', status.online);
            } catch (error) {
                appLogger.error('IPC', 'Failed to check Ollama connection', error as Error);
                getWin()?.webContents.send('ollama:connection-status', false);
            }
        },
    });

    // Content & Data
    registerDbIpc(
        getWin,
        services.databaseService,
        services.embeddingService,
        services.auditLogService
    );
    registerFilesIpc(getWin, services.fileSystemService, allowedFileRoots, services.auditLogService);
    registerAuditIpc(services.auditLogService);
    registerPerformanceIpc(services.performanceService);
    registerMetricsIpc();

    // AI & LLM
    registerAuthIpc({
        proxyService: services.proxyService,
        copilotService: services.copilotService,
        authService: services.authService,
        auditLogService: services.auditLogService,
        getMainWindow: getWin,
        eventBus: services.eventBusService,
    });
    registerProxyIpc(
        services.proxyService,
        undefined,
        services.authService,
        getWin,
        services.eventBusService
    );
    registerProxyEmbedIpc(services.proxyService);
    registerUsageIpc(
        services.usageTrackingService,
        services.settingsService,
        services.proxyService
    );
    registerChatIpc({
        settingsService: services.settingsService,
        copilotService: services.copilotService,
        llmService: services.llmService,
        proxyService: services.proxyService,
        codeIntelligenceService: services.codeIntelligenceService,
        contextRetrievalService: services.contextRetrievalService,
        databaseService: services.databaseService,
    });
    registerOllamaIpc({
        localAIService: services.localAIService,
        settingsService: services.settingsService,
        llmService: services.llmService,
        ollamaService: services.ollamaService,
        ollamaHealthService: services.ollamaHealthService,
        proxyService: services.proxyService,
        rateLimitService: services.rateLimitService,
    });
    registerLlamaIpc(services.llamaService);
    registerHFModelIpc(services.llmService, services.huggingFaceService);
    registerTokenEstimationIpc();
    registerVoiceIpc();
    registerKeyRotationIpc(services.keyRotationService);
    registerCollaborationIpc(services.modelCollaborationService);
    registerMultiModelIpc(services.multiModelComparisonService);
    registerSdCppIpc(services.localImageService);
    registerMarketplaceIpc({
        marketplaceService,
        rateLimitService: services.rateLimitService,
    });

    // Productivity & Tools
    registerSshIpc(getWin, sshService, services.rateLimitService);
    registerProjectIpc(getWin, {
        projectService: services.projectService,
        logoService,
        inlineSuggestionService: services.inlineSuggestionService,
        codeIntelligenceService: services.codeIntelligenceService,
        jobSchedulerService: services.jobSchedulerService,
        databaseService: services.databaseService,
        auditLogService: services.auditLogService,
    });
    registerAgentIpc(services.agentService);
    registerCodeIntelligenceIpc(services.codeIntelligenceService);
    registerMemoryIpc(services.memoryService);
    registerBrainIpcHandlers(services.brainService);
    registerGitIpc(services.gitService);
    registerPromptTemplatesIpc(services.promptTemplatesService);

    registerTerminalIpc(
        getWin,
        services.terminalService,
        services.terminalProfileService,
        services.terminalSmartService,
        dockerService
    );

    // External Integrations
    registerToolsIpc(toolExecutor, services.commandService);
    registerMcpIpc(mcpDispatcher, getWin);


    // Backup & Restore
    registerBackupIpc(services.backupService);

    // IPC Batching
    registerBatchIpc();
}

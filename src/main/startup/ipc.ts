import { registerAdvancedMemoryIpc } from '@main/ipc/advanced-memory';
import { registerAgentIpc } from '@main/ipc/agent';
import { registerAuditIpc } from '@main/ipc/audit';
import { registerAuthIpc } from '@main/ipc/auth';
import { registerBackupIpc } from '@main/ipc/backup';
import { registerBrainIpcHandlers } from '@main/ipc/brain';
import { registerChatIpc } from '@main/ipc/chat';
import { registerClipboardIpc } from '@main/ipc/clipboard';
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
import { registerIdeaGeneratorIpc } from '@main/ipc/idea-generator';
import { registerKeyRotationIpc } from '@main/ipc/key-rotation';
import { registerLazyServicesIpc } from '@main/ipc/lazy-services';
import { registerLlamaIpc } from '@main/ipc/llama';
import { registerLoggingIpc } from '@main/ipc/logging';
import { registerMarketplaceIpc } from '@main/ipc/marketplace';
import { registerMcpIpc } from '@main/ipc/mcp';
import { registerMcpMarketplaceHandlers } from '@main/ipc/mcp-marketplace';
import { registerMemoryIpc } from '@main/ipc/memory';
import { registerMetricsIpc } from '@main/ipc/metrics';
import { registerMigrationIpc } from '@main/ipc/migration';
import { registerModelDownloaderIpc } from '@main/ipc/model-downloader';
import { registerModelRegistryIpc } from '@main/ipc/model-registry';
import { registerMultiModelIpc } from '@main/ipc/multi-model';
import { registerOllamaIpc } from '@main/ipc/ollama';
import { registerOrchestratorIpc } from '@main/ipc/orchestrator';
import { registerPerformanceIpc } from '@main/ipc/performance';
import { registerProcessIpc, setupProcessEvents } from '@main/ipc/process';
import { registerProjectIpc } from '@main/ipc/project';
import { registerProjectAgentIpc } from '@main/ipc/project-agent';
import { registerPromptTemplatesIpc } from '@main/ipc/prompt-templates';
import { registerProxyIpc } from '@main/ipc/proxy';
import { registerProxyEmbedIpc } from '@main/ipc/proxy-embed';
import { registerScreenshotIpc } from '@main/ipc/screenshot';
import { registerSettingsIpc } from '@main/ipc/settings';
import { registerSshIpc } from '@main/ipc/ssh';
import { registerTerminalIpc } from '@main/ipc/terminal';
import { registerThemeIpc } from '@main/ipc/theme';
import { registerTokenEstimationIpc } from '@main/ipc/token-estimation';
import { registerToolsIpc } from '@main/ipc/tools';
import { registerUsageIpc } from '@main/ipc/usage';
import { registerVoiceIpc } from '@main/ipc/voice';
import { registerWindowIpc } from '@main/ipc/window';
import { registerWorkflowIpc } from '@main/ipc/workflow';
import { appLogger } from '@main/logging/logger';
import { McpDispatcher } from '@main/mcp/dispatcher';
import { Services } from '@main/startup/services';
import { ToolExecutor } from '@main/tools/tool-executor';
import { registerBatchIpc } from '@main/utils/ipc-batch.util';
import { setIpcEventBus } from '@main/utils/ipc-wrapper.util';
import { BrowserWindow } from 'electron';

export async function registerIpcHandlers(
    services: Services,
    toolExecutor: ToolExecutor,
    getMainWindow: () => BrowserWindow | null,
    allowedFileRoots: Set<string>,
    mcpDispatcher: McpDispatcher
): Promise<void> {
    setIpcEventBus(services.eventBusService);
    const [logoService, sshService, dockerService, marketplaceService] = await Promise.all([
        services.logoService.resolve(),
        services.sshService.resolve(),
        services.dockerService.resolve(),
        services.marketplaceService.resolve(),
    ]);

    // Registers
    registerWindowIpc(getMainWindow, allowedFileRoots);
    registerLazyServicesIpc();
    registerContractIpc();
    registerCodeSandboxIpc(getMainWindow);
    registerModelRegistryIpc(services.modelRegistryService, services.rateLimitService);
    registerModelDownloaderIpc(services.modelDownloaderService);
    registerAuditIpc(services.auditLogService);
    registerPerformanceIpc(services.performanceService);
    registerMetricsIpc();
    registerHealthIpc(services.healthCheckService);
    registerMigrationIpc(services.databaseService);

    registerAuthIpc({
        proxyService: services.proxyService,
        copilotService: services.copilotService,
        authService: services.authService,
        auditLogService: services.auditLogService,
        getMainWindow,
        eventBus: services.eventBusService,
    });
    registerProxyIpc(
        services.proxyService,
        undefined,
        services.authService,
        getMainWindow,
        services.eventBusService
    );
    registerUsageIpc(
        services.usageTrackingService,
        services.settingsService,
        services.proxyService
    );
    registerKeyRotationIpc(getMainWindow, services.keyRotationService);

    registerChatIpc({
        getMainWindow,
        settingsService: services.settingsService,
        copilotService: services.copilotService,
        llmService: services.llmService,
        proxyService: services.proxyService,
        codeIntelligenceService: services.codeIntelligenceService,
        contextRetrievalService: services.contextRetrievalService,
        databaseService: services.databaseService,
        rateLimitService: services.rateLimitService,
    });

    registerOllamaIpc({
        getMainWindow,
        localAIService: services.localAIService,
        settingsService: services.settingsService,
        llmService: services.llmService,
        ollamaService: services.ollamaService,
        ollamaHealthService: services.ollamaHealthService,
        proxyService: services.proxyService,
        rateLimitService: services.rateLimitService,
    });

    registerProjectIpc(getMainWindow, {
        projectService: services.projectService,
        logoService,
        inlineSuggestionService: services.inlineSuggestionService,
        codeIntelligenceService: services.codeIntelligenceService,
        jobSchedulerService: services.jobSchedulerService,
        databaseService: services.databaseService,
        auditLogService: services.auditLogService,
    });
    registerAgentIpc(getMainWindow, services.agentService);
    registerProcessIpc(getMainWindow, services.processService);
    setupProcessEvents(services.processService);
    registerCodeIntelligenceIpc(services.codeIntelligenceService);

    registerDbIpc(getMainWindow, services.databaseService, services.embeddingService);
    registerLlamaIpc(getMainWindow, services.llamaService);
    registerMemoryIpc(getMainWindow, services.memoryService);
    registerAdvancedMemoryIpc(services.advancedMemoryService);
    registerBrainIpcHandlers(getMainWindow, services.brainService);
    registerGitIpc(getMainWindow, services.gitService);

    registerSettingsIpc({
        getMainWindow,
        settingsService: services.settingsService,
        llmService: services.llmService,
        copilotService: services.copilotService,
        auditLogService: services.auditLogService,
        updateOpenAIConnection: () => {
            const mainWindow = getMainWindow();
            if (mainWindow) {
                mainWindow.webContents.send(
                    'openai:connection-status',
                    services.llmService.isOpenAIConnected()
                );
            }
        },
        updateOllamaConnection: async () => {
            const mainWindow = getMainWindow();
            if (mainWindow) {
                try {
                    const status = await services.ollamaHealthService.checkHealth();
                    mainWindow.webContents.send('ollama:connection-status', status.online);
                } catch (error) {
                    appLogger.error('IPC', `Failed to check Ollama connection: ${error}`);
                    mainWindow.webContents.send('ollama:connection-status', false);
                }
            }
        },
    });

    registerSshIpc(getMainWindow, sshService, services.rateLimitService);
    registerFilesIpc(getMainWindow, services.fileSystemService, allowedFileRoots, services.auditLogService);
    registerHFModelIpc(services.llmService, services.huggingFaceService);
    registerMultiModelIpc(services.multiModelComparisonService);
    registerCollaborationIpc(getMainWindow, services.modelCollaborationService);

    registerToolsIpc(getMainWindow, toolExecutor, services.commandService);
    registerMcpIpc(mcpDispatcher, getMainWindow);
    registerMcpMarketplaceHandlers(
        services.mcpMarketplaceService,
        services.settingsService,
        services.mcpPluginService
    );

    registerScreenshotIpc(getMainWindow);
    registerLoggingIpc();
    registerClipboardIpc(services.clipboardService);

    // Terminal needs the instance - use getter for deferred access
    registerTerminalIpc(
        getMainWindow,
        services.terminalService,
        services.terminalProfileService,
        services.terminalSmartService,
        dockerService
    );

    registerDialogIpc(getMainWindow);

    registerProxyEmbedIpc(services.proxyService);
    registerExportIpc(getMainWindow, services.exportService);

    // Prompt Templates
    registerPromptTemplatesIpc(getMainWindow, services.promptTemplatesService);

    // Register Gallery IPC
    registerGalleryIpc(services.dataService.getPath('gallery'), services.databaseService);

    // Register Idea Generator IPC
    registerIdeaGeneratorIpc(services.ideaGeneratorService, services.eventBusService);

    services.projectAgentService.setToolExecutor(toolExecutor);
    registerProjectAgentIpc(services.projectAgentService, getMainWindow, services.databaseService);

    // Register Multi-Agent Orchestrator IPC
    registerOrchestratorIpc(services.multiAgentOrchestratorService, getMainWindow);

    // Token Estimation
    registerTokenEstimationIpc();
    registerVoiceIpc();

    // Backup & Restore
    registerBackupIpc(getMainWindow, services.backupService);

    // Theme Management
    registerThemeIpc(services.themeService);

    // Marketplace
    registerMarketplaceIpc({
        marketplaceService,
        rateLimitService: services.rateLimitService,
    });

    // Workflow Automation
    registerWorkflowIpc(services.workflowService);

    // Register Batch IPC
    registerBatchIpc();
}

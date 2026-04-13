import { registerAdvancedMemoryIpc } from '@main/ipc/advanced-memory';
import { registerAgentIpc } from '@main/ipc/agent';
import { registerAuditIpc } from '@main/ipc/audit';
import { registerAuthIpc } from '@main/ipc/auth';
import { registerBackupIpc } from '@main/ipc/backup';
import { registerBrainIpcHandlers } from '@main/ipc/brain';
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
import { registerKeyRotationIpc } from '@main/ipc/key-rotation';
import { registerLazyServicesIpc } from '@main/ipc/lazy-services';
import { registerLlamaIpc } from '@main/ipc/llama';
import { registerLocaleIpc } from '@main/ipc/locale';
import { registerLoggingIpc } from '@main/ipc/logging';
import { registerMarketplaceIpc } from '@main/ipc/marketplace';
import { registerMcpIpc } from '@main/ipc/mcp';
import { registerMemoryIpc } from '@main/ipc/memory';
import { registerMigrationIpc } from '@main/ipc/migration';
import { registerModelDownloaderIpc } from '@main/ipc/model-downloader';
import { registerModelRegistryIpc } from '@main/ipc/model-registry';
import { registerMultiModelIpc } from '@main/ipc/multi-model';
import { registerOllamaIpc } from '@main/ipc/ollama';
import { registerPerformanceIpc } from '@main/ipc/performance';
import { registerProcessIpc, setupProcessEvents } from '@main/ipc/process';
import { registerPromptTemplatesIpc } from '@main/ipc/prompt-templates';
import { registerProxyIpc } from '@main/ipc/proxy';
import { registerProxyEmbedIpc } from '@main/ipc/proxy-embed';
import { registerRuntimeIpc } from '@main/ipc/runtime';
import { registerSdCppIpc } from '@main/ipc/sd-cpp';
import { registerSessionIpc } from '@main/ipc/session';
import { registerSessionConversationIpc } from '@main/ipc/session-conversation';
import { registerSessionWorkspaceIpc } from '@main/ipc/session-workspace';
import { registerSettingsIpc } from '@main/ipc/settings';
import { registerSharedPromptsIpc } from '@main/ipc/shared-prompts';
import { registerSshIpc } from '@main/ipc/ssh';
import { registerTerminalIpc } from '@main/ipc/terminal';
import { registerThemeIpc } from '@main/ipc/theme';
import { registerTokenEstimationIpc } from '@main/ipc/token-estimation';
import { registerToolsIpc } from '@main/ipc/tools';
import { registerUsageIpc } from '@main/ipc/usage';
import { registerVoiceIpc } from '@main/ipc/voice';
import { registerWindowIpc } from '@main/ipc/window';
import { registerWorkspaceIpc } from '@main/ipc/workspace';
import { registerWorkspaceAgentSessionIpc } from '@main/ipc/workspace-agent-session';
import { appLogger } from '@main/logging/logger';
import { McpDispatcher } from '@main/mcp/dispatcher';
import { SharedPromptsService } from '@main/services/data/shared-prompts.service';
import type { LogoService } from '@main/services/external/logo.service';
import type { DockerService } from '@main/services/workspace/docker.service';
import { container, Services } from '@main/startup/services';
import { ToolExecutor } from '@main/tools/tool-executor';
import { registerBatchIpc } from '@main/utils/ipc-batch.util';
import { setIpcEventBus } from '@main/utils/ipc-wrapper.util';
import { BrowserWindow } from 'electron';

export function registerIpcHandlers(
    services: Services,
    toolExecutor: ToolExecutor,
    getMainWindow: () => BrowserWindow | null,
    allowedFileRoots: Set<string>,
    mcpDispatcher: McpDispatcher
): void {
    setIpcEventBus(services.eventBusService);
    const logoService = container.resolve<LogoService>('logoService');
    const dockerService = container.resolve<DockerService>('dockerService');
    // Registers
    registerWindowIpc(getMainWindow, allowedFileRoots, services.settingsService);
    registerClipboardIpc(getMainWindow);
    registerLazyServicesIpc();
    registerContractIpc();
    registerCodeSandboxIpc(getMainWindow);
    registerModelRegistryIpc(services.modelRegistryService);
    registerModelDownloaderIpc(services.modelDownloaderService);
    registerAuditIpc(services.auditLogService);
    registerPerformanceIpc(services.performanceService);
    registerRuntimeIpc(services.runtimeBootstrapService);
    registerHealthIpc(services.healthCheckService);
    registerMigrationIpc(services.databaseService);
    registerSdCppIpc(
        services.localImageService,
        getMainWindow,
        services.eventBusService
    );

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
    registerKeyRotationIpc(getMainWindow, services.keyRotationService);

    registerSessionConversationIpc({
        getMainWindow,
        settingsService: services.settingsService,
        llmService: services.llmService,
        proxyService: services.proxyService,
        codeIntelligenceService: services.codeIntelligenceService,
        contextRetrievalService: services.contextRetrievalService,
        databaseService: services.databaseService,
        localeService: services.localeService,
        chatSessionRegistryService: services.chatSessionRegistryService,
    });

    registerOllamaIpc({
        getMainWindow,
        localAIService: services.localAIService,
        settingsService: services.settingsService,
        llmService: services.llmService,
        ollamaService: services.ollamaService,
        ollamaHealthService: services.ollamaHealthService,
        proxyService: services.proxyService,
    });

    registerWorkspaceIpc(getMainWindow, {
        workspaceService: services.workspaceService,
        logoService,
        inlineSuggestionService: services.inlineSuggestionService,
        codeIntelligenceService: services.codeIntelligenceService,
        jobSchedulerService: services.jobSchedulerService,
        databaseService: services.databaseService,
        auditLogService: services.auditLogService,
    }, allowedFileRoots);
    registerAgentIpc(getMainWindow, services.agentService);
    registerProcessIpc(getMainWindow, services.processService);
    setupProcessEvents(services.processService);
    registerCodeIntelligenceIpc(services.codeIntelligenceService);

    registerDbIpc(getMainWindow, services.databaseService, services.embeddingService, undefined, allowedFileRoots);
    registerLlamaIpc(getMainWindow, services.llamaService);
    registerMemoryIpc(getMainWindow, services.memoryService);
    registerAdvancedMemoryIpc(services.advancedMemoryService);
    registerBrainIpcHandlers(getMainWindow, services.brainService);
    registerGitIpc(getMainWindow, services.gitService, services.llmService, services.brainService);

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

    registerFilesIpc(getMainWindow, services.fileSystemService, allowedFileRoots, services.auditLogService);
    registerHFModelIpc(services.llmService, services.huggingFaceService);
    registerMultiModelIpc(services.multiModelComparisonService);
    registerCollaborationIpc(getMainWindow, services.modelCollaborationService);
    registerSessionIpc(
        getMainWindow,
        services.sessionDirectoryService,
        services.sessionModuleRegistryService,
        services.eventBusService
    );

    registerSessionWorkspaceIpc(getMainWindow, services.databaseService);
    registerWorkspaceAgentSessionIpc(
        getMainWindow,
        services.databaseService,
        services.modelRegistryService
    );

    registerToolsIpc(
        getMainWindow,
        toolExecutor,
        services.commandService,
        services.databaseService
    );
    registerMcpIpc(mcpDispatcher, getMainWindow);
    registerMarketplaceIpc(services.marketplaceService, services.themeService, services.localeService, getMainWindow);
    registerLocaleIpc(services.localeService);
    registerUsageIpc(services.settingsService);

    registerLoggingIpc();

    // Terminal needs the instance - use getter for deferred access
    registerTerminalIpc(
        getMainWindow,
        services.terminalService,
        services.terminalProfileService,
        services.terminalSmartService,
        dockerService
    );

    registerDialogIpc(getMainWindow);

    // Register Batch IPC
    registerBatchIpc();
}

export function registerPostStartupIpcHandlers(
    services: Services,
    getMainWindow: () => BrowserWindow | null
): void {
    const sharedPromptsService = new SharedPromptsService(services.databaseService);

    const window = getMainWindow();
    if (window) {
        services.extensionService.setMainWindow(window);
    }
    registerProxyEmbedIpc(services.proxyService);
    registerExportIpc(getMainWindow, services.exportService);
    registerPromptTemplatesIpc(getMainWindow, services.promptTemplatesService);
    registerSharedPromptsIpc(sharedPromptsService);
    registerGalleryIpc(services.dataService.getPath('gallery'), services.databaseService);
}

export function registerPostInteractiveIpcHandlers(
    services: Services,
    getMainWindow: () => BrowserWindow | null
): void {
    registerTokenEstimationIpc();
    registerVoiceIpc();
    registerBackupIpc(getMainWindow, services.backupService);
    registerThemeIpc(services.themeService, getMainWindow);
}

export async function registerDeferredIpcHandlers(
    services: Services,
    getMainWindow: () => BrowserWindow | null
): Promise<void> {
    const sshService = await services.sshService.resolve();
    registerSshIpc(getMainWindow, sshService);
}


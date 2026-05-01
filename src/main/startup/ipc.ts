/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { registerAdvancedMemoryIpc } from '@main/ipc/advanced-memory';
import { registerAgentIpc } from '@main/ipc/agent';
import { registerAuditIpc } from '@main/ipc/audit';
import { registerAuthIpc } from '@main/ipc/auth';
import { registerBrainIpcHandlers } from '@main/ipc/brain';
import { registerClipboardIpc } from '@main/ipc/clipboard';
import { registerCodeIntelligenceIpc } from '@main/ipc/code-intelligence';
import { registerCodeLanguageIpc } from '@main/ipc/code-language';
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
import { registerImageStudioIpc } from '@main/ipc/image-studio';
import { registerSecurityIpc } from '@main/ipc/security';
import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { registerSessionIpc } from '@main/ipc/session';
import { registerSessionConversationIpc } from '@main/ipc/session-conversation';
import { registerSessionCouncilIpc } from '@main/ipc/session-council';
import { registerSessionWorkspaceIpc } from '@main/ipc/session-workspace';
import { registerSettingsIpc, syncStartupBehavior } from '@main/ipc/settings';
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
import { ExtensionService } from '@main/services/extension/extension.service';
import { LogoService } from '@main/services/external/logo.service';
import { CopilotService } from '@main/services/llm/copilot.service';
import { LLMService } from '@main/services/llm/llm.service';
import { SettingsService } from '@main/services/system/settings.service';
import { DockerService } from '@main/services/workspace/docker.service';
import { container, Services } from '@main/startup/services';
import { ToolExecutor } from '@main/tools/tool-executor';
import { registerBatchIpc } from '@main/utils/ipc-batch.util';
import { safeHandle, setIpcEventBus } from '@main/utils/ipc-wrapper.util';
import { createIpcHandler as baseCreateIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ExtensionDevOptions, ExtensionPublishOptions, ExtensionTestOptions } from '@shared/types/extension';
import { BrowserWindow, IpcMainInvokeEvent } from 'electron';


export function registerMinimalIpcHandlers(
    settingsService: SettingsService,
    getMainWindow: () => BrowserWindow | null,
    allowedFileRoots: Set<string>
): void {
    registerWindowIpc(getMainWindow, allowedFileRoots, settingsService);
    registerSettingsIpc({
        getMainWindow,
        settingsService,
        llmService: null! as LLMService,
        copilotService: null! as CopilotService,

        updateOpenAIConnection: () => {},
        updateOllamaConnection: async () => {},
    });
    // Sync startup behavior early if enabled
    syncStartupBehavior(settingsService.getSettings());
    registerLoggingIpc();
    registerDialogIpc(getMainWindow);
}


export function registerIpcHandlers(
    services: Services,
    toolExecutor: ToolExecutor,
    getMainWindow: () => BrowserWindow | null,
    allowedFileRoots: Set<string>,
    mcpDispatcher: McpDispatcher,
    getIsMainProcessReady?: () => boolean
): void {

    setIpcEventBus(services.eventBusService);
    const logoService = container.resolve<LogoService>('logoService');
    const dockerService = container.resolve<DockerService>('dockerService');
    // Registers
    registerWindowIpc(getMainWindow, allowedFileRoots, services.settingsService);
    // Sync startup behavior on startup
    syncStartupBehavior(services.settingsService.getSettings());
    registerClipboardIpc(getMainWindow);
    registerLazyServicesIpc();
    registerContractIpc();
    registerCodeSandboxIpc(getMainWindow);
    registerCodeLanguageIpc(services.codeLanguageService);
    registerModelRegistryIpc(
        services.modelRegistryService,
        services.eventBusService,
        getMainWindow
    );
    registerModelDownloaderIpc(services.modelDownloaderService);

    registerPerformanceIpc(services.performanceService);
    registerRuntimeIpc(services.runtimeBootstrapService, getIsMainProcessReady);

    registerHealthIpc(services.healthCheckService);
    registerMigrationIpc(services.databaseService);
    registerSdCppIpc(
        services.localImageService,
        getMainWindow,
        services.eventBusService
    );

    registerImageStudioIpc({
        llmService: services.llmService,
        localImageService: services.localImageService,
        modelRegistryService: services.modelRegistryService,
        imagePersistenceService: container.resolve('imagePersistenceService'),
    });

    registerAuthIpc({
        proxyService: services.proxyService,
        copilotService: services.copilotService,
        authService: services.authService,

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
    registerSecurityIpc(services.securityService, getMainWindow);

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
        advancedMemoryService: services.advancedMemoryService,
        brainService: services.brainService,
    });

    registerOllamaIpc({
        getMainWindow,
        localAIService: services.localAIService,
        settingsService: services.settingsService,
        llmService: services.llmService,
        ollamaService: services.ollamaService,
        ollamaHealthService: services.ollamaHealthService,
        proxyService: services.proxyService,
        authService: services.authService,
    });

    registerWorkspaceIpc(getMainWindow, {
        workspaceService: services.workspaceService,
        logoService,
        inlineSuggestionService: services.inlineSuggestionService,
        codeIntelligenceService: services.codeIntelligenceService,
        jobSchedulerService: services.jobSchedulerService,
        databaseService: services.databaseService,

    }, allowedFileRoots);
    registerAgentIpc(getMainWindow, services.agentService);
    registerProcessIpc(getMainWindow, services.processService);
    setupProcessEvents(services.processService);
    registerCodeIntelligenceIpc(services.codeIntelligenceService);

    // Extension IPC registration (inlined to avoid ReferenceError)
    registerExtensionIpc(services.extensionService, getMainWindow);

    registerDbIpc(getMainWindow, services.databaseService, services.embeddingService, allowedFileRoots);
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

        updateOpenAIConnection: () => {
            const mainWindow = getMainWindow();
            if (mainWindow) {
                // OpenAI connection status update placeholder
                appLogger.debug('IPC', 'OpenAI connection update requested');
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

    registerFilesIpc(
        getMainWindow,
        services.fileSystemService,
        allowedFileRoots,
        services.auditLogService,
        services.fileChangeTracker
    );
    registerAuditIpc(getMainWindow, services.auditLogService);
    registerHFModelIpc(services.llmService, services.huggingFaceService);
    registerMultiModelIpc(services.multiModelComparisonService);
    registerCollaborationIpc(getMainWindow, services.modelCollaborationService);
    registerSessionIpc(
        getMainWindow,
        services.sessionDirectoryService,
        services.sessionModuleRegistryService,
        services.eventBusService
    );

    registerSessionCouncilIpc(getMainWindow, services.databaseService);
    registerSessionWorkspaceIpc(getMainWindow, services.databaseService);
    registerWorkspaceAgentSessionIpc(
        getMainWindow,
        services.databaseService,
        services.modelRegistryService,
        services.advancedMemoryService
    );

    registerToolsIpc(
        getMainWindow,
        toolExecutor,
        services.commandService,
        services.databaseService,
        services.advancedMemoryService
    );
    registerMcpIpc(mcpDispatcher, getMainWindow);
    registerMarketplaceIpc(
        services.marketplaceService,
        services.themeService,
        services.localeService,
        services.codeLanguageService,
        getMainWindow
    );
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
    registerThemeIpc(services.themeService, getMainWindow);

    // Register Batch IPC
    registerBatchIpc();
}

/**
 * Registers IPC handlers for Extension operations
 */
function registerExtensionIpc(
    extensionService: ExtensionService,
    getMainWindow: () => BrowserWindow | null
) {
    appLogger.debug('ExtensionIPC', 'Registering Extension IPC handlers');
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'extension operation');

    const createIpcHandler = <T = RuntimeValue, Args extends RuntimeValue[] = RuntimeValue[]>(
        channel: string,
        handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<T> | T
    ) => baseCreateIpcHandler<T, Args>(channel, async (event, ...args) => {
        validateSender(event);
        return await handler(event, ...args);
    });

    safeHandle('extension:get-all', createIpcHandler('extension:get-all',
        () => extensionService.getAllExtensions()
    ));

    safeHandle('extension:get', createIpcHandler('extension:get',
        (_event: IpcMainInvokeEvent, extensionId: string) => extensionService.getExtension(extensionId)
    ));

    safeHandle('extension:install', createIpcHandler('extension:install',
        async (_event: IpcMainInvokeEvent, extensionPath: string) => await extensionService.handleInstall(_event, extensionPath)
    ));

    safeHandle('extension:uninstall', createIpcHandler('extension:uninstall',
        async (_event: IpcMainInvokeEvent, extensionId: string) => await extensionService.handleUninstall(_event, extensionId)
    ));

    safeHandle('extension:activate', createIpcHandler('extension:activate',
        async (_event: IpcMainInvokeEvent, extensionId: string) => await extensionService.handleActivate(_event, extensionId)
    ));

    safeHandle('extension:deactivate', createIpcHandler('extension:deactivate',
        async (_event: IpcMainInvokeEvent, extensionId: string) => await extensionService.handleDeactivate(_event, extensionId)
    ));

    safeHandle('extension:dev-start', createIpcHandler('extension:dev-start',
        async (_event: IpcMainInvokeEvent, options: ExtensionDevOptions) => await extensionService.handleDevStart(_event, options)
    ));

    safeHandle('extension:dev-stop', createIpcHandler('extension:dev-stop',
        async (_event: IpcMainInvokeEvent, extensionId: string) => await extensionService.handleDevStop(_event, extensionId)
    ));

    safeHandle('extension:dev-reload', createIpcHandler('extension:dev-reload',
        async (_event: IpcMainInvokeEvent, extensionId: string) => await extensionService.handleDevReload(_event, extensionId)
    ));

    safeHandle('extension:test', createIpcHandler('extension:test',
        async (_event: IpcMainInvokeEvent, options: ExtensionTestOptions) => await extensionService.handleTest(_event, options)
    ));

    safeHandle('extension:publish', createIpcHandler('extension:publish',
        async (_event: IpcMainInvokeEvent, options: ExtensionPublishOptions) => await extensionService.handlePublish(_event, options)
    ));

    safeHandle('extension:get-profile', createIpcHandler('extension:get-profile',
        (_event: IpcMainInvokeEvent, extensionId: string) => extensionService.handleGetProfile(_event, extensionId)
    ));

    safeHandle('extension:validate', createIpcHandler('extension:validate',
        (_event: IpcMainInvokeEvent, manifest: Record<string, unknown>) => extensionService.handleValidate(_event, manifest)
    ));

    safeHandle('extension:get-state', createIpcHandler('extension:get-state',
        (_event: IpcMainInvokeEvent, extensionId: string) => extensionService.handleGetState(_event, extensionId)
    ));

    safeHandle('extension:get-config', createIpcHandler('extension:get-config',
        (_event: IpcMainInvokeEvent, extensionId: string) => extensionService.handleGetConfig(_event, extensionId)
    ));

    safeHandle('extension:update-config', createIpcHandler('extension:update-config',
        async (_event: IpcMainInvokeEvent, extensionId: string, config: Record<string, unknown>) => 
            await extensionService.handleUpdateConfig(_event, extensionId, config)
    ));

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
}

export async function registerDeferredIpcHandlers(
    services: Services,
    getMainWindow: () => BrowserWindow | null
): Promise<void> {
    const sshService = await services.sshService.resolve();
    registerSshIpc(getMainWindow, sshService);
}

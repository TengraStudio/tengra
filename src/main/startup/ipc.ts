/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { registerServiceIpc } from '@main/core/ipc-decorators';
import { lazyServiceRegistry } from '@main/core/lazy-services';
import { appLogger } from '@main/logging/logger';
import { SharedPromptsService } from '@main/services/data/shared-prompts.service';
import { ExtensionService } from '@main/services/extension/extension.service';
import { LogoService } from '@main/services/external/logo.service';
import { ModelRegistryService } from '@main/services/llm/model-registry.service';
import { DialogService } from '@main/services/system/dialog.service';
import { LoggingService } from '@main/services/system/logging.service';
import { SettingsService } from '@main/services/system/settings.service';
import { UpdateService } from '@main/services/system/update.service';
import { WindowService } from '@main/services/system/window.service';
import { DockerService } from '@main/services/workspace/docker.service';
import { container, Services } from '@main/startup/services';
import { ToolExecutor } from '@main/tools/tool-executor';
import { registerBatchableHandler } from '@main/utils/ipc-batch.util';
import { createMainWindowSenderValidator } from '@main/utils/ipc-sender-validator';
import { safeHandle, setIpcEventBus } from '@main/utils/ipc-wrapper.util';
import { createIpcHandler as baseCreateIpcHandler } from '@main/utils/ipc-wrapper.util';
import { SESSION_CHANNELS } from '@shared/constants/ipc-channels';
import { SessionEventEnvelopeSchema } from '@shared/schemas/session-engine.schema';
import { ExtensionDevOptions, ExtensionPublishOptions, ExtensionTestOptions } from '@shared/types/extension';
import { BrowserWindow, IpcMainInvokeEvent } from 'electron';

type UnsafeValue = ReturnType<typeof JSON.parse>;

export function registerMinimalIpcHandlers(
    settingsService: SettingsService,
    getMainWindow: () => BrowserWindow | null,
    allowedFileRoots: Set<string>
): void {
    registerServiceIpc(container.resolve<WindowService>('windowService'));
    registerServiceIpc(container.resolve<LoggingService>('loggingService'));
    registerServiceIpc(container.resolve<DialogService>('dialogService'));
}


export function registerIpcHandlers(
    services: Services,
    toolExecutor: ToolExecutor,
    getMainWindow: () => BrowserWindow | null,
    allowedFileRoots: Set<string>,
    getIsMainProcessReady?: () => boolean
): void {
    appLogger.info('IPC', 'registerIpcHandlers: START');

    setIpcEventBus(services.eventBusService);
    const logoService = container.resolve<LogoService>('logoService');
    const dockerService = container.resolve<DockerService>('dockerService');
    // Registers
    registerServiceIpc(services.windowService);
    registerServiceIpc(services.systemService);
    registerServiceIpc(lazyServiceRegistry);
    registerServiceIpc(services.codeSandboxService);
    registerServiceIpc(services.codeLanguageService);
    const modelRegistryService = container.resolve<ModelRegistryService>('modelRegistryService');
    services.modelRegistryService = modelRegistryService;
    registerServiceIpc(modelRegistryService);
    registerServiceIpc(services.modelDownloaderService);

    registerServiceIpc(services.performanceService);
    if (getIsMainProcessReady) {
        services.runtimeBootstrapService.setMainProcessReadyGetter(getIsMainProcessReady);
    }
    registerServiceIpc(services.runtimeBootstrapService);

    registerServiceIpc(services.healthCheckService);
    registerServiceIpc(services.localImageService);

    // Forward SD-CPP events to renderer
    services.eventBusService.on('sd-cpp:status', (status) => {
        const mainWindow = getMainWindow();
        if (mainWindow) {
            mainWindow.webContents.send('sd-cpp:status', status);
        }
    });

    services.eventBusService.on('sd-cpp:progress', (progress) => {
        const mainWindow = getMainWindow();
        if (mainWindow) {
            mainWindow.webContents.send('sd-cpp:progress', progress);
        }
    });

    registerServiceIpc(services.imageStudioService);

    registerServiceIpc(services.authService);
    registerServiceIpc(services.proxyService, createMainWindowSenderValidator(getMainWindow, 'proxy operation'));
    registerServiceIpc(services.keyRotationService, createMainWindowSenderValidator(getMainWindow, 'key-rotation operation'));
    registerServiceIpc(services.securityService);



    registerServiceIpc(services.workspaceService);
    registerServiceIpc(logoService);
    registerServiceIpc(services.inlineSuggestionService);
    registerServiceIpc(services.agentService, createMainWindowSenderValidator(getMainWindow, 'agent operation'));
    registerServiceIpc(services.processService);
    registerServiceIpc(services.codeIntelligenceService);

    registerServiceIpc(services.extensionService, getMainWindow);

    registerServiceIpc(services.databaseService, createMainWindowSenderValidator(getMainWindow, 'database operation'));
    registerServiceIpc(services.embeddingService, createMainWindowSenderValidator(getMainWindow, 'embedding operation'));

    registerServiceIpc(services.llamaService, createMainWindowSenderValidator(getMainWindow, 'llama operation'));
    registerServiceIpc(services.memoryService);
    registerServiceIpc(services.brainService);
    registerServiceIpc(services.fileSystemService);
    registerServiceIpc(services.fileChangeTracker);

    // Core services using decorator-based IPC
    registerServiceIpc(services.gitService);
    registerServiceIpc(services.terminalService);
    registerServiceIpc(services.terminalProfileService);
    registerServiceIpc(services.terminalSmartService);
    registerServiceIpc(services.dockerService);
    registerServiceIpc(services.ollamaService, createMainWindowSenderValidator(getMainWindow, 'ollama operation'));
    registerServiceIpc(services.ollamaHealthService, createMainWindowSenderValidator(getMainWindow, 'ollama health'));
    services.settingsService.setOllamaHealthService(services.ollamaHealthService);
    registerServiceIpc(services.settingsService);
    registerServiceIpc(services.advancedMemoryService);

    registerServiceIpc(services.auditLogService);
    registerServiceIpc(services.huggingFaceService);
    registerServiceIpc(services.multiModelComparisonService, createMainWindowSenderValidator(getMainWindow, 'multi-model operation'));
    registerServiceIpc(services.modelCollaborationService, createMainWindowSenderValidator(getMainWindow, 'collaboration operation'));
    registerServiceIpc(services.sessionDirectoryService);
    registerServiceIpc(services.sessionModuleRegistryService);

    // Forward Session events to renderer
    services.eventBusService.onCustom('session:event', payload => {
        const parsed = SessionEventEnvelopeSchema.safeParse(payload);
        if (!parsed.success) {
            appLogger.warn('SessionIPC', 'Ignoring invalid session event payload');
            return;
        }

        const window = getMainWindow();
        if (!window || window.isDestroyed()) {
            return;
        }

        window.webContents.send(SESSION_CHANNELS.EVENT, parsed.data);
    });

    registerServiceIpc(services.councilCapabilityService);
    registerServiceIpc(services.sessionWorkspaceService);
    registerServiceIpc(services.sessionConversationService);
    registerServiceIpc(services.workspaceAgentSessionService);

    registerServiceIpc(services.toolsService, createMainWindowSenderValidator(getMainWindow, 'tools operation'));
    registerServiceIpc(services.mcpPluginService, createMainWindowSenderValidator(getMainWindow, 'mcp operation'));
    registerServiceIpc(services.proxyService);
    appLogger.debug('IPC', 'Registering MarketplaceService IPC...');
    const mktConstructor = services.marketplaceService?.constructor;
    const mktMethods = mktConstructor ? (mktConstructor as UnsafeValue)['_ipc_methods'] : null;
    appLogger.debug('IPC', `MarketplaceService methods found: ${mktMethods ? mktMethods.length : 'NONE'}`);
    
    registerServiceIpc(services.marketplaceService);
    
    // Manual fallback for diagnostic purposes - specifically for marketplace:fetch
    if (services.marketplaceService) {
        safeHandle('marketplace:fetch', async () => {
            appLogger.debug('IPC', 'MANUAL marketplace:fetch called via safeHandle');
            return await services.marketplaceService.fetchRegistryIpc();
        });
    }
    
    appLogger.debug('IPC', 'MarketplaceService IPC registered.');
    registerServiceIpc(services.localeService);
    registerServiceIpc(services.usageService);

    registerServiceIpc(services.loggingService);


    registerServiceIpc(services.dialogService);
    registerServiceIpc(services.themeService);

    const updateService = container.resolve<UpdateService>('updateService');
    registerServiceIpc(updateService);

    // Register Batch IPC
    registerServiceIpc(services.ipcBatchService);
}



export function registerPostStartupIpcHandlers(
    services: Services,
    getMainWindow: () => BrowserWindow | null
): void {
    const window = getMainWindow();
    if (window) {
        services.extensionService.setMainWindow(window);
    }
    registerServiceIpc(services.exportService, createMainWindowSenderValidator(getMainWindow, 'export operation'));
    registerServiceIpc(services.promptTemplatesService, createMainWindowSenderValidator(getMainWindow, 'prompt-templates operation'));
    registerServiceIpc(services.galleryService);
}

export function registerPostInteractiveIpcHandlers(
    services: Services,
    _getMainWindow: () => BrowserWindow | null
): void {
    registerServiceIpc(services.voiceService);
}

export async function registerDeferredIpcHandlers(
    services: Services,
    getMainWindow: () => BrowserWindow | null
): Promise<void> {
    const sshService = await services.sshService.resolve();
    registerServiceIpc(sshService, createMainWindowSenderValidator(getMainWindow, 'ssh operation'));
}

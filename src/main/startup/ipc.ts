/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { getIpcMethodsForService, registerServiceIpc } from '@main/core/ipc-decorators';
import { lazyServiceRegistry } from '@main/core/lazy-services';
import { appLogger } from '@main/logging/logger';
import { LogoService } from '@main/services/external/logo.service';
import { UpdateService } from '@main/services/system/update.service';
import { CodeSandboxService } from '@main/services/workspace/code-sandbox.service';
import { DockerService } from '@main/services/workspace/docker.service';
import { container, Services } from '@main/startup/services';
import { ToolExecutor } from '@main/tools/tool-executor';
import { createMainWindowSenderValidator } from '@main/utils/ipc-sender-validator';
import { safeHandle, setIpcEventBus } from '@main/utils/ipc-wrapper.util';
import { SESSION_CHANNELS } from '@shared/constants/ipc-channels';
import { SessionEventEnvelopeSchema } from '@shared/schemas/session-engine.schema';
import { BrowserWindow } from 'electron';

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
    
    const servicesToRegister = [
        { name: 'windowService', service: services.windowService },
        { name: 'systemService', service: services.systemService },
        { name: 'lazyServiceRegistry', service: lazyServiceRegistry },
        { name: 'codeSandboxService', service: container.resolve<CodeSandboxService>('codeSandboxService') },
        { name: 'codeLanguageService', service: services.codeLanguageService },
        { name: 'modelRegistryService', service: services.modelRegistryService },
        { name: 'modelDownloaderService', service: services.modelDownloaderService },
        { name: 'runtimeBootstrapService', service: services.runtimeBootstrapService },
        { name: 'healthCheckService', service: services.healthCheckService },
        { name: 'localImageService', service: services.localImageService },
        { name: 'imageStudioService', service: services.imageStudioService },
        { name: 'authService', service: services.authService },
        { name: 'proxyService', service: services.proxyService },
        { name: 'keyRotationService', service: services.keyRotationService },
        { name: 'securityService', service: services.securityService },
        { name: 'workspaceService', service: services.workspaceService },
        { name: 'logoService', service: logoService },
        { name: 'inlineSuggestionService', service: services.inlineSuggestionService },
        { name: 'agentService', service: services.agentService },
        { name: 'processService', service: services.processService },
        { name: 'codeIntelligenceService', service: services.codeIntelligenceService },
        { name: 'extensionService', service: services.extensionService },
        { name: 'databaseService', service: services.databaseService },
        { name: 'embeddingService', service: services.embeddingService },
        { name: 'llamaService', service: services.llamaService },
        { name: 'memoryService', service: services.memoryService },
        { name: 'brainService', service: services.brainService },
        { name: 'fileSystemService', service: services.fileSystemService },
        { name: 'fileChangeTracker', service: services.fileChangeTracker },
        { name: 'gitService', service: services.gitService },
        { name: 'terminalService', service: services.terminalService },
        { name: 'terminalProfileService', service: services.terminalProfileService },
        { name: 'terminalSmartService', service: services.terminalSmartService },
        { name: 'dockerService', service: container.resolve<DockerService>('dockerService') },
        { name: 'ollamaService', service: services.ollamaService },
        { name: 'ollamaHealthService', service: services.ollamaHealthService },
        { name: 'settingsService', service: services.settingsService },
        { name: 'advancedMemoryService', service: services.advancedMemoryService },
        { name: 'auditLogService', service: services.auditLogService },
        { name: 'huggingFaceService', service: services.huggingFaceService },
        { name: 'multiModelComparisonService', service: services.multiModelComparisonService },
        { name: 'modelCollaborationService', service: services.modelCollaborationService },
        { name: 'sessionDirectoryService', service: services.sessionDirectoryService },
        { name: 'sessionModuleRegistryService', service: services.sessionModuleRegistryService },
        { name: 'councilCapabilityService', service: services.councilCapabilityService },
        { name: 'sessionWorkspaceService', service: services.sessionWorkspaceService },
        { name: 'sessionConversationService', service: services.sessionConversationService },
        { name: 'workspaceAgentSessionService', service: services.workspaceAgentSessionService },
        { name: 'toolsService', service: services.toolsService },
        { name: 'mcpPluginService', service: services.mcpPluginService },
        { name: 'marketplaceService', service: services.marketplaceService },
        { name: 'localeService', service: services.localeService },
        { name: 'usageService', service: services.usageService },
        { name: 'loggingService', service: services.loggingService },
        { name: 'dialogService', service: services.dialogService },
        { name: 'themeService', service: services.themeService },
        { name: 'updateService', service: container.resolve<UpdateService>('updateService') },
        { name: 'ipcBatchService', service: services.ipcBatchService },
    ];

    if (getIsMainProcessReady) {
        services.runtimeBootstrapService.setMainProcessReadyGetter(getIsMainProcessReady);
    }

    if (services.ollamaHealthService) {
        services.settingsService.setOllamaHealthService(services.ollamaHealthService);
    }

    for (const { name, service } of servicesToRegister) {
        if (service) { 
            const ipcMethods = getIpcMethodsForService(service);
            if (ipcMethods.length === 0) {
                appLogger.warn('IPC', `Skipping IPC registration for service without @ipc methods: ${name}`);
                continue;
            }
            if (name === 'proxyService' || name === 'keyRotationService' || name === 'agentService' || name === 'databaseService' || name === 'embeddingService' || name === 'llamaService' || name === 'ollamaService' || name === 'ollamaHealthService' || name === 'multiModelComparisonService' || name === 'modelCollaborationService' || name === 'toolsService' || name === 'mcpPluginService') {
                registerServiceIpc(service, createMainWindowSenderValidator(getMainWindow, `${name} operation`));
            } else if (name === 'extensionService') {
                registerServiceIpc(service, getMainWindow);
            } else {
                registerServiceIpc(service);
            }
        } else {
            appLogger.warn('IPC', `Service ${name} is missing, skipping IPC registration`);
        }
    }

    // Manual fallback for diagnostic purposes - specifically for marketplace:fetch
    if (services.marketplaceService) {
        safeHandle('marketplace:fetch', async () => {
            appLogger.debug('IPC', 'MANUAL marketplace:fetch called via safeHandle');
            return await services.marketplaceService.fetchRegistryIpc();
        });
    }

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

    appLogger.info('IPC', 'registerIpcHandlers: DONE');
}



export function registerPostStartupIpcHandlers(
    services: Services,
    getMainWindow: () => BrowserWindow | null
): void {
    const window = getMainWindow();
    if (window) {
        services.extensionService.setMainWindow(window);
    }
    if (getIpcMethodsForService(services.exportService).length > 0) {
        registerServiceIpc(services.exportService, createMainWindowSenderValidator(getMainWindow, 'export operation'));
    } else {
        appLogger.warn('IPC', 'Skipping IPC registration for service without @ipc methods: exportService');
    }
    if (getIpcMethodsForService(services.promptTemplatesService).length > 0) {
        registerServiceIpc(services.promptTemplatesService, createMainWindowSenderValidator(getMainWindow, 'prompt-templates operation'));
    } else {
        appLogger.warn('IPC', 'Skipping IPC registration for service without @ipc methods: promptTemplatesService');
    }
    if (getIpcMethodsForService(services.galleryService).length > 0) {
        registerServiceIpc(services.galleryService);
    } else {
        appLogger.warn('IPC', 'Skipping IPC registration for service without @ipc methods: galleryService');
    }
}

export function registerPostInteractiveIpcHandlers(
    services: Services,
    _getMainWindow: () => BrowserWindow | null
): void {
    if (getIpcMethodsForService(services.voiceService).length > 0) {
        registerServiceIpc(services.voiceService);
    } else {
        appLogger.warn('IPC', 'Skipping IPC registration for service without @ipc methods: voiceService');
    }
}

export async function registerDeferredIpcHandlers(
    services: Services,
    getMainWindow: () => BrowserWindow | null
): Promise<void> {
    const sshService = await services.sshService.resolve();
    if (getIpcMethodsForService(sshService).length > 0) {
        registerServiceIpc(sshService, createMainWindowSenderValidator(getMainWindow, 'ssh operation'));
    } else {
        appLogger.warn('IPC', 'Skipping IPC registration for service without @ipc methods: sshService');
    }
}


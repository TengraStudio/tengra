/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { FILES_CHANNELS, OLLAMA_CHANNELS, PROXY_CHANNELS, SHELL_CHANNELS } from '@shared/constants/ipc-channels';
import { AppSettings } from '@shared/types';
import { IpcValue } from '@shared/types/common';
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

import { createAdvancedMemoryBridge } from './preload/domains/advanced-memory.preload';
import { createAgentBridge } from './preload/domains/agent.preload';
import { createAppBridge } from './preload/domains/app.preload';
import { createAuditBridge } from './preload/domains/audit.preload';
import { createAuthBridge } from './preload/domains/auth.preload';
import { createAuthSessionBridge } from './preload/domains/auth-session.preload';
import { createBatchBridge } from './preload/domains/batch.preload';
import { createClipboardBridge } from './preload/domains/clipboard.preload';
import { createCodeBridge } from './preload/domains/code.preload';
import { createCodeLanguageBridge } from './preload/domains/code-language.preload';
import { createCodeSandboxBridge } from './preload/domains/code-sandbox.preload';
import { createModelCollaborationBridge } from './preload/domains/collaboration.preload';
import { createDbBridge } from './preload/domains/db.preload';
import { createDialogBridge } from './preload/domains/dialog.preload';
import { createExportBridge } from './preload/domains/export.preload';
import { createExtensionBridge } from './preload/domains/extension.preload';
import { createFilesBridge } from './preload/domains/files.preload';
import { createGalleryBridge } from './preload/domains/gallery.preload';
import { createGitBridge } from './preload/domains/git.preload';
import { createHuggingFaceBridge } from './preload/domains/huggingface.preload';
import { createImageStudioBridge } from './preload/domains/image-studio.preload';
import { createIpcContractBridge } from './preload/domains/ipc-contract.preload';
import { createLazyServicesBridge } from './preload/domains/lazy-services.preload';
import { createLinkedAccountsBridge } from './preload/domains/linked-accounts.preload';
import { createLlamaBridge } from './preload/domains/llama.preload';
import { createLocaleBridge } from './preload/domains/locale.preload';
import { createLogBridge } from './preload/domains/log.preload';
import { createMarketplaceBridge } from './preload/domains/marketplace.preload';
import { createMcpBridge } from './preload/domains/mcp.preload';
import { createMemoryBridge } from './preload/domains/memory.preload';
import { createMetricsBridge } from './preload/domains/metrics.preload';
import { createModelDownloaderBridge } from './preload/domains/model-downloader.preload';
import { createModelRegistryBridge } from './preload/domains/model-registry.preload';
import { createOllamaBridge } from './preload/domains/ollama.preload';
import { createPowerBridge } from './preload/domains/power.preload';
import { createProcessBridge } from './preload/domains/process.preload';
import { createPromptTemplatesBridge } from './preload/domains/prompt-templates.preload';
import { createProxyBridge } from './preload/domains/proxy.preload';
import { createProxyEmbedBridge } from './preload/domains/proxy-embed.preload';
import { createRuntimeBridge } from './preload/domains/runtime.preload';
import { createSdCppBridge } from './preload/domains/sd-cpp.preload';
import { createSecurityBridge } from './preload/domains/security.preload';
import { createSessionBridge } from './preload/domains/session.preload';
import { createSettingsBridge } from './preload/domains/settings.preload';
import { createSharedPromptsBridge } from './preload/domains/shared-prompts.preload';
import { createSSHBridge } from './preload/domains/ssh.preload';
import { createTerminalBridge } from './preload/domains/terminal.preload';
import { createThemeBridge } from './preload/domains/theme.preload';
import { createToolsBridge } from './preload/domains/tools.preload';
import { createUpdateBridge } from './preload/domains/update.preload';
import { createUsageBridge } from './preload/domains/usage.preload';
import { createLiveCollaborationBridge } from './preload/domains/user-collaboration.preload';
import { createVoiceBridge } from './preload/domains/voice.preload';
import { createWindowControlsBridge } from './preload/domains/window-controls.preload';
import { createWorkspaceBridge } from './preload/domains/workspace.preload';

// Increase max listeners for ipcRenderer to handle multiple terminal/process streams
ipcRenderer.setMaxListeners(60);

const BOOTSTRAP_IPC_MAX_ATTEMPTS = 1000;
const BOOTSTRAP_IPC_RETRY_DELAY_MS = 50;
const originalInvoke = ipcRenderer.invoke.bind(ipcRenderer);

function waitForBootstrapRetry(): Promise<void> {
    return new Promise(resolve => {
        setTimeout(resolve, BOOTSTRAP_IPC_RETRY_DELAY_MS);
    });
}

type BootstrapInvokeError = Error | string | { message?: string } | null;

function isNoHandlerRegisteredError(error: BootstrapInvokeError): boolean {
    if (!error) { return false; }
    const msg = typeof error === 'string'
        ? error
        : error instanceof Error
            ? error.message
            : typeof error.message === 'string'
                ? error.message
                : '';
    return (
        msg.includes('No handler registered for')
        || msg.includes('Error occurred in handler for')
        || msg.includes('IpcMain.handle() is not registered')
    );
}

async function invokeWithBootstrapRetry(channel: string, ...args: IpcValue[]): Promise<IpcValue> {
    if (
        channel === FILES_CHANNELS.LIST_DIRECTORY &&
        (typeof args[0] !== 'string' || args[0].trim().length === 0)
    ) {
        const stack = new Error('Invalid listDirectory invoke').stack ?? 'no stack';
        console.error('[preload] blocked invalid files:listDirectory invoke', {
            arg0: args[0],
            stack,
        });
        return {
            success: false,
            data: [],
            error: 'Invalid directory path',
        } as IpcValue;
    }

    let lastError: BootstrapInvokeError = null;
    for (let attempt = 0; attempt < BOOTSTRAP_IPC_MAX_ATTEMPTS; attempt += 1) {
        try {
            return await originalInvoke(channel, ...args) as IpcValue;
        } catch (error) {
            lastError = error as BootstrapInvokeError;
            if (!isNoHandlerRegisteredError(lastError) || attempt === BOOTSTRAP_IPC_MAX_ATTEMPTS - 1) {
                throw error;
            }
            await waitForBootstrapRetry();
        }
    }
    throw lastError instanceof Error ? lastError : new Error('IPC invoke failed during bootstrap');
}

ipcRenderer.invoke = ((channel: string, ...args: IpcValue[]) =>
    invokeWithBootstrapRetry(channel, ...args)) as typeof ipcRenderer.invoke;

const settingsBridge = createSettingsBridge(ipcRenderer);

const api = {
    auth: {
        ...createAuthBridge(ipcRenderer),
        ...createLinkedAccountsBridge(ipcRenderer),
        ...createAuthSessionBridge(ipcRenderer),
        ...createProxyBridge(ipcRenderer),
    },
    ...createWindowControlsBridge(ipcRenderer),
    ...createAppBridge(ipcRenderer),
    clipboard: createClipboardBridge(ipcRenderer),
    ...createSdCppBridge(ipcRenderer),
    sdCpp: createSdCppBridge(ipcRenderer),
    modelDownloader: createModelDownloaderBridge(ipcRenderer),
    ...createToolsBridge(ipcRenderer),

    // Unified ipcRenderer exposure
    ipcRenderer: {
        on: (channel: string, listener: (event: IpcRendererEvent, ...args: IpcValue[]) => void) => {
            ipcRenderer.on(channel, listener);
            return () => ipcRenderer.removeListener(channel, listener);
        },
        off: (channel: string, listener: (event: IpcRendererEvent, ...args: IpcValue[]) => void) => {
            ipcRenderer.off(channel, listener);
        },
        send: (channel: string, ...args: IpcValue[]) => ipcRenderer.send(channel, ...args),
        invoke: (channel: string, ...args: IpcValue[]) => ipcRenderer.invoke(channel, ...args),
        removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel)
    },

    // Backward compatibility for components using window.electron.on/invoke
    on: (channel: string, listener: (event: IpcRendererEvent, ...args: IpcValue[]) => void) => {
        ipcRenderer.on(channel, listener);
        return () => ipcRenderer.removeListener(channel, listener);
    },

    invoke: (channel: string, ...args: IpcValue[]) => ipcRenderer.invoke(channel, ...args),

    getModels: async () => {
        const response = await ipcRenderer.invoke(PROXY_CHANNELS.GET_MODELS) as { data?: IpcValue; antigravityError?: string };
        if (Array.isArray(response.data)) {
            return response.data;
        }
        if (typeof response.antigravityError === 'string' && response.antigravityError.trim().length > 0) {
            return { antigravityError: response.antigravityError };
        }
        return [];
    },

    openExternal: (url: string) => {
        void ipcRenderer.invoke(SHELL_CHANNELS.OPEN_EXTERNAL, url);
    },

    isOllamaRunning: () => ipcRenderer.invoke(OLLAMA_CHANNELS.IS_RUNNING),
    startOllama: () => ipcRenderer.invoke(OLLAMA_CHANNELS.START),
    getOllamaHealthStatus: async () => {
        const status = await ipcRenderer.invoke(OLLAMA_CHANNELS.HEALTH_STATUS) as { online?: boolean };
        return { status: status.online ? 'ok' as const : 'error' as const };
    },
    forceOllamaHealthCheck: async () => {
        const status = await ipcRenderer.invoke(OLLAMA_CHANNELS.FORCE_HEALTH_CHECK) as { online?: boolean };
        return { status: status.online ? 'ok' as const : 'error' as const };
    },
    onOllamaStatusChange: (
        callback: (status: { status: string }) => void
    ) => {
        const listener = (_event: IpcRendererEvent, status: { online?: boolean }) => {
            callback({ status: status.online ? 'ok' : 'error' });
        };
        ipcRenderer.on(OLLAMA_CHANNELS.STATUS_CHANGE, listener);
        return () => ipcRenderer.removeListener(OLLAMA_CHANNELS.STATUS_CHANGE, listener);
    },

    // Backward-compatible settings surface used across renderer code.
    getSettings: () => settingsBridge.getSettings(),
    saveSettings: (settings: AppSettings) => settingsBridge.saveSettings(settings),

    code: createCodeBridge(ipcRenderer),
    codeLanguages: createCodeLanguageBridge(ipcRenderer),
    git: createGitBridge(ipcRenderer),
    ollama: createOllamaBridge(ipcRenderer),
    power: createPowerBridge(ipcRenderer),
    llama: createLlamaBridge(ipcRenderer),
    db: createDbBridge(ipcRenderer),
    memory: createMemoryBridge(ipcRenderer),
    advancedMemory: createAdvancedMemoryBridge(ipcRenderer),
    codeSandbox: createCodeSandboxBridge(ipcRenderer),
    voice: createVoiceBridge(ipcRenderer),
    modelCollaboration: createModelCollaborationBridge(ipcRenderer),
    collaboration: createModelCollaborationBridge(ipcRenderer),
    audit: createAuditBridge(ipcRenderer),
    agent: createAgentBridge(ipcRenderer),
    terminal: createTerminalBridge(ipcRenderer),
    theme: createThemeBridge(ipcRenderer),
    ssh: createSSHBridge(ipcRenderer),
    mcp: createMcpBridge(ipcRenderer),
    marketplace: createMarketplaceBridge(ipcRenderer),
    locale: createLocaleBridge(ipcRenderer),
    proxyEmbed: createProxyEmbedBridge(ipcRenderer),
    runtime: createRuntimeBridge(ipcRenderer),
    extension: createExtensionBridge(ipcRenderer),
    metrics: createMetricsBridge(ipcRenderer),
    usage: createUsageBridge(ipcRenderer),
    gallery: createGalleryBridge(ipcRenderer),
    update: createUpdateBridge(ipcRenderer),
    session: createSessionBridge(ipcRenderer),
    workspace: createWorkspaceBridge(ipcRenderer),
    modelRegistry: createModelRegistryBridge(ipcRenderer),
    process: createProcessBridge(ipcRenderer),
    batch: createBatchBridge(ipcRenderer),
    lazyServices: createLazyServicesBridge(ipcRenderer),
    ipcContract: createIpcContractBridge(ipcRenderer),
    files: createFilesBridge(ipcRenderer),
    readPdf: (filePath: string) => ipcRenderer.invoke(FILES_CHANNELS.READ_PDF, filePath),
    sharedPrompts: createSharedPromptsBridge(ipcRenderer),
    dialog: createDialogBridge(ipcRenderer),
    promptTemplates: createPromptTemplatesBridge(ipcRenderer),
    liveCollaboration: createLiveCollaborationBridge(ipcRenderer),
    userCollaboration: createLiveCollaborationBridge(ipcRenderer),
    settings: settingsBridge,
    huggingface: createHuggingFaceBridge(ipcRenderer),
    imageStudio: createImageStudioBridge(ipcRenderer),
    export: createExportBridge(ipcRenderer),
    log: createLogBridge(ipcRenderer),
    security: createSecurityBridge(ipcRenderer),
};

contextBridge.exposeInMainWorld('electron', api);

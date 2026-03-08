import { IpcValue } from '@shared/types/common';
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
// Increase max listeners for ipcRenderer to handle multiple terminal/process streams
ipcRenderer.setMaxListeners(60);

import { createAdvancedMemoryBridge } from './preload/domains/advanced-memory.preload';
import { createAgentBridge } from './preload/domains/agent.preload';
import { createAppBridge } from './preload/domains/app.preload';
import { createAuditBridge } from './preload/domains/audit.preload';
import { createAuthBridge } from './preload/domains/auth.preload';
import { createAuthSessionBridge } from './preload/domains/auth-session.preload';
import { createBatchBridge } from './preload/domains/batch.preload';
import { createChatBridge } from './preload/domains/chat.preload';
import { createClipboardBridge } from './preload/domains/clipboard.preload';
import { createCodeBridge } from './preload/domains/code.preload';
import { createCodeSandboxBridge } from './preload/domains/code-sandbox.preload';
import { createCollaborationBridge } from './preload/domains/collaboration.preload';
import { createDbBridge } from './preload/domains/db.preload';
import { createExportBridge } from './preload/domains/export.preload';
import { createExtensionBridge } from './preload/domains/extension.preload';
import { createFilesBridge } from './preload/domains/files.preload';
import { createGalleryBridge } from './preload/domains/gallery.preload';
import { createGitBridge } from './preload/domains/git.preload';
import { createHuggingFaceBridge } from './preload/domains/huggingface.preload';
import { createIdeasBridge } from './preload/domains/ideas.preload';
import { createIpcContractBridge } from './preload/domains/ipc-contract.preload';
import { createLazyServicesBridge } from './preload/domains/lazy-services.preload';
import { createLinkedAccountsBridge } from './preload/domains/linked-accounts.preload';
import { createLlamaBridge } from './preload/domains/llama.preload';
import { createLogBridge } from './preload/domains/log.preload';
import { createMarketplaceBridge } from './preload/domains/marketplace.preload';
import { createMcpBridge } from './preload/domains/mcp.preload';
import { createMcpMarketplaceBridge } from './preload/domains/mcp-marketplace.preload';
import { createMemoryBridge } from './preload/domains/memory.preload';
import { createMetricsBridge } from './preload/domains/metrics.preload';
import { createModelDownloaderBridge } from './preload/domains/model-downloader.preload';
import { createModelRegistryBridge } from './preload/domains/model-registry.preload';
import { createOllamaBridge } from './preload/domains/ollama.preload';
import { createOrchestratorBridge } from './preload/domains/orchestrator.preload';
import { createPerformanceBridge } from './preload/domains/performance.preload';
import { createProcessBridge } from './preload/domains/process.preload';
import { createProxyBridge } from './preload/domains/proxy.preload';
import { createProxyEmbedBridge } from './preload/domains/proxy-embed.preload';
import { createProxyRateLimitBridge } from './preload/domains/proxy-rate-limit.preload';
import { createSdCppBridge } from './preload/domains/sd-cpp.preload';
import { createSettingsBridge } from './preload/domains/settings.preload';
import { createSSHBridge } from './preload/domains/ssh.preload';
import { createTerminalBridge } from './preload/domains/terminal.preload';
import { createToolsBridge } from './preload/domains/tools.preload';
import { createUpdateBridge } from './preload/domains/update.preload';
import { createUsageBridge } from './preload/domains/usage.preload';
import { createVoiceBridge } from './preload/domains/voice.preload';
import { createWindowControlsBridge } from './preload/domains/window-controls.preload';
import { createWorkflowBridge } from './preload/domains/workflow.preload';
import { createWorkspaceBridge } from './preload/domains/workspace.preload';
import { createWorkspaceAgentBridge } from './preload/domains/workspace-agent.preload';

const api = {
    ...createWindowControlsBridge(ipcRenderer),
    ...createAuthBridge(ipcRenderer),
    ...createProxyBridge(ipcRenderer),
    ...createProxyRateLimitBridge(ipcRenderer),
    ...createAuthSessionBridge(ipcRenderer),
    ...createLinkedAccountsBridge(ipcRenderer),
    ...createAppBridge(ipcRenderer),
    ...createClipboardBridge(ipcRenderer),
    ...createChatBridge(ipcRenderer),
    ...createSdCppBridge(ipcRenderer),
    ...createWorkflowBridge(ipcRenderer),
    ...createModelDownloaderBridge(ipcRenderer),
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

    // Backward compatibility for components using window.electron.on
    on: (channel: string, listener: (event: IpcRendererEvent, ...args: IpcValue[]) => void) => {
        ipcRenderer.on(channel, listener);
        return () => ipcRenderer.removeListener(channel, listener);
    },

    openExternal: (url: string) => {
        void ipcRenderer.invoke('shell:openExternal', url);
    },

    isOllamaRunning: () => ipcRenderer.invoke('ollama:isRunning'),
    startOllama: () => ipcRenderer.invoke('ollama:start'),
    getOllamaHealthStatus: async () => {
        const status = await ipcRenderer.invoke('ollama:healthStatus') as { online?: boolean };
        return { status: status.online ? 'ok' as const : 'error' as const };
    },
    forceOllamaHealthCheck: async () => {
        const status = await ipcRenderer.invoke('ollama:forceHealthCheck') as { online?: boolean };
        return { status: status.online ? 'ok' as const : 'error' as const };
    },
    onOllamaStatusChange: (
        callback: (status: { status: string }) => void
    ) => {
        const listener = (_event: IpcRendererEvent, status: { online?: boolean }) => {
            callback({ status: status.online ? 'ok' : 'error' });
        };
        ipcRenderer.on('ollama:statusChange', listener);
        return () => ipcRenderer.removeListener('ollama:statusChange', listener);
    },

    code: createCodeBridge(ipcRenderer),
    git: createGitBridge(ipcRenderer),
    ollama: createOllamaBridge(ipcRenderer),
    marketplace: createMarketplaceBridge(ipcRenderer),
    performance: createPerformanceBridge(ipcRenderer),
    llama: createLlamaBridge(ipcRenderer),
    db: createDbBridge(ipcRenderer),
    memory: createMemoryBridge(ipcRenderer),
    advancedMemory: createAdvancedMemoryBridge(ipcRenderer),
    codeSandbox: createCodeSandboxBridge(ipcRenderer),
    voice: createVoiceBridge(ipcRenderer),
    collaboration: createCollaborationBridge(ipcRenderer),
    audit: createAuditBridge(ipcRenderer),
    agent: createAgentBridge(ipcRenderer),
    terminal: createTerminalBridge(ipcRenderer),
    ssh: createSSHBridge(ipcRenderer),
    mcp: createMcpBridge(ipcRenderer),
    mcpMarketplace: createMcpMarketplaceBridge(ipcRenderer),
    proxyEmbed: createProxyEmbedBridge(ipcRenderer),
    extension: createExtensionBridge(ipcRenderer),
    orchestrator: createOrchestratorBridge(ipcRenderer),
    metrics: createMetricsBridge(ipcRenderer),
    usage: createUsageBridge(ipcRenderer),
    gallery: createGalleryBridge(ipcRenderer),
    update: createUpdateBridge(ipcRenderer),
    ideas: createIdeasBridge(ipcRenderer),
    workspaceAgent: createWorkspaceAgentBridge(ipcRenderer),
    workspace: createWorkspaceBridge(ipcRenderer),
    modelRegistry: createModelRegistryBridge(ipcRenderer),
    process: createProcessBridge(ipcRenderer),
    batch: createBatchBridge(ipcRenderer),
    lazyServices: createLazyServicesBridge(ipcRenderer),
    ipcContract: createIpcContractBridge(ipcRenderer),
    files: createFilesBridge(ipcRenderer),
    ...createFilesBridge(ipcRenderer),
    ...createSettingsBridge(ipcRenderer),
    ...createHuggingFaceBridge(ipcRenderer),
    ...createUpdateBridge(ipcRenderer),
    ...createExportBridge(ipcRenderer),
    ...createLogBridge(ipcRenderer),
};

contextBridge.exposeInMainWorld('electron', api);

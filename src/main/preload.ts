import { contextBridge, ipcRenderer } from 'electron';
// Increase max listeners for ipcRenderer to handle multiple terminal/process streams
ipcRenderer.setMaxListeners(60);

import { createAuthBridge } from './preload/domains/auth.preload';
import { createWindowControlsBridge } from './preload/domains/window-controls.preload';
import { createCodeBridge } from './preload/domains/code.preload';
import { createOllamaBridge } from './preload/domains/ollama.preload';
import { createProjectBridge } from './preload/domains/project.preload';
import { createProjectAgentBridge } from './preload/domains/project-agent.preload';
import { createOrchestratorBridge } from './preload/domains/orchestrator.preload';
import { createGalleryBridge } from './preload/domains/gallery.preload';
import { createUpdateBridge } from './preload/domains/update.preload';
import { createLogBridge } from './preload/domains/log.preload';
import { createIdeasBridge } from './preload/domains/ideas.preload';
import { createLlamaBridge } from './preload/domains/llama.preload';
import { createSdCppBridge } from './preload/domains/sd-cpp.preload';
import { createWorkflowBridge } from './preload/domains/workflow.preload';
import { createMcpBridge } from './preload/domains/mcp.preload';
import { createMcpMarketplaceBridge } from './preload/domains/mcp-marketplace.preload';
import { createMarketplaceBridge } from './preload/domains/marketplace.preload';
import { createExtensionBridge } from './preload/domains/extension.preload';
import { createExportBridge } from './preload/domains/export.preload';
import { createPerformanceBridge } from './preload/domains/performance.preload';
import { createBatchBridge } from './preload/domains/batch.preload';
import { createLazyServicesBridge } from './preload/domains/lazy-services.preload';
import { createIpcContractBridge } from './preload/domains/ipc-contract.preload';
import { createFilesBridge } from './preload/domains/files.preload';
import { createHuggingFaceBridge } from './preload/domains/huggingface.preload';
import { createGitBridge } from './preload/domains/git.preload';
import { createSSHBridge } from './preload/domains/ssh.preload';
import { createTerminalBridge } from './preload/domains/terminal.preload';
import { createDbBridge } from './preload/domains/db.preload';
import { createMemoryBridge } from './preload/domains/memory.preload';
import { createAdvancedMemoryBridge } from './preload/domains/advanced-memory.preload';
import { createCodeSandboxBridge } from './preload/domains/code-sandbox.preload';
import { createVoiceBridge } from './preload/domains/voice.preload';
import { createAgentBridge } from './preload/domains/agent.preload';
import { createCollaborationBridge } from './preload/domains/collaboration.preload';
import { createAuditBridge } from './preload/domains/audit.preload';
import { createProxyBridge } from './preload/domains/proxy.preload';
import { createProxyEmbedBridge } from './preload/domains/proxy-embed.preload';
import { createProxyRateLimitBridge } from './preload/domains/proxy-rate-limit.preload';
import { createAuthSessionBridge } from './preload/domains/auth-session.preload';
import { createClipboardBridge } from './preload/domains/clipboard.preload';
import { createModelDownloaderBridge } from './preload/domains/model-downloader.preload';
import { createModelRegistryBridge } from './preload/domains/model-registry.preload';
import { createProcessBridge } from './preload/domains/process.preload';
import { createSettingsBridge } from './preload/domains/settings.preload';
import { createLinkedAccountsBridge } from './preload/domains/linked-accounts.preload';
import { createToolsBridge } from './preload/domains/tools.preload';
import { createAppBridge } from './preload/domains/app.preload';

const api = {
    ...createWindowControlsBridge(ipcRenderer),
    ...createAuthBridge(ipcRenderer),
    ...createProxyBridge(ipcRenderer),
    ...createProxyRateLimitBridge(ipcRenderer),
    ...createAuthSessionBridge(ipcRenderer),
    ...createLinkedAccountsBridge(ipcRenderer),
    ...createAppBridge(ipcRenderer),
    ...createClipboardBridge(ipcRenderer),
    ...createSdCppBridge(ipcRenderer),
    ...createWorkflowBridge(ipcRenderer),
    ...createModelDownloaderBridge(ipcRenderer),
    ...createToolsBridge(ipcRenderer),

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
    gallery: createGalleryBridge(ipcRenderer),
    update: createUpdateBridge(ipcRenderer),
    ideas: createIdeasBridge(ipcRenderer),
    projectAgent: createProjectAgentBridge(ipcRenderer),
    project: createProjectBridge(ipcRenderer),
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

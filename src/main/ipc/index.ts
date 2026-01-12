import { BrowserWindow } from 'electron';
import { Services } from '../startup/services';
import { McpDispatcher } from '../mcp/dispatcher';
import { ToolExecutor } from '../tools/tool-executor';

// Import all IPC registration functions
import { registerWindowIpc } from './window';
import { registerAuthIpc } from './auth';
import { registerProxyIpc } from './proxy';
import { registerChatIpc } from './chat';
import { registerUsageIpc } from './usage';
import { registerOllamaIpc } from './ollama';
import { registerDbIpc } from './db';
import { registerSettingsIpc } from './settings';
import { registerSshIpc } from './ssh';
import { registerFilesIpc } from './files';
import { registerToolsIpc } from './tools';
import { registerMcpIpc } from './mcp';
import { registerScreenshotIpc } from './screenshot';
import { registerHFModelIpc } from './huggingface';
import { registerAgentIpc } from './agent';
import { registerProjectIpc } from './project';
import { registerLoggingIpc } from './logging';
import { registerTerminalIpc } from './terminal';
import { registerDialogIpc } from './dialog';
import { registerHistoryIpc } from './history';
import { registerProxyEmbedIpc } from './proxy-embed';
import { registerExportIpc } from './export';
import { registerCouncilIpc } from './council';
import { registerGalleryIpc } from './gallery';
import { registerLlamaIpc } from './llama';
import { registerProcessIpc, setupProcessEvents } from './process';
import { registerCodeIntelligenceIpc } from './code-intelligence';
import { registerMemoryIpc } from './memory';
import { registerGitIpc } from './git';
import { registerHealthIpc } from './health';
import { registerMigrationIpc } from './migration';
import { registerPromptTemplatesIpc } from './prompt-templates';
import { registerTokenEstimationIpc } from './token-estimation';
import { registerKeyRotationIpc } from './key-rotation';
import { registerCollaborationIpc } from './collaboration';
import { registerAuditIpc } from './audit';
import { registerPerformanceIpc } from './performance';
import { registerMultiModelIpc } from './multi-model';
import { registerMetricsIpc } from './metrics';

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
    registerDbIpc(services.databaseService, services.embeddingService, services.auditLogService);
    registerFilesIpc(getWin, services.fileSystemService, allowedFileRoots);
    registerAuditIpc(services.auditLogService);
    registerPerformanceIpc(services.performanceService);
    registerMetricsIpc();

    // AI & LLM
    registerAuthIpc(services.proxyService, services.settingsService, services.copilotService);
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
        proxyService: services.proxyService,
        copilotService: services.copilotService,
        llamaService: services.llamaService
    });
    registerLlamaIpc(services.llamaService);
    registerHFModelIpc(services.llmService, services.huggingFaceService);
    registerTokenEstimationIpc();
    registerKeyRotationIpc(services.keyRotationService);
    registerCollaborationIpc(services.modelCollaborationService);
    registerMultiModelIpc(services.multiModelComparisonService);

    // Productivity & Tools
    registerSshIpc(getWin, services.sshService);
    registerProjectIpc(getWin, services.projectService, services.logoService, services.codeIntelligenceService, services.jobSchedulerService, services.databaseService);
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
}

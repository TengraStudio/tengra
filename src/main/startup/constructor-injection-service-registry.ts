/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
 
import { ChatEventService } from '@main/services/data/chat-event.service';
import { DataService } from '@main/services/data/data.service';
import { DatabaseService } from '@main/services/data/database.service';
import { DatabaseClientService } from '@main/services/data/database-client.service';
import { FileManagementService } from '@main/services/data/file.service';
import { FileChangeTracker } from '@main/services/data/file-change-tracker.service';
import { FileSystemService } from '@main/services/data/filesystem.service';
import { GalleryService } from '@main/services/data/gallery.service';
import { ImagePersistenceService } from '@main/services/data/image-persistence.service';
import { ExportService } from '@main/services/export/export.service';
import { ExtensionService } from '@main/services/extension/extension.service';
import { CronSchedulerService } from '@main/services/external/cron-scheduler.service';
import { FeatureFlagService } from '@main/services/external/feature-flag.service';
import { HttpService } from '@main/services/external/http.service';
import { MarketplaceService } from '@main/services/external/marketplace.service';
import { NotificationDispatcherService } from '@main/services/external/notification-dispatcher.service';
import { RuleService } from '@main/services/external/rule.service';
import { SocialMediaService } from '@main/services/external/social-media.service';
import { WebService } from '@main/services/external/web.service';
import { AdvancedMemoryService } from '@main/services/llm/advanced-memory.service';
import { AgentService } from '@main/services/llm/agent.service';
import { BrainService } from '@main/services/llm/brain.service';
import { ContextRetrievalService } from '@main/services/llm/context-retrieval.service';
import { CopilotService } from '@main/services/llm/copilot/copilot.service';
import { EmbeddingService } from '@main/services/llm/embedding.service';
import { ImageStudioService } from '@main/services/llm/image-studio.service';
import { InlineSuggestionService } from '@main/services/llm/inline-suggestion.service';
import { LLMService } from '@main/services/llm/llm.service';
import { HuggingFaceService } from '@main/services/llm/local/huggingface.service';
import { LlamaService } from '@main/services/llm/local/llama.service';
import { LocalImageService } from '@main/services/llm/local/local-image.service';
import { OllamaService } from '@main/services/llm/local/ollama.service';
import { OllamaHealthService } from '@main/services/llm/local/ollama-health.service';
import { MemoryService } from '@main/services/llm/memory.service';
import { ModelCollaborationService } from '@main/services/llm/model-collaboration.service';
import { ModelDownloaderService } from '@main/services/llm/model-downloader.service';
import { ModelFallbackService } from '@main/services/llm/model-fallback.service';
import { ModelRegistryService } from '@main/services/llm/model-registry.service';
import { ModelSelectionService } from '@main/services/llm/model-selection.service';
import { MultiModelComparisonService } from '@main/services/llm/multi-model-comparison.service';
import { PromptTemplatesService } from '@main/services/llm/prompt-templates.service';
import { ResponseCacheService } from '@main/services/llm/response-cache.service';
import { McpPluginService } from '@main/services/mcp/mcp-plugin.service';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { ProxyProcessManager } from '@main/services/proxy/proxy-process.service';
import { AuthService } from '@main/services/security/auth.service';
import { AuthAPIService } from '@main/services/security/auth-api.service';
import { KeyRotationService } from '@main/services/security/key-rotation.service';
import { SecurityService } from '@main/services/security/security.service';
import { TokenService } from '@main/services/security/token.service';
import { CouncilCapabilityService } from '@main/services/session/capabilities/council-capability.service';
import { ChatSessionRegistryService } from '@main/services/session/chat-session-registry.service';
import { SessionConversationService } from '@main/services/session/session-conversation.service';
import { SessionDirectoryService } from '@main/services/session/session-directory.service';
import { SessionModuleRegistryService } from '@main/services/session/session-module-registry.service';
import { SessionWorkspaceService } from '@main/services/session/session-workspace.service';
import { AuditLogService } from '@main/services/system/audit-log.service';
import { CacheService } from '@main/services/system/cache.service';
import { CodeLanguageService } from '@main/services/system/code-language.service';
import { CommandService } from '@main/services/system/command.service';
import { ConfigService } from '@main/services/system/config.service';
import { DialogService } from '@main/services/system/dialog.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { HealthCheckService } from '@main/services/system/health-check.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { LocaleService } from '@main/services/system/locale.service';
import { LoggingService } from '@main/services/system/logging.service';
import { NetworkService } from '@main/services/system/network.service';
import { PowerManagerService } from '@main/services/system/power-manager.service';
import { ProcessService } from '@main/services/system/process.service';
import { ProcessManagerService } from '@main/services/system/process-manager.service';
import { RuntimeBootstrapService } from '@main/services/system/runtime-bootstrap.service';
import { RuntimeHealthService } from '@main/services/system/runtime-health.service';
import { RuntimeManifestService } from '@main/services/system/runtime-manifest.service';
import { SettingsService } from '@main/services/system/settings.service';
import { SystemService } from '@main/services/system/system.service';
import { ToolsService } from '@main/services/system/tools.service';
import { UpdateService } from '@main/services/system/update.service';
import { UsageService } from '@main/services/system/usage.service';
import { UtilityProcessService } from '@main/services/system/utility-process.service';
import { WindowService } from '@main/services/system/window.service';
import { TerminalProfileService } from '@main/services/terminal/terminal-profile.service';
import { ThemeService } from '@main/services/theme/theme.service';
import { VoiceService } from '@main/services/ui/voice.service';
import { CodeIntelligenceService } from '@main/services/workspace/code-intelligence.service';
import { CodeSandboxService } from '@main/services/workspace/code-sandbox.service';
import { DockerService } from '@main/services/workspace/docker.service';
import { GitService } from '@main/services/workspace/git.service';
import { LspService } from '@main/services/workspace/lsp.service';
import { SSHService } from '@main/services/workspace/ssh.service';
import { TerminalService } from '@main/services/workspace/terminal.service';
import { WorkspaceService } from '@main/services/workspace/workspace.service';
import { WorkspaceAgentSessionService } from '@main/services/workspace/workspace-agent-session.service';
import { IpcBatchService } from '@main/utils/ipc-batch.util';

/**
 * Registry of services that should be automatically registered in the container
 * using constructor injection.
 */
export const constructorInjectionServiceRegistry = [
    // Minimal Services (Critical for boot)
    { id: 'eventBusService', serviceClass: EventBusService, category: 'minimal' },
    { id: 'dataService', serviceClass: DataService, category: 'minimal' },
    { id: 'runtimeManifestService', serviceClass: RuntimeManifestService, category: 'minimal' },
    { id: 'runtimeHealthService', serviceClass: RuntimeHealthService, category: 'minimal' },
    { id: 'runtimeBootstrapService', serviceClass: RuntimeBootstrapService, category: 'minimal' },
    { id: 'settingsService', serviceClass: SettingsService, category: 'minimal' },
    { id: 'securityService', serviceClass: SecurityService, category: 'minimal' },

    // Important Services (Core features)
    { id: 'authService', serviceClass: AuthService, category: 'important' },
    { id: 'databaseService', serviceClass: DatabaseService, category: 'important' },
    { id: 'databaseClientService', serviceClass: DatabaseClientService, category: 'important' },
    { id: 'fileSystemService', serviceClass: FileSystemService, category: 'important' },
    { id: 'commandService', serviceClass: CommandService, category: 'important' },
    { id: 'configService', serviceClass: ConfigService, category: 'important' },
    { id: 'httpService', serviceClass: HttpService, category: 'important' },
    { id: 'networkService', serviceClass: NetworkService, category: 'important' },
    { id: 'systemService', serviceClass: SystemService, category: 'important' },
    { id: 'windowService', serviceClass: WindowService, category: 'important' },
    { id: 'ipcBatchService', serviceClass: IpcBatchService, category: 'important' },
    { id: 'fileChangeTracker', serviceClass: FileChangeTracker, category: 'important' },

    // Deferred Services (Initialized after UI is interactive)
    { id: 'llmService', serviceClass: LLMService, category: 'deferred' },
    { id: 'proxyService', serviceClass: ProxyService, category: 'deferred' },
    { id: 'proxyProcessManager', serviceClass: ProxyProcessManager, category: 'deferred' },
    { id: 'ollamaService', serviceClass: OllamaService, category: 'deferred' },
    { id: 'copilotService', serviceClass: CopilotService, category: 'deferred' },
    { id: 'modelRegistryService', serviceClass: ModelRegistryService, category: 'deferred' },
    { id: 'modelFallbackService', serviceClass: ModelFallbackService, category: 'deferred' },
    { id: 'modelSelectionService', serviceClass: ModelSelectionService, category: 'deferred' },
    { id: 'responseCacheService', serviceClass: ResponseCacheService, category: 'deferred' },
    { id: 'workspaceService', serviceClass: WorkspaceService, category: 'deferred' },
    { id: 'terminalService', serviceClass: TerminalService, category: 'deferred' },
    { id: 'gitService', serviceClass: GitService, category: 'deferred' },
    { id: 'lspService', serviceClass: LspService, category: 'deferred' },
    { id: 'extensionService', serviceClass: ExtensionService, category: 'deferred' },
    { id: 'mcpPluginService', serviceClass: McpPluginService, category: 'deferred' },
    { id: 'agentService', serviceClass: AgentService, category: 'deferred' },
    { id: 'sessionModuleRegistryService', serviceClass: SessionModuleRegistryService, category: 'deferred' },
    { id: 'chatSessionRegistryService', serviceClass: ChatSessionRegistryService, category: 'deferred' },
    { id: 'sessionDirectoryService', serviceClass: SessionDirectoryService, category: 'deferred' },
    { id: 'toolsService', serviceClass: ToolsService, category: 'deferred' },

    // Additional Services
    { id: 'chatEventService', serviceClass: ChatEventService, category: 'deferred' },
    { id: 'fileManagementService', serviceClass: FileManagementService, category: 'deferred' },
    { id: 'galleryService', serviceClass: GalleryService, category: 'deferred' },
    { id: 'exportService', serviceClass: ExportService, category: 'deferred' },
    { id: 'cronSchedulerService', serviceClass: CronSchedulerService, category: 'deferred' },
    { id: 'featureFlagService', serviceClass: FeatureFlagService, category: 'deferred' },
    { id: 'marketplaceService', serviceClass: MarketplaceService, category: 'deferred' },
    { id: 'notificationDispatcherService', serviceClass: NotificationDispatcherService, category: 'deferred' },
    { id: 'ruleService', serviceClass: RuleService, category: 'deferred' },
    { id: 'socialMediaService', serviceClass: SocialMediaService, category: 'deferred' },
    { id: 'webService', serviceClass: WebService, category: 'deferred' },
    { id: 'advancedMemoryService', serviceClass: AdvancedMemoryService, category: 'deferred' },
    { id: 'brainService', serviceClass: BrainService, category: 'deferred' },
    { id: 'contextRetrievalService', serviceClass: ContextRetrievalService, category: 'deferred' },
    { id: 'embeddingService', serviceClass: EmbeddingService, category: 'deferred' },
    { id: 'imageStudioService', serviceClass: ImageStudioService, category: 'deferred' },
    { id: 'inlineSuggestionService', serviceClass: InlineSuggestionService, category: 'deferred' },
    { id: 'huggingfaceService', serviceClass: HuggingFaceService, category: 'deferred' },
    { id: 'llamaService', serviceClass: LlamaService, category: 'deferred' },
    { id: 'localImageService', serviceClass: LocalImageService, category: 'deferred' },
    { id: 'ollamaHealthService', serviceClass: OllamaHealthService, category: 'deferred' },
    { id: 'memoryService', serviceClass: MemoryService, category: 'deferred' },
    { id: 'imagePersistenceService', serviceClass: ImagePersistenceService, category: 'deferred' },
    { id: 'modelCollaborationService', serviceClass: ModelCollaborationService, category: 'deferred' },
    { id: 'modelDownloaderService', serviceClass: ModelDownloaderService, category: 'deferred' },
    { id: 'multiModelComparisonService', serviceClass: MultiModelComparisonService, category: 'deferred' },
    { id: 'promptTemplatesService', serviceClass: PromptTemplatesService, category: 'deferred' },
    { id: 'authAPIService', serviceClass: AuthAPIService, category: 'deferred' },
    { id: 'keyRotationService', serviceClass: KeyRotationService, category: 'deferred' },
    { id: 'tokenService', serviceClass: TokenService, category: 'deferred' },
    { id: 'councilCapabilityService', serviceClass: CouncilCapabilityService, category: 'deferred' },
    { id: 'sessionConversationService', serviceClass: SessionConversationService, category: 'deferred' },
    { id: 'sessionWorkspaceService', serviceClass: SessionWorkspaceService, category: 'deferred' },
    { id: 'auditLogService', serviceClass: AuditLogService, category: 'important' },
    { id: 'cacheService', serviceClass: CacheService, category: 'deferred' },
    { id: 'codeLanguageService', serviceClass: CodeLanguageService, category: 'deferred' },
    { id: 'dialogService', serviceClass: DialogService, category: 'deferred' },
    { id: 'healthCheckService', serviceClass: HealthCheckService, category: 'deferred' },
    { id: 'jobSchedulerService', serviceClass: JobSchedulerService, category: 'deferred' },
    { id: 'localeService', serviceClass: LocaleService, category: 'deferred' },
    { id: 'loggingService', serviceClass: LoggingService, category: 'deferred' },
    { id: 'powerManagerService', serviceClass: PowerManagerService, category: 'deferred' },
    { id: 'processService', serviceClass: ProcessService, category: 'deferred' },
    { id: 'processManagerService', serviceClass: ProcessManagerService, category: 'important' },
    { id: 'updateService', serviceClass: UpdateService, category: 'deferred' },
    { id: 'usageService', serviceClass: UsageService, category: 'deferred' },
    { id: 'utilityProcessService', serviceClass: UtilityProcessService, category: 'deferred' },
    { id: 'terminalProfileService', serviceClass: TerminalProfileService, category: 'deferred' },
    { id: 'themeService', serviceClass: ThemeService, category: 'deferred' },
    { id: 'voiceService', serviceClass: VoiceService, category: 'deferred' },
    { id: 'codeIntelligenceService', serviceClass: CodeIntelligenceService, category: 'deferred' },
    { id: 'workspaceAgentSessionService', serviceClass: WorkspaceAgentSessionService, category: 'deferred' },

    // Lazy Services (Initialized on demand)
    { id: 'sshService', serviceClass: SSHService, category: 'lazy' },
    { id: 'dockerService', serviceClass: DockerService, category: 'lazy' },
    { id: 'codeSandboxService', serviceClass: CodeSandboxService, category: 'lazy' },
];

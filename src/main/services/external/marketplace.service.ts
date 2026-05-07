/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { exec } from 'child_process';
import path from 'path';
import { promisify } from 'util';
const execAsync = promisify(exec);

import { ipc } from '@main/core/ipc-decorators';
import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { ExtensionService } from '@main/services/extension/extension.service';
import { HuggingFaceService } from '@main/services/llm/local/huggingface.service';
import { LlamaService } from '@main/services/llm/local/llama.service';
import { OllamaService } from '@main/services/llm/local/ollama.service';
import {
    ModelDownloaderService,
    ModelDownloadResult
} from '@main/services/llm/model-downloader.service';
import { McpPluginService } from '@main/services/mcp/mcp-plugin.service';
import { CodeLanguageService } from '@main/services/system/code-language.service';
import { LocaleService } from '@main/services/system/locale.service';
import { SettingsService } from '@main/services/system/settings.service';
import { SystemService } from '@main/services/system/system.service';
import { ThemeService } from '@main/services/theme/theme.service';
import { MARKETPLACE_CHANNELS } from '@shared/constants/ipc-channels';
import { localePackSchema } from '@shared/schemas/locale.schema';
import {
    marketplaceInstallRequestSchema,
    marketplaceRegistrySchema,
    remoteModelRecordSchema,
    remoteModelSourceSchema,
} from '@shared/schemas/marketplace.schema';
import {
    IndexedModel,
    InstallRequest,
    InstallResult,
    MarketplaceExtension,
    MarketplaceItem,
    MarketplaceMcp,
    MarketplaceModel,
    MarketplaceRegistry,
    MarketplaceRuntimeProfile,
    RemoteModelSourceConfig,
} from '@shared/types/marketplace';
import { MCPServerConfig } from '@shared/types/settings';
import axios from 'axios';
import { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { app } from 'electron';
import fs from 'fs-extra';
import { z } from 'zod';

type ExtensionPackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

interface MarketplaceExtensionManifestMetadata {
    main?: string;
    id?: string;
}

interface MarketplaceExtensionPackageJson {
    id?: string;
    name?: string;
    version?: string;
    main?: string;
    packageManager?: string;
    scripts?: Record<string, string>;
    tengra?: MarketplaceExtensionManifestMetadata;
    manifest?: MarketplaceExtensionManifestMetadata;
}

export interface MarketplaceServiceDependencies {
    localeService?: LocaleService;
    themeService?: ThemeService;
    codeLanguageService?: CodeLanguageService;
    modelDownloaderService?: ModelDownloaderService;
    huggingFaceService?: HuggingFaceService;
    ollamaService?: OllamaService;
    systemService?: SystemService;
    llamaService?: LlamaService;
    extensionService?: ExtensionService;
    settingsService?: SettingsService;
    mcpPluginService?: McpPluginService;
}

export class MarketplaceService extends BaseService {
    private static readonly REGISTRY_CACHE_TTL_MS = 5 * 60 * 1000;
    private readonly REGISTRY_URL = 'https://raw.githubusercontent.com/TengraStudio/tengra-market/main/registry.json';
    private readonly MARKET_BASE_URL = 'https://raw.githubusercontent.com/TengraStudio/tengra-market/main';
    private readonly MODEL_SOURCES: RemoteModelSourceConfig[] = [
        { provider: 'ollama', url: `${this.MARKET_BASE_URL}/models/ollama-models.json` },
        { provider: 'huggingface', url: `${this.MARKET_BASE_URL}/models/huggingface-models.json` },
        { provider: 'custom', url: `${this.MARKET_BASE_URL}/models/custom-models.json` },
    ];
    private readonly USER_THEMES_PATH = path.join(app.getPath('userData'), 'runtime', 'themes');
    private readonly USER_MCP_PATH = path.join(app.getPath('userData'), 'runtime', 'mcp');
    private readonly USER_MODELS_PATH = path.join(app.getPath('userData'), 'runtime', 'models');
    private readonly USER_PROMPTS_PATH = path.join(app.getPath('userData'), 'runtime', 'prompts');
    private readonly USER_LOCALES_PATH = path.join(app.getPath('userData'), 'runtime', 'locales');
    private readonly USER_SKILLS_PATH = path.join(app.getPath('userData'), 'runtime', 'skills');
    private readonly USER_ICON_PACKS_PATH = path.join(app.getPath('userData'), 'runtime', 'icon-packs');
    private readonly USER_EXTENSIONS_PATH = path.join(app.getPath('userData'), 'extensions');
    private readonly USER_CODE_LANGUAGES_PATH = path.join(app.getPath('userData'), 'runtime', 'code-languages');
    private readonly liveUpdates = new Set<string>();
    private cachedRegistry: MarketplaceRegistry | null = null;
    private cachedRegistryAt = 0;
    private registryFetchPromise: Promise<MarketplaceRegistry> | null = null;

    private readonly localeService?: LocaleService;
    private readonly themeService?: ThemeService;
    private readonly codeLanguageService?: CodeLanguageService;
    private readonly modelDownloaderService?: ModelDownloaderService;
    private readonly huggingFaceService?: HuggingFaceService;
    private readonly ollamaService?: OllamaService;
    private readonly systemService?: SystemService;
    private readonly llamaService?: LlamaService;
    private readonly extensionService?: ExtensionService;
    private readonly settingsService?: SettingsService;
    private readonly mcpPluginService?: McpPluginService;

    constructor(
        deps: MarketplaceServiceDependencies,
        private readonly mainWindowProvider?: () => BrowserWindow | null
    ) {
        super('MarketplaceService');
        this.localeService = deps.localeService;
        this.themeService = deps.themeService;
        this.codeLanguageService = deps.codeLanguageService;
        this.modelDownloaderService = deps.modelDownloaderService;
        this.huggingFaceService = deps.huggingFaceService;
        this.ollamaService = deps.ollamaService;
        this.systemService = deps.systemService;
        this.llamaService = deps.llamaService;
        this.extensionService = deps.extensionService;
        this.settingsService = deps.settingsService;
        this.mcpPluginService = deps.mcpPluginService;
    }

    @ipc(MARKETPLACE_CHANNELS.FETCH)
    async fetchRegistryIpc() {
        return await this.fetchRegistry();
    }

    @ipc(MARKETPLACE_CHANNELS.GET_RUNTIME_PROFILE)
    async getRuntimeProfileIpc() {
        return await this.getRuntimeProfile();
    }

    @ipc(MARKETPLACE_CHANNELS.GET_UPDATE_COUNT)
    async getUpdateCountIpc() {
        return await this.getUpdateCount();
    }

    @ipc(MARKETPLACE_CHANNELS.CHECK_LIVE_UPDATES)
    async checkLiveUpdatesIpc() {
        return await this.checkLiveExtensionUpdates();
    }

    @ipc(MARKETPLACE_CHANNELS.FETCH_README)
    async fetchReadmeIpc(_event: IpcMainInvokeEvent, extensionId: string, repository?: string) {
        return await this.fetchExtensionReadme(extensionId, repository);
    }

    @ipc(MARKETPLACE_CHANNELS.INSTALL)
    async installItemIpc(_event: IpcMainInvokeEvent, request: InstallRequest) {
        try {
            const validatedRequest = marketplaceInstallRequestSchema.parse(request);
            const baseInstallItem = {
                id: validatedRequest.id,
                name: validatedRequest.name ?? validatedRequest.id,
                description: validatedRequest.description ?? `${validatedRequest.type} item installed from marketplace.`,
                author: validatedRequest.author ?? 'Marketplace',
                version: validatedRequest.version ?? 'latest',
                itemType: validatedRequest.type,
                downloadUrl: validatedRequest.downloadUrl,
            } satisfies MarketplaceItem;

            const itemToInstall = validatedRequest.type === 'model'
                ? {
                    ...baseInstallItem,
                    provider: validatedRequest.provider ?? 'custom',
                    source: validatedRequest.provider ?? 'custom',
                    sourceUrl: validatedRequest.sourceUrl,
                    category: validatedRequest.category,
                    pipelineTag: validatedRequest.pipelineTag,
                } satisfies MarketplaceModel
                : baseInstallItem;

            const result = await this.installItem(itemToInstall);

            if (result.success) {
                const mainWindow = this.mainWindowProvider?.();
                if (validatedRequest.type === 'theme') {
                    appLogger.info('MarketplaceService', 'Theme installed, triggering reload...');
                    if (this.themeService) {
                        await this.themeService.initialize();
                    }
                    if (mainWindow) {
                        mainWindow.webContents.send('theme:runtime:updated');
                    }
                }
                if (validatedRequest.type === 'language') {
                    appLogger.info('MarketplaceService', 'Language pack installed, triggering reload...');
                    if (this.localeService) {
                        await this.localeService.reload();
                    }
                    if (mainWindow) {
                        mainWindow.webContents.send('locale:runtime:updated');
                    }
                }
                if (validatedRequest.type === 'code-language-pack') {
                    appLogger.info('MarketplaceService', 'Code language pack installed, triggering reload...');
                    if (this.codeLanguageService) {
                        await this.codeLanguageService.reload();
                    }
                    if (mainWindow) {
                        mainWindow.webContents.send('code-language:runtime:updated');
                    }
                }
            }
            return result;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Installation failed';
            const [code, humanMessage] = message.includes(':')
                ? [message.split(':', 1)[0], message.slice(message.indexOf(':') + 1).trim()]
                : ['INSTALL_FAILED', message];
            return {
                success: false,
                code,
                message: humanMessage,
                path: '',
                queuedDownloads: 0,
                downloadIds: [],
            };
        }
    }

    @ipc(MARKETPLACE_CHANNELS.UNINSTALL)
    async uninstallItemIpc(_event: IpcMainInvokeEvent, itemId: string, itemType?: MarketplaceItem['itemType']) {
        const resolvedItemType = itemType ?? await this.resolveMarketplaceItemType(itemId);
        const result = await this.uninstallItem(itemId, resolvedItemType);
        if (result.success && resolvedItemType === 'code-language-pack') {
            if (this.codeLanguageService) {
                await this.codeLanguageService.reload();
            }
            const mainWindow = this.mainWindowProvider?.();
            if (mainWindow) {
                mainWindow.webContents.send('code-language:runtime:updated');
            }
        }
        return result;
    }

    async initialize(): Promise<void> {
        this.logInfo('Initializing Marketplace...');
        await fs.ensureDir(this.USER_THEMES_PATH);
        await fs.ensureDir(this.USER_MCP_PATH);
        await fs.ensureDir(this.USER_MODELS_PATH);
        await fs.ensureDir(this.USER_PROMPTS_PATH);
        await fs.ensureDir(this.USER_LOCALES_PATH);
        await fs.ensureDir(this.USER_SKILLS_PATH);
        await fs.ensureDir(this.USER_ICON_PACKS_PATH);
        await fs.ensureDir(this.USER_EXTENSIONS_PATH);
        await fs.ensureDir(this.USER_CODE_LANGUAGES_PATH);
    }

    private invalidateRegistryCache(): void {
        this.cachedRegistryAt = 0;
        this.cachedRegistry = null;
    }

    /**
     * GitHub'dan merkezi registry dosyasını çeker.
     */
    async fetchRegistry(): Promise<MarketplaceRegistry> {
        const cacheAgeMs = Date.now() - this.cachedRegistryAt;
        if (this.cachedRegistry && cacheAgeMs < MarketplaceService.REGISTRY_CACHE_TTL_MS) {
            return this.cachedRegistry;
        }

        if (this.registryFetchPromise) {
            return await this.registryFetchPromise;
        }

        this.registryFetchPromise = this.fetchRegistryInternal().finally(() => {
            this.registryFetchPromise = null;
        });

        return await this.registryFetchPromise;
    }

    private async fetchRegistryInternal(): Promise<MarketplaceRegistry> {
        try {
            this.logInfo('Fetching marketplace registry from GitHub...');
            const [response, mergedModels] = await Promise.all([
                axios.get<MarketplaceRegistry>(this.REGISTRY_URL),
                this.fetchMergedModels(),
            ]);
            const baseRegistry = this.normalizeRegistryBeforeValidation(response.data);
            const normalizedRegistry = marketplaceRegistrySchema.parse({
                ...baseRegistry,
                models: mergedModels,
            } satisfies MarketplaceRegistry);
            const availabilityFilteredRegistry = await this.filterUnavailableLanguagePacks(normalizedRegistry);
            this.cachedRegistry = await this.applyInstalledState(availabilityFilteredRegistry);
            this.cachedRegistryAt = Date.now();
            return this.cachedRegistry;
        } catch (error) {
            this.logError('Failed to fetch registry', error as Error);
            throw new Error('Marketplace registry could not be loaded.');
        }
    }

    /**
     * Toplam güncelleme sayısını döner.
     */
    async getUpdateCount(): Promise<number> {
        const registry = await this.fetchRegistry();
        let count = 0;

        registry.extensions?.forEach(item => {
            if (item.updateAvailable) { count++; }
        });
        registry.mcp?.forEach(item => {
            if (item.updateAvailable) { count++; }
        });
        registry.themes?.forEach(item => {
            if (item.updateAvailable) { count++; }
        });
        registry.models?.forEach(model => {
            if (model.updateAvailable) { count++; }
        });
        registry.skills?.forEach(item => {
            if (item.updateAvailable) { count++; }
        });
        registry.languages?.forEach(item => {
            if (item.updateAvailable) { count++; }
        });
        registry.prompts?.forEach(item => {
            if (item.updateAvailable) { count++; }
        });
        registry.iconPacks?.forEach(item => {
            if (item.updateAvailable) { count++; }
        });

        return count;
    }

    /**
     * Eklentiler için canlı versiyon kontrolü yapar.
     */
    async checkLiveExtensionUpdates(): Promise<number> {
        this.logInfo('Checking for extension updates...');
        let count = 0;
        try {
            const registry = await this.fetchRegistry();

            // Check GitHub raw for each installed extension to find stealth updates (not yet in registry.json)
            for (const item of registry.extensions || []) {
                if (!item.installed || !item.repository) {
                    continue;
                }

                try {
                    const remoteVersion = await this.fetchGithubRawVersion(item.repository);
                    if (remoteVersion && this.isNewerVersion(item.installedVersion || '0.0.0', remoteVersion)) {
                        item.updateAvailable = true;
                        this.liveUpdates.add(item.id);
                        this.logInfo(`Live update detected for ${item.id}: ${item.installedVersion} -> ${remoteVersion}`);
                    }
                } catch (e) {
                    // ignore individual fetch errors
                    this.logError(`Failed to fetch live update for ${item.id}`, e as Error);
                }
            }

            // Calculate count from the modified registry object
            const allItems = [
                ...(registry.models || []),
                ...(registry.themes || []),
                ...(registry.mcp || []),
                ...(registry.prompts || []),
                ...(registry.languages || []),
                ...(registry.skills || []),
                ...(registry.extensions || []),
            ];

            count = allItems.filter(item => item.updateAvailable).length;
        } catch (error) {
            this.logError('Live update check failed', error as Error);
        }

        return count;
    }

    private async fetchGithubRawVersion(repositoryUrl: string): Promise<string | undefined> {
        const baseUrl = repositoryUrl.replace(/\.git$/, '');
        if (!baseUrl.includes('github.com')) {
            return undefined;
        }

        const rawBase = baseUrl.replace('github.com', 'raw.githubusercontent.com');
        for (const branch of ['main', 'master']) {
            try {
                const pkgUrl = `${rawBase}/${branch}/package.json`;
                const response = await axios.get(pkgUrl, { timeout: 2000 });
                const version = response.data?.version;
                if (typeof version === 'string' && version.length > 0) {
                    return version;
                }
            } catch {
                // Try next branch.
            }
        }

        return undefined;
    }

    /**
     * Collects a device runtime profile used for marketplace compatibility estimates.
     */
    async getRuntimeProfile(): Promise<MarketplaceRuntimeProfile> {
        const [systemInfo, storageStats, usageStats, gpuInfo, llamaGpu, ollamaGpu] = await Promise.all([
            this.getSystemInfoSafe(),
            this.getStorageStatsSafe(),
            this.getUsageStatsSafe(),
            this.getGpuInfoSafe(),
            this.getLlamaGpuSafe(),
            this.getOllamaGpuSafe(),
        ]);
        return {
            system: this.buildSystemProfile(systemInfo, storageStats, usageStats),
            gpu: this.buildGpuProfile(gpuInfo, llamaGpu, ollamaGpu),
            performance: this.buildPerformanceProfile(),
        };
    }

    /**
     * Bir itemı (tema, mcp, persona, model, prompt) GitHub'dan indirip yerel klasöre kaydeder.
     */
    async installItem(item: MarketplaceItem): Promise<InstallResult> {
        try {
            this.logInfo(`Downloading ${item.itemType}: ${item.name}`);

            let targetPath = '';
            let fileName = '';
            let payload: RuntimeValue | null = null;
            const sanitizedId = this.sanitizeFileNameStem(item.id);

            switch (item.itemType) {
                case 'theme':
                    targetPath = this.USER_THEMES_PATH;
                    fileName = `${sanitizedId}.theme.json`;
                    payload = (await axios.get(item.downloadUrl)).data as RuntimeValue;
                    break;
                case 'mcp':
                    targetPath = this.USER_MCP_PATH;
                    fileName = `${sanitizedId}.mcp.json`;
                    payload = (await axios.get(item.downloadUrl)).data as RuntimeValue;
                    break;
                case 'model':
                    targetPath = this.USER_MODELS_PATH;
                    fileName = `${sanitizedId}.model.json`;
                    payload = this.buildSafeModelInstallPayload(item);
                    break;
                case 'prompt':
                    targetPath = this.USER_PROMPTS_PATH;
                    fileName = `${sanitizedId}.prompt.json`;
                    payload = (await axios.get(item.downloadUrl)).data as RuntimeValue;
                    break;
                case 'language':
                    targetPath = this.USER_LOCALES_PATH;
                    fileName = `${sanitizedId}.locale.json`;
                    payload = localePackSchema.parse((await axios.get(item.downloadUrl)).data);
                    break;
                case 'skill':
                    targetPath = this.USER_SKILLS_PATH;
                    fileName = `${sanitizedId}.skill.json`;
                    payload = (await axios.get(item.downloadUrl)).data as RuntimeValue;
                    break;
                case 'icon-pack':
                    targetPath = this.USER_ICON_PACKS_PATH;
                    fileName = `${sanitizedId}.icon-pack.json`;
                    payload = (await axios.get(item.downloadUrl)).data as RuntimeValue;
                    break;
                case 'extension': {
                    targetPath = this.USER_EXTENSIONS_PATH;
                    const extensionItem = item as MarketplaceExtension;
                    const extensionInstallPath = path.join(targetPath, sanitizedId);
                    const repoUrl = extensionItem.repository ?? '';

                    if (item.downloadUrl.endsWith('.git') || repoUrl.endsWith('.git')) {
                        payload = { type: 'git', url: item.downloadUrl || repoUrl };
                    } else {
                        await fs.ensureDir(extensionInstallPath);
                        payload = (await axios.get(item.downloadUrl)).data as RuntimeValue;
                    }
                    break;
                }
                default:
                    throw new Error(`Unsupported item type: ${item.itemType}`);
            }

            if (payload === null) {
                throw new Error(`Marketplace payload could not be resolved for item: ${item.id}`);
            }

            if (item.itemType === 'model') {
                const modelPayload = payload as MarketplaceModel;
                const queued = await this.queueModelDownload(modelPayload);

                // For Ollama and HuggingFace, we don't need a .model.json marker file anymore
                // as we can detect them via their respective services directly.
                if (modelPayload.provider !== 'ollama' && modelPayload.provider !== 'huggingface') {
                    const filePath = path.join(targetPath, fileName);
                    await fs.writeJson(filePath, payload, { spaces: 2 });
                }

                this.logInfo(`${item.itemType} processed and queued download(s)`, {
                    provider: modelPayload.provider,
                    queuedDownloads: queued.queuedDownloads,
                });
                this.invalidateRegistryCache();

                return {
                    success: true,
                    path: targetPath, // Return the directory for models
                    code: queued.queuedDownloads > 0 ? 'DOWNLOAD_QUEUED' : 'ALREADY_DOWNLOADED',
                    message: queued.queuedDownloads > 0 ? 'Model download initiated.' : 'Model is already being processed.',
                    queuedDownloads: queued.queuedDownloads,
                    downloadIds: queued.downloadIds,
                };
            }

            if (item.itemType === 'extension') {
                const extensionPath = path.join(targetPath, sanitizedId);
                const gitPayload = payload as { type?: string; url?: string };

                await this.deactivateExtensionBeforeDiskUpdate(item.id);

                if (gitPayload.type === 'git' && gitPayload.url) {
                    this.logInfo(`Cloning extension from git: ${gitPayload.url}`);
                    // Use a helper or direct exec to clone
                    await this.cloneExtensionRepository(gitPayload.url, extensionPath);
                } else {
                    const manifestPath = path.join(extensionPath, 'package.json');
                    await fs.writeJson(manifestPath, payload, { spaces: 2 });
                }

                await this.ensureExtensionEntrypoint(extensionPath);

                if (this.extensionService) {
                    const installResult = await this.extensionService.installExtension(extensionPath);
                    if (!installResult.success || !installResult.extensionId) {
                        throw new Error(installResult.error ?? `Failed to install extension: ${item.id}`);
                    }
                    const activationResult = await this.extensionService.activateExtension(installResult.extensionId);
                    if (!activationResult.success) {
                        throw new Error(activationResult.error ?? `Failed to activate extension: ${installResult.extensionId}`);
                    }
                }

                this.liveUpdates.delete(item.id);
                this.invalidateRegistryCache();
                this.logInfo(`${item.itemType} installed successfully at: ${extensionPath}`);
                return { success: true, path: extensionPath };
            }

            if (item.itemType === 'mcp') {
                const mcpPayload = payload as MarketplaceMcp;
                const mcpConfig = await this.prepareMcpInstallConfig(mcpPayload, targetPath, sanitizedId);
                const filePath = path.join(targetPath, fileName);
                await fs.writeJson(filePath, { ...mcpPayload, ...mcpConfig }, { spaces: 2 });

                this.invalidateRegistryCache();
                this.logInfo(`${item.itemType} installed successfully at: ${filePath}`);
                return { success: true, path: filePath, mcpConfig };
            }

            const filePath = path.join(targetPath, fileName);
            await fs.writeJson(filePath, payload, { spaces: 2 });

            this.invalidateRegistryCache();
            this.logInfo(`${item.itemType} installed successfully at: ${filePath}`);
            return { success: true, path: filePath };
        } catch (error) {
            this.logError(`Failed to install item: ${item.name}`, error as Error);
            const installError = this.classifyInstallError(error as Error | z.ZodError | RuntimeValue);
            throw new Error(`${installError.code}:${installError.message}`);
        }
    }

    /**
     * Uninstalls an item from the marketplace based on its type.
     */
    async uninstallItem(itemId: string, itemType: MarketplaceItem['itemType']): Promise<{ success: boolean; error?: string; messageKey?: string }> {
        try {
            this.logInfo(`Uninstalling ${itemType}: ${itemId}`);

            switch (itemType) {
                case 'extension':
                    if (this.extensionService) {
                        return await this.extensionService.uninstallExtension(itemId);
                    }
                    throw new Error('Extension service not available');

                case 'mcp': {
                    if (this.mcpPluginService) {
                        await this.mcpPluginService.unregisterPlugin(itemId);
                    }
                    // Also delete the .mcp.json file if it exists in the runtime folder
                    const mcpPath = path.join(this.USER_MCP_PATH, `${this.sanitizeFileNameStem(itemId)}.mcp.json`);
                    if (await fs.pathExists(mcpPath)) {
                        await fs.remove(mcpPath);
                    }
                    this.invalidateRegistryCache();
                    return { success: true };
                }

                case 'theme': {
                    const themePath = path.join(this.USER_THEMES_PATH, `${this.sanitizeFileNameStem(itemId)}.theme.json`);
                    if (await fs.pathExists(themePath)) {
                        await fs.remove(themePath);
                    }
                    this.invalidateRegistryCache();
                    return { success: true };
                }


                case 'prompt': {
                    const promptPath = path.join(this.USER_PROMPTS_PATH, `${this.sanitizeFileNameStem(itemId)}.prompt.json`);
                    if (await fs.pathExists(promptPath)) {
                        await fs.remove(promptPath);
                    }
                    this.invalidateRegistryCache();
                    return { success: true };
                }

                case 'language': {
                    const localePath = path.join(this.USER_LOCALES_PATH, `${this.sanitizeFileNameStem(itemId)}.locale.json`);
                    if (await fs.pathExists(localePath)) {
                        await fs.remove(localePath);
                    }
                    if (this.localeService) {
                        await this.localeService.reload();
                    }
                    return { success: true };
                }

                case 'skill': {
                    const skillPath = path.join(this.USER_SKILLS_PATH, `${this.sanitizeFileNameStem(itemId)}.skill.json`);
                    if (await fs.pathExists(skillPath)) {
                        await fs.remove(skillPath);
                    }
                    return { success: true };
                }

                case 'icon-pack': {
                    const iconPackPath = path.join(this.USER_ICON_PACKS_PATH, `${this.sanitizeFileNameStem(itemId)}.icon-pack.json`);
                    if (await fs.pathExists(iconPackPath)) {
                        await fs.remove(iconPackPath);
                    }
                    return { success: true };
                }

                case 'model': {
                    const model = await this.resolveMarketplaceModel(itemId);
                    if (model?.provider === 'ollama' && this.ollamaService) {
                        const result = await this.ollamaService.deleteModel(this.resolveOllamaModelName(model));
                        if (!result.success) {
                            return result;
                        }
                    } else if (model?.provider === 'huggingface' && this.huggingFaceService) {
                        const modelId = this.resolveHuggingFaceModelId(model) ?? itemId;
                        const result = await this.huggingFaceService.deleteModel(modelId);
                        if (!result.success) {
                            return result;
                        }
                    } else if (this.llamaService) {
                        const result = await this.llamaService.deleteModel(itemId);
                        if (!result.success) {
                            return result;
                        }
                    }

                    const modelJsonPath = path.join(this.USER_MODELS_PATH, `${this.sanitizeFileNameStem(itemId)}.model.json`);
                    if (await fs.pathExists(modelJsonPath)) {
                        await fs.remove(modelJsonPath);
                    }
                    this.invalidateRegistryCache();
                    return { success: true };
                }

                default:
                    throw new Error(`Unsupported item type for uninstallation: ${itemType}`);
            }
        } catch (error) {
            this.logError(`Failed to uninstall item: ${itemId}`, error as Error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    private async resolveMarketplaceItemType(itemId: string): Promise<MarketplaceItem['itemType']> {
        const registry = await this.fetchRegistry();
        const collections: Array<Array<MarketplaceItem | undefined> | undefined> = [
            registry.extensions,
            registry.mcp,
            registry.themes,
            registry.models,
            registry.prompts,
            registry.languages,
            registry.skills,
            registry.iconPacks,
            registry.codeLanguagePacks,
        ];

        for (const collection of collections) {
            const match = collection?.find(item => item?.id === itemId);
            if (match?.itemType) {
                return match.itemType;
            }
        }

        return 'model';
    }

    private async resolveMarketplaceModel(itemId: string): Promise<MarketplaceModel | null> {
        const registry = await this.fetchRegistry();
        return registry.models?.find(model => model.id === itemId) ?? null;
    }

    async dispose(): Promise<void> {
        this.logInfo('Disposing Marketplace service...');
    }

    private async deactivateExtensionBeforeDiskUpdate(extensionId: string): Promise<void> {
        if (!this.extensionService) {
            return;
        }

        const installedExtension = this.extensionService.getExtension(extensionId);
        if (installedExtension.extension?.status !== 'active') {
            return;
        }

        const deactivation = await this.extensionService.deactivateExtension(extensionId);
        if (!deactivation.success) {
            throw new Error(deactivation.error ?? `Failed to deactivate extension before update: ${extensionId}`);
        }

        this.logInfo(`Extension deactivated before marketplace update: ${extensionId}`);
    }

    private sanitizeMcpFileName(fileName?: string): string {
        const candidate = fileName?.trim() || 'server.mjs';
        const baseName = path.basename(candidate).replace(/[^a-zA-Z0-9._-]/g, '-');
        if (!baseName.endsWith('.mjs') && !baseName.endsWith('.js') && !baseName.endsWith('.cjs')) {
            throw new Error('MCP entrypoint must be a JavaScript file.');
        }
        return baseName;
    }

    private async prepareMcpInstallConfig(
        item: MarketplaceMcp,
        targetPath: string,
        sanitizedId: string
    ): Promise<MCPServerConfig> {
        let command = item.command;
        let args = item.args;
        if (item.entrypointUrl) {
            const pluginDirectory = path.join(targetPath, sanitizedId);
            const entrypointFileName = this.sanitizeMcpFileName(item.entrypointFile);
            const entrypointPath = path.join(pluginDirectory, entrypointFileName);
            await fs.ensureDir(pluginDirectory);
            const response = await axios.get<string>(item.entrypointUrl, { responseType: 'text' });
            await fs.writeFile(entrypointPath, response.data, 'utf8');
            command = 'node';
            args = [entrypointPath];
        }
        return {
            id: item.id,
            name: item.id,
            description: item.description,
            command,
            args,
            env: item.env,
            enabled: false,
            permissionProfile: item.permissionProfile,
            permissions: item.permissions,
            tools: item.tools,
            category: item.category,
            publisher: item.author,
            version: item.version,
            extensionType: 'mcp_server',
            isOfficial: true,
            capabilities: item.capabilities,
            storage: item.storage,
        };
    }

    private async fetchMergedModels(): Promise<MarketplaceModel[]> {
        const sourceResults = await Promise.all(this.MODEL_SOURCES.map(source => this.fetchModelsFromSource(source)));
        const indexedModels: IndexedModel[] = [];
        for (const models of sourceResults) {
            for (const model of models) {
                indexedModels.push({ item: model, order: indexedModels.length });
            }
        }
        return this.dedupeAndSortModels(indexedModels);
    }

    private async fetchModelsFromSource(source: RemoteModelSourceConfig): Promise<MarketplaceModel[]> {
        try {
            const response = await axios.get(source.url);
            const parsedSource = remoteModelSourceSchema.safeParse(response.data);
            if (!parsedSource.success) {
                this.logWarn(`Model source parse failed for ${source.provider}`, {
                    url: source.url,
                    issues: parsedSource.error.issues.map(issue => issue.message).slice(0, 5),
                });
                return [];
            }
            const validModels: Array<z.infer<typeof remoteModelRecordSchema>> = [];
            let invalidRecords = 0;

            for (const item of parsedSource.data.models) {
                const rawModel = item as Record<string, unknown>;
                if (!rawModel.id && typeof rawModel.modelId === 'string' && rawModel.modelId.length > 0) {
                    rawModel.id = rawModel.modelId;
                }

                const parsedModel = remoteModelRecordSchema.safeParse(rawModel);
                if (parsedModel.success) {
                    validModels.push(parsedModel.data);
                } else {
                    invalidRecords++;
                }
            }

            if (invalidRecords > 0) {
                this.logInfo(`Skipped ${invalidRecords} invalid model records for ${source.provider} (Likely schema mismatch or incomplete metadata)`, {
                    url: source.url,
                });
            }
            return this.mapRemoteModels(validModels, source.provider);
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
                // Silently skip if source is not found (e.g. custom-models.json)
                return [];
            }
            this.logWarn(`Model source fetch failed for ${source.provider}`, {
                url: source.url,
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }

    private mapRemoteModels(
        remoteModels: Array<z.infer<typeof remoteModelRecordSchema>>,
        provider: MarketplaceModel['provider']
    ): MarketplaceModel[] {
        const mapped: MarketplaceModel[] = [];
        for (const model of remoteModels) {
            const normalizedProvider = model.provider ?? provider;
            const downloadUrl = this.resolveModelDownloadUrl(model, normalizedProvider);
            if (!downloadUrl) {
                continue;
            }
            const cleanedCategory = this.cleanOptionalText(model.category);
            const cleanedPipelineTag = this.cleanOptionalText(model.pipelineTag);
            const normalizedId = this.normalizeModelId(model, normalizedProvider);
            mapped.push({
                id: normalizedId,
                name: this.normalizeModelName(model, normalizedId),
                description: this.normalizeModelDescription(model, normalizedProvider),
                author: this.normalizeModelAuthor(model, normalizedProvider),
                version: this.normalizeModelVersion(model),
                downloadUrl,
                itemType: 'model',
                provider: normalizedProvider,
                source: provider,
                sourceUrl: this.cleanOptionalUrl(model.sourceUrl),
                category: cleanedCategory ? this.fitToLength(cleanedCategory, 64) : undefined,
                pipelineTag: cleanedPipelineTag ? this.fitToLength(cleanedPipelineTag, 64) : undefined,
                readme: model.readme,
                parameters: model.parameters,
                totalSize: this.cleanOptionalText(model.totalSize)?.slice(0, 64),
                pullCount: model.pullCount,
                downloads: model.downloads,
                likes: model.likes,
                submodels: model.submodels,
            });
        }
        return mapped;
    }

    private resolveModelDownloadUrl(
        model: z.infer<typeof remoteModelRecordSchema>,
        provider: MarketplaceModel['provider']
    ): string | null {
        const directDownloadUrl = this.cleanOptionalUrl(model.downloadUrl);
        if (directDownloadUrl) {
            return directDownloadUrl;
        }
        const sourceUrl = this.cleanOptionalUrl(model.sourceUrl);
        if (sourceUrl) {
            return sourceUrl;
        }
        if (provider === 'ollama') {
            return `https://ollama.com/library/${encodeURIComponent(model.id)}`;
        }
        if (provider === 'huggingface') {
            return `https://huggingface.co/${model.id}`;
        }
        return null;
    }

    private dedupeAndSortModels(indexedModels: IndexedModel[]): MarketplaceModel[] {
        const deduped = new Map<string, IndexedModel>();
        for (const indexedModel of indexedModels) {
            const key = `${indexedModel.item.provider}:${indexedModel.item.id}`;
            if (!deduped.has(key)) {
                deduped.set(key, indexedModel);
            }
        }
        const sorted = Array.from(deduped.values()).sort((left, right) => {
            const nameComparison = left.item.name.localeCompare(right.item.name, undefined, { sensitivity: 'base' });
            if (nameComparison !== 0) {
                return nameComparison;
            }
            const providerComparison = left.item.provider.localeCompare(right.item.provider);
            if (providerComparison !== 0) {
                return providerComparison;
            }
            const idComparison = left.item.id.localeCompare(right.item.id);
            if (idComparison !== 0) {
                return idComparison;
            }
            return left.order - right.order;
        });
        return sorted.map(entry => entry.item);
    }

    private normalizeModelId(
        model: z.infer<typeof remoteModelRecordSchema>,
        provider: MarketplaceModel['provider']
    ): string {
        // Hugging Face repo IDs are case-sensitive and require slashes.
        // We attempt to extract the original repo ID from URLs to avoid hyphenated/corrupted IDs.
        if (provider === 'huggingface') {
            const urls = [model.sourceUrl, model.downloadUrl, model.id, model.slug]
                .filter((v): v is string => typeof v === 'string' && v.length > 0);

            for (const url of urls) {
                if (url.includes('huggingface.co/')) {
                    const match = url.match(/huggingface\.co\/([^/]+\/[^/]+)/);
                    if (match) {
                        return this.fitToLength(match[1], 128);
                    }
                }
                if (url.includes('/')) {
                    return this.fitToLength(url.trim(), 128);
                }
            }

            const candidate = this.cleanOptionalText(model.slug) ?? this.cleanOptionalText(model.id);
            if (candidate) {
                // If it starts with hf- and has no slash, it's likely a corrupted ID from an old registry
                let san = candidate;
                if (san.startsWith('hf-')) { san = san.substring(3); }
                return this.fitToLength(san, 128);
            }
        }

        const candidate = this.cleanOptionalText(model.slug)
            ?? this.cleanOptionalText(model.id)
            ?? `${provider}-model`;

        const safe = candidate
            .toLowerCase()
            .replace(/[^a-z0-9._-]+/g, '-')
            .replace(/-{2,}/g, '-')
            .replace(/^-|-$/g, '');
        return this.fitToLength(safe.length > 0 ? safe : `${provider}-model`, 128);
    }

    private normalizeModelName(
        model: z.infer<typeof remoteModelRecordSchema>,
        fallbackId: string
    ): string {
        const name = this.cleanOptionalText(model.name) ?? fallbackId;
        return this.fitToLength(name, 128);
    }

    private normalizeModelDescription(
        model: z.infer<typeof remoteModelRecordSchema>,
        provider: MarketplaceModel['provider']
    ): string {
        const description = this.cleanOptionalText(model.description) ?? `Model provided via ${provider}.`;
        return this.fitToLength(description, 280);
    }

    private normalizeModelAuthor(
        model: z.infer<typeof remoteModelRecordSchema>,
        provider: MarketplaceModel['provider']
    ): string {
        const author = this.cleanOptionalText(model.author) ?? this.getDefaultModelAuthor(provider);
        return this.fitToLength(author, 128);
    }

    private normalizeModelVersion(model: z.infer<typeof remoteModelRecordSchema>): string {
        const version = this.cleanOptionalText(model.version) ?? 'latest';
        return this.fitToLength(version, 32);
    }

    private cleanOptionalText(value: string | undefined): string | undefined {
        if (typeof value !== 'string') {
            return undefined;
        }
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }

    private normalizeRegistryBeforeValidation(rawRegistry: RuntimeValue): MarketplaceRegistry {
        const registryRecord = rawRegistry && typeof rawRegistry === 'object' && !Array.isArray(rawRegistry)
            ? (rawRegistry as Record<string, RuntimeValue>)
            : {};

        const normalizedModels = Array.isArray(registryRecord.models)
            ? registryRecord.models.map((rawModel): RuntimeValue => {
                if (!rawModel || typeof rawModel !== 'object' || Array.isArray(rawModel)) {
                    return rawModel;
                }
                const modelRecord = { ...(rawModel as Record<string, RuntimeValue>) };
                if (typeof modelRecord.pipelineTag === 'string' && modelRecord.pipelineTag.trim().length === 0) {
                    delete modelRecord.pipelineTag;
                }
                return modelRecord;
            })
            : undefined;

        const parsed = marketplaceRegistrySchema.safeParse({
            ...registryRecord,
            ...(normalizedModels ? { models: normalizedModels } : {}),
        });
        if (!parsed.success) {
            appLogger.warn('MarketplaceService', 'Registry validation issues encountered; continuing with filtered models', {
                issues: parsed.error.issues.slice(0, 10).map(issue => issue.path.join('.')),
            });
            const withoutModelsParse = marketplaceRegistrySchema.safeParse({
                ...registryRecord,
                models: [],
            });
            if (withoutModelsParse.success) {
                return withoutModelsParse.data;
            }
            throw parsed.error;
        }
        return parsed.data;
    }

    private fitToLength(value: string, maxLength: number): string {
        return value.length <= maxLength ? value : value.slice(0, maxLength);
    }

    private cleanOptionalUrl(value: string | undefined): string | undefined {
        const cleaned = this.cleanOptionalText(value);
        if (!cleaned) {
            return undefined;
        }
        try {
            const parsed = new URL(cleaned);
            return parsed.toString();
        } catch {
            return undefined;
        }
    }

    private getDefaultModelAuthor(provider: MarketplaceModel['provider']): string {
        if (provider === 'ollama') {
            return 'Ollama';
        }
        if (provider === 'huggingface') {
            return 'Hugging Face';
        }
        return 'Custom';
    }

    private sanitizeFileNameStem(id: string): string {
        const sanitized = id
            .toLowerCase()
            .replace(/[^a-z0-9._-]+/g, '-')
            .replace(/-{2,}/g, '-')
            .replace(/^-|-$/g, '');
        const normalized = sanitized.length > 0 ? sanitized : 'item';
        return this.fitToLength(normalized, 120);
    }

    private buildSafeModelInstallPayload(item: MarketplaceItem): MarketplaceModel {
        const modelItem = item as Partial<MarketplaceModel>;
        const provider = modelItem.provider ?? 'custom';
        const sourceUrl = this.cleanOptionalUrl(modelItem.sourceUrl);
        const downloadUrl = this.cleanOptionalUrl(item.downloadUrl);
        if (!downloadUrl) {
            throw new Error(`Invalid model download URL for ${item.id}`);
        }
        return {
            id: this.fitToLength(item.id.trim(), 128),
            name: this.fitToLength(item.name.trim(), 128),
            description: this.fitToLength(item.description.trim(), 280),
            author: this.fitToLength(item.author.trim(), 128),
            version: this.fitToLength(item.version.trim(), 32),
            downloadUrl,
            itemType: 'model',
            provider,
            source: modelItem.source,
            sourceUrl,
            category: this.cleanOptionalText(modelItem.category)?.slice(0, 64),
            pipelineTag: this.cleanOptionalText(modelItem.pipelineTag)?.slice(0, 64),
            submodels: modelItem.submodels?.map(submodel => ({
                id: this.fitToLength(submodel.id.trim(), 128),
                name: this.fitToLength(submodel.name.trim(), 128),
                size: this.cleanOptionalText(submodel.size)?.slice(0, 32),
                contextWindow: this.cleanOptionalText(submodel.contextWindow)?.slice(0, 32),
                inputType: this.cleanOptionalText(submodel.inputType)?.slice(0, 64),
                modelSize: this.cleanOptionalText(submodel.modelSize)?.slice(0, 32),
                tensorType: this.cleanOptionalText(submodel.tensorType)?.slice(0, 32),
                downloadUrl: this.cleanOptionalUrl(submodel.downloadUrl),
                installed: submodel.installed,
            })),
            installed: item.installed,
            installedVersion: item.installedVersion,
        };
    }

    private async queueModelDownload(model: MarketplaceModel): Promise<{ queuedDownloads: number; downloadIds: string[] }> {
        if (!this.modelDownloaderService) {
            return { queuedDownloads: 0, downloadIds: [] };
        }

        if (model.provider === 'ollama') {
            const modelName = this.resolveOllamaModelName(model);
            const result = this.modelDownloaderService.startDownload({
                provider: 'ollama',
                modelName,
                tag: 'latest',
            });
            return this.collectDownloadResults([result]);
        }

        if (model.provider === 'huggingface') {
            const modelId = this.resolveHuggingFaceModelId(model);
            if (!modelId || !this.huggingFaceService) {
                appLogger.warn('MarketplaceService', `Unable to resolve HuggingFace model id for ${model.id}`);
                return { queuedDownloads: 0, downloadIds: [] };
            }
            const files = await this.huggingFaceService.getModelFiles(modelId);
            const ggufFiles = files
                .filter(file => file.path.toLowerCase().endsWith('.gguf'))
                .sort((left, right) => left.path.localeCompare(right.path))
                .filter(file => Boolean(file.oid));

            const selectedFile = this.selectHuggingFaceDownloadFile(model, ggufFiles);
            if (!selectedFile) {
                appLogger.warn('MarketplaceService', `No downloadable GGUF file with checksum found for ${modelId}`);
                return { queuedDownloads: 0, downloadIds: [] };
            }

            const results: ModelDownloadResult[] = [this.modelDownloaderService.startDownload({
                provider: 'huggingface',
                modelId,
                file: {
                    path: selectedFile.path,
                    size: selectedFile.size,
                    oid: selectedFile.oid,
                    quantization: selectedFile.quantization,
                },
            })];
            return this.collectDownloadResults(results);
        }

        return { queuedDownloads: 0, downloadIds: [] };
    }

    private collectDownloadResults(results: ModelDownloadResult[]): { queuedDownloads: number; downloadIds: string[] } {
        const downloadIds: string[] = [];
        for (const result of results) {
            if (result.success && result.downloadId) {
                downloadIds.push(result.downloadId);
            }
        }
        return {
            queuedDownloads: downloadIds.length,
            downloadIds,
        };
    }

    private selectHuggingFaceDownloadFile(
        model: MarketplaceModel,
        files: { path: string; size: number; oid?: string; quantization: string }[]
    ): { path: string; size: number; oid: string; quantization: string } | null {
        if (files.length === 0) {
            return null;
        }
        const desiredQuantization = this.extractQuantizationHint(model.pipelineTag ?? '') ?? 'Q4_K_M';
        const quantizationPriority = ['Q4_K_M', 'Q5_K_M', 'Q6_K', 'Q8_0', 'F16'];
        const desiredIndex = quantizationPriority.indexOf(desiredQuantization);
        const normalizedDesiredIndex = desiredIndex >= 0 ? desiredIndex : 0;
        const ranked = [...files].sort((left, right) => {
            const leftQuant = left.quantization.toUpperCase();
            const rightQuant = right.quantization.toUpperCase();
            const leftIndex = this.getQuantizationPriorityIndex(leftQuant, quantizationPriority, normalizedDesiredIndex);
            const rightIndex = this.getQuantizationPriorityIndex(rightQuant, quantizationPriority, normalizedDesiredIndex);
            if (leftIndex !== rightIndex) {
                return leftIndex - rightIndex;
            }
            if (left.size !== right.size) {
                return left.size - right.size;
            }
            return left.path.localeCompare(right.path);
        });
        return ranked[0] ? {
            path: ranked[0].path,
            size: ranked[0].size,
            oid: ranked[0].oid ?? '',
            quantization: ranked[0].quantization,
        } : null;
    }

    private extractQuantizationHint(value: string): string | null {
        const match = value.toUpperCase().match(/Q[0-9]_[A-Z0-9_]+|F16|F32/);
        return match ? match[0] : null;
    }

    private getQuantizationPriorityIndex(value: string, priority: string[], desiredIndex: number): number {
        const index = priority.indexOf(value);
        if (index >= 0) {
            return Math.abs(index - desiredIndex);
        }
        return priority.length + 1;
    }

    private buildSystemProfile(
        systemInfo: Awaited<ReturnType<SystemService['getSystemInfo']>> | null,
        storageStats: Awaited<ReturnType<SystemService['getStorageStats']>> | null,
        usageStats: Awaited<ReturnType<SystemService['getUsage']>> | null
    ): MarketplaceRuntimeProfile['system'] {
        const totalMemoryBytes = systemInfo?.totalMemory ?? 0;
        const freeMemoryBytes = systemInfo?.freeMemory ?? 0;
        const storage = storageStats?.success ? storageStats.data : undefined;
        const cpuLoadPercent = usageStats?.success && systemInfo
            ? Math.max(0, Math.min(100, (usageStats.result?.cpu ?? 0) / Math.max(1, systemInfo.cpus) * 100))
            : 0;
        return {
            platform: systemInfo?.platform ?? process.platform,
            arch: systemInfo?.arch ?? process.arch,
            cpuCores: systemInfo?.cpus ?? 1,
            cpuLoadPercent,
            totalMemoryBytes,
            freeMemoryBytes,
            storageTotalBytes: storage?.total ?? 0,
            storageFreeBytes: storage?.free ?? 0,
            storageUsedBytes: storage?.used ?? 0,
            storageUsagePercent: storage?.percent ?? 0,
        };
    }

    private buildGpuProfile(
        electronGpu: Awaited<ReturnType<SystemService['getGpuInfo']>> | null,
        llamaGpu: Awaited<ReturnType<LlamaService['getGpuInfo']>> | null,
        ollamaGpu: Awaited<ReturnType<OllamaService['getGPUInfo']>> | null
    ): MarketplaceRuntimeProfile['gpu'] {
        const electronData = electronGpu?.success ? electronGpu.data : undefined;
        if (electronData?.devices.length) {
            return {
                available: true,
                source: 'electron',
                name: electronData.name,
                backends: electronData.backends,
                devices: electronData.devices,
                totalVramBytes: electronData.totalVramBytes,
                totalVramUsedBytes: electronData.totalVramUsedBytes,
                vramBytes: electronData.totalVramBytes,
                vramUsedBytes: electronData.totalVramUsedBytes,
            };
        }
        const backends = new Set<string>();
        if (llamaGpu?.available) {
            for (const backend of llamaGpu.backends) {
                backends.add(backend);
            }
        }
        const activeOllamaGpu = ollamaGpu?.available ? ollamaGpu.gpus[0] : undefined;
        const name = llamaGpu?.name ?? activeOllamaGpu?.name;
        const available = Boolean(llamaGpu?.available || ollamaGpu?.available);
        if (!available) {
            return { available: false, source: 'none', backends: [], devices: [] };
        }
        if (activeOllamaGpu) {
            backends.add('ollama');
        }
        return {
            available: true,
            source: llamaGpu?.available && ollamaGpu?.available ? 'combined' : (llamaGpu?.available ? 'llama' : 'ollama'),
            name,
            backends: Array.from(backends),
            devices: [],
            vramBytes: activeOllamaGpu?.memoryTotal,
            vramUsedBytes: activeOllamaGpu?.memoryUsed,
            totalVramBytes: activeOllamaGpu?.memoryTotal,
            totalVramUsedBytes: activeOllamaGpu?.memoryUsed,
        };
    }

    private buildPerformanceProfile(): MarketplaceRuntimeProfile['performance'] {
        return {
            rssBytes: 0,
            heapUsedBytes: 0,
            processCount: 0,
            alertCount: 0,
        };
    }

    private async getSystemInfoSafe(): Promise<Awaited<ReturnType<SystemService['getSystemInfo']>> | null> {
        if (!this.systemService) {
            return null;
        }
        try {
            return await this.systemService.getSystemInfo();
        } catch (error) {
            appLogger.warn('MarketplaceService', 'Failed to read system info for runtime profile', error as Error);
            return null;
        }
    }

    private async getStorageStatsSafe(): Promise<Awaited<ReturnType<SystemService['getStorageStats']>> | null> {
        if (!this.systemService) {
            return null;
        }
        try {
            return await this.systemService.getStorageStats(this.USER_MODELS_PATH);
        } catch (error) {
            appLogger.warn('MarketplaceService', 'Failed to read storage stats for runtime profile', error as Error);
            return null;
        }
    }

    private async getGpuInfoSafe(): Promise<Awaited<ReturnType<SystemService['getGpuInfo']>> | null> {
        if (!this.systemService) {
            return null;
        }
        try {
            return await this.systemService.getGpuInfo();
        } catch (error) {
            appLogger.warn('MarketplaceService', 'Failed to read GPU info for runtime profile', error as Error);
            return null;
        }
    }

    private async getUsageStatsSafe(): Promise<Awaited<ReturnType<SystemService['getUsage']>> | null> {
        if (!this.systemService) {
            return null;
        }
        try {
            return await this.systemService.getUsage();
        } catch (error) {
            appLogger.warn('MarketplaceService', 'Failed to read usage stats for runtime profile', error as Error);
            return null;
        }
    }

    private async getLlamaGpuSafe(): Promise<Awaited<ReturnType<LlamaService['getGpuInfo']>> | null> {
        if (!this.llamaService) {
            return null;
        }
        try {
            return await this.llamaService.getGpuInfo();
        } catch (error) {
            appLogger.warn('MarketplaceService', 'Failed to read llama GPU info for runtime profile', error as Error);
            return null;
        }
    }

    private async getOllamaGpuSafe(): Promise<Awaited<ReturnType<OllamaService['getGPUInfo']>> | null> {
        if (!this.ollamaService) {
            return null;
        }
        try {
            return await this.ollamaService.getGPUInfo();
        } catch (error) {
            appLogger.warn('MarketplaceService', 'Failed to read ollama GPU info for runtime profile', error as Error);
            return null;
        }
    }

    private resolveOllamaModelName(model: MarketplaceModel): string {
        const source = this.cleanOptionalUrl(model.sourceUrl) ?? this.cleanOptionalUrl(model.downloadUrl);
        if (source) {
            try {
                const parsed = new URL(source);
                const segments = parsed.pathname.split('/').filter(Boolean);
                const libraryIndex = segments.findIndex(segment => segment.toLowerCase() === 'library');
                if (libraryIndex >= 0 && segments[libraryIndex + 1]) {
                    return decodeURIComponent(segments[libraryIndex + 1]);
                }
                if (segments.length > 0) {
                    return decodeURIComponent(segments[segments.length - 1]);
                }
            } catch {
                // ignore URL parsing failures and fallback to id/name
            }
        }
        const candidate = this.cleanOptionalText(model.id) ?? this.cleanOptionalText(model.name) ?? 'llama3';
        return candidate;
    }

    private resolveHuggingFaceModelId(model: MarketplaceModel): string | null {
        const source = this.cleanOptionalUrl(model.sourceUrl) ?? this.cleanOptionalUrl(model.downloadUrl);
        if (source) {
            try {
                const parsed = new URL(source);
                if (!parsed.hostname.toLowerCase().includes('huggingface.co')) {
                    return null;
                }
                const segments = parsed.pathname.split('/').filter(Boolean);
                if (segments.length >= 2) {
                    return `${decodeURIComponent(segments[0])}/${decodeURIComponent(segments[1])}`;
                }
            } catch {
                // ignore and fallback
            }
        }
        const candidate = this.cleanOptionalText(model.id);
        if (!candidate) {
            return null;
        }

        let san = candidate;
        if (san.startsWith('hf-')) {
            san = san.substring(3);
        }

        if (!san.includes('/')) {
            return null;
        }
        return san;
    }

    private classifyInstallError(error: Error | z.ZodError | RuntimeValue): { code: string; message: string } {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 404) {
                return { code: 'NOT_FOUND', message: 'Marketplace item source was not found.' };
            }
            if (error.code === 'ECONNABORTED') {
                return { code: 'TIMEOUT', message: 'Marketplace request timed out.' };
            }
            return { code: 'NETWORK', message: 'Marketplace network request failed.' };
        }
        if (error instanceof z.ZodError) {
            return { code: 'INVALID_PACKAGE', message: 'Marketplace package format is invalid.' };
        }
        if (error instanceof Error && error.message.toLowerCase().includes('eacces')) {
            return { code: 'PERMISSION', message: 'No permission to write marketplace files.' };
        }
        if (error instanceof Error && error.message.toLowerCase().includes('enospc')) {
            return { code: 'NO_SPACE', message: 'Insufficient disk space for installation.' };
        }
        return { code: 'INSTALL_FAILED', message: 'Marketplace installation failed.' };
    }

    private async filterUnavailableLanguagePacks(registry: MarketplaceRegistry): Promise<MarketplaceRegistry> {
        const languages = registry.languages ?? [];
        if (languages.length === 0) {
            return registry;
        }

        const checks = await Promise.all(languages.map(async language => ({
            language,
            available: await this.isMarketplaceSourceAvailable(language.downloadUrl),
        })));

        const availableLanguages = checks
            .filter(check => check.available)
            .map(check => check.language);

        for (const check of checks) {
            if (!check.available) {
                appLogger.warn(
                    'MarketplaceService',
                    `Skipping unavailable language pack from registry: ${check.language.id}`,
                    { downloadUrl: check.language.downloadUrl }
                );
            }
        }

        return {
            ...registry,
            languages: availableLanguages,
        };
    }

    private async isMarketplaceSourceAvailable(downloadUrl: string): Promise<boolean> {
        try {
            await axios.head(downloadUrl, { timeout: 4000 });
            return true;
        } catch (error) {
            if (axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 410)) {
                return false;
            }
            return true;
        }
    }

    private async applyInstalledState(registry: MarketplaceRegistry): Promise<MarketplaceRegistry> {
        const [installedVersions, ollamaModels] = await Promise.all([
            this.readInstalledVersions(),
            this.ollamaService?.getModels() ?? Promise.resolve([]),
        ]);

        const ollamaModelNames = new Set(ollamaModels.map(m => m.name.toLowerCase()));
        const hfInstalledIds = this.huggingFaceService ? await this.huggingFaceService.getInstalledModelIds() : new Set<string>();

        const annotatedModels = (registry.models ?? []).map(model => {
            const isInstalled = installedVersions.model.has(model.id);
            const installedVersion = installedVersions.model.get(model.id);
            const ollamaName = this.resolveOllamaModelName(model).toLowerCase();

            // Also check submodels
            const annotatedSubmodels = model.submodels?.map(sub => {
                const subName = sub.id?.includes(':') ? sub.id.split(':')[1] : sub.name;
                const fullOllamaName = `${ollamaName}:${subName}`.toLowerCase();
                const isSubInstalled = ollamaModelNames.has(fullOllamaName) || ollamaModelNames.has(ollamaName);
                return {
                    ...sub,
                    installed: isSubInstalled,
                };
            });

            // Treat as installed if we have local metadata OR if it's in Ollama's local list
            // OR if ANY submodel is installed (New request)
            const anySubInstalled = annotatedSubmodels?.some(sub => sub.installed) ?? false;
            const finalInstalled = isInstalled ||
                (model.provider === 'ollama' && (ollamaModelNames.has(ollamaName) || anySubInstalled)) ||
                (model.provider === 'huggingface' && hfInstalledIds.has(model.id));

            return {
                ...model,
                installed: finalInstalled,
                installedVersion,
                updateAvailable: isInstalled && installedVersion ? this.isNewerVersion(installedVersion, model.version) : false,
                submodels: annotatedSubmodels,
            };
        });

        return {
            ...registry,
            themes: this.annotateInstalledItems(registry.themes, installedVersions.theme),
            mcp: this.annotateInstalledItems(registry.mcp, installedVersions.mcp),
            models: annotatedModels,
            prompts: this.annotateInstalledItems(registry.prompts ?? [], installedVersions.prompt),
            languages: this.annotateInstalledItems(registry.languages ?? [], installedVersions.language),
            skills: this.annotateInstalledItems(registry.skills ?? [], installedVersions.skill),
            extensions: this.annotateInstalledItems(registry.extensions ?? [], installedVersions.extension),
            iconPacks: this.annotateInstalledItems(registry.iconPacks ?? [], installedVersions['icon-pack']),
        };
    }

    private annotateInstalledItems<T extends MarketplaceItem>(
        items: T[],
        installedById: Map<string, string>
    ): T[] {
        return items.map(item => {
            const installedVersion =
                installedById.get(item.id) ?? installedById.get(item.id.toLowerCase());

            const isInstalled = typeof installedVersion === 'string';
            const hasUpdate = (isInstalled && this.isNewerVersion(installedVersion, item.version)) || this.liveUpdates.has(item.id);

            return {
                ...item,
                installed: isInstalled,
                installedVersion,
                updateAvailable: hasUpdate,
            };
        });
    }

    private isNewerVersion(current: string, latest: string): boolean {
        try {
            const cur = current.split('.').map(Number);
            const lat = latest.split('.').map(Number);
            for (let i = 0; i < Math.max(cur.length, lat.length); i++) {
                const c = cur[i] || 0;
                const l = lat[i] || 0;
                if (l > c) { return true; }
                if (l < c) { return false; }
            }
        } catch (e) {
            // Fallback to simple string comparison if split fails
            appLogger.error('MarketplaceService', `Failed to compare versions ${current} and ${latest}`, e as Error);
            return current !== latest;
        }
        return false;
    }

    private async readInstalledVersions(): Promise<Record<MarketplaceItem['itemType'], Map<string, string>>> {
        const localeVersions = this.localeService
            ? await this.readLocaleVersions()
            : new Map<string, string>();

        return {
            theme: await this.readVersionsFromDirectory(this.USER_THEMES_PATH, '.theme.json'),
            mcp: this.readInstalledMcpVersionsFromSettings(),
            model: await this.readVersionsFromDirectory(this.USER_MODELS_PATH, '.model.json'),
            prompt: await this.readVersionsFromDirectory(this.USER_PROMPTS_PATH, '.prompt.json'),
            language: localeVersions,
            skill: await this.readVersionsFromDirectory(this.USER_SKILLS_PATH, '.skill.json'),
            'icon-pack': await this.readVersionsFromDirectory(this.USER_ICON_PACKS_PATH, '.icon-pack.json'),
            extension: await this.readInstalledExtensionVersions(),
            'code-language-pack': await this.readVersionsFromDirectory(this.USER_CODE_LANGUAGES_PATH, '.language-pack.json'),
        };
    }

    private readInstalledMcpVersionsFromSettings(): Map<string, string> {
        const versions = new Map<string, string>();
        const userServers = this.settingsService?.getSettings().mcpUserServers ?? [];

        for (const server of userServers) {
            const serverVersion =
                typeof server.version === 'string' && server.version.trim().length > 0
                    ? server.version.trim()
                    : '0.0.0';
            const candidateIds = [server.id, server.name]
                .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
                .map(value => value.trim());

            for (const candidateId of candidateIds) {
                versions.set(candidateId, serverVersion);
                versions.set(candidateId.toLowerCase(), serverVersion);
            }
        }

        return versions;
    }

    private async readInstalledExtensionVersions(): Promise<Map<string, string>> {
        const versions = new Map<string, string>();
        const installedDirectories = await fs.readdir(this.USER_EXTENSIONS_PATH);

        for (const directoryName of installedDirectories) {
            const extPath = path.join(this.USER_EXTENSIONS_PATH, directoryName);
            const markerPath = path.join(extPath, '.uninstalled');

            // Skip folders marked as uninstalled (Windows file lock fallback)
            if (await fs.pathExists(markerPath)) {
                continue;
            }

            const packageJsonPath = path.join(extPath, 'package.json');
            if (!(await fs.pathExists(packageJsonPath))) {
                continue;
            }

            try {
                const packageJson = await fs.readJson(packageJsonPath) as MarketplaceExtensionPackageJson;
                const version = typeof packageJson.version === 'string' && packageJson.version.trim().length > 0
                    ? packageJson.version.trim()
                    : '0.0.0';
                const candidateIds = [
                    packageJson.tengra?.id,
                    packageJson.manifest?.id,
                    packageJson.id,
                    packageJson.name,
                    directoryName,
                ]
                    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
                    .map(value => value.trim());

                for (const candidateId of candidateIds) {
                    versions.set(candidateId, version);
                    versions.set(candidateId.toLowerCase(), version);
                }
            } catch (error) {
                appLogger.warn('MarketplaceService', `Failed to inspect installed extension package: ${packageJsonPath}`, {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        return versions;
    }

    private async readLocaleVersions(): Promise<Map<string, string>> {
        if (!this.localeService) {
            return new Map<string, string>();
        }

        const localePacks = await this.localeService.getAllLocalePacks();
        const versions = new Map<string, string>();
        for (const localePack of localePacks) {
            versions.set(localePack.id, localePack.version);
        }
        return versions;
    }

    private async readVersionsFromDirectory(directory: string, suffix: string): Promise<Map<string, string>> {
        const versions = new Map<string, string>();
        const files = await fs.readdir(directory);

        for (const fileName of files) {
            if (!fileName.endsWith(suffix)) {
                continue;
            }

            const filePath = path.join(directory, fileName);
            try {
                const content = await fs.readJson(filePath) as Partial<MarketplaceItem>;
                const id = typeof content.id === 'string' ? content.id : fileName.slice(0, -suffix.length);
                const version = typeof content.version === 'string' ? content.version : '0.0.0';
                versions.set(id, version);
            } catch (error) {
                appLogger.warn('MarketplaceService', `Failed to inspect installed marketplace item: ${fileName}`, {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        return versions;
    }

    private async ensureExtensionEntrypoint(extensionPath: string): Promise<void> {
        const packageJsonPath = path.join(extensionPath, 'package.json');
        if (!(await fs.pathExists(packageJsonPath))) {
            throw new Error(`Extension package.json not found: ${packageJsonPath}`);
        }

        const packageJson = await fs.readJson(packageJsonPath) as MarketplaceExtensionPackageJson;
        const entrypointRelativePath = this.resolveExtensionEntrypointRelativePath(packageJson);
        if (!entrypointRelativePath) {
            throw new Error('Extension main entrypoint is missing from package metadata.');
        }

        const entrypointPath = path.join(extensionPath, entrypointRelativePath);
        if (await fs.pathExists(entrypointPath)) {
            return;
        }

        appLogger.warn('MarketplaceService', `Extension entrypoint missing (${entrypointRelativePath}), attempting local build.`, {
            extensionPath,
        });
        const buildScript = packageJson.scripts?.build;
        if (typeof buildScript !== 'string' || buildScript.trim().length === 0) {
            throw new Error(`Extension entrypoint "${entrypointRelativePath}" is missing and no build script is defined.`);
        }

        const packageManager = await this.resolveExtensionPackageManager(extensionPath, packageJson);
        await this.ensureExtensionDependencies(extensionPath, packageManager);
        try {
            await this.runExtensionShellCommand(this.getExtensionBuildCommand(packageManager), extensionPath);
        } catch (error) {
            if (await fs.pathExists(entrypointPath)) {
                appLogger.warn('MarketplaceService', 'Extension build reported errors but entrypoint was generated; continuing install.', {
                    extensionPath,
                    entrypointRelativePath,
                });
                return;
            }
            const fallbackCompiled = await this.tryCompileExtensionEntrypointFallback(
                extensionPath,
                entrypointRelativePath
            );
            if (fallbackCompiled) {
                appLogger.warn('MarketplaceService', 'Extension entrypoint generated via fallback compile despite build failure.', {
                    extensionPath,
                    entrypointRelativePath,
                });
                return;
            }
            throw this.createExtensionBuildFailureError(error as Error);
        }

        if (!(await fs.pathExists(entrypointPath))) {
            throw new Error(`Extension build finished but entrypoint is still missing: ${entrypointRelativePath}`);
        }
    }

    private resolveExtensionEntrypointRelativePath(packageJson: MarketplaceExtensionPackageJson): string | null {
        const candidate =
            packageJson.tengra?.main
            ?? packageJson.manifest?.main
            ?? packageJson.main;
        if (typeof candidate !== 'string') {
            return null;
        }
        const normalizedCandidate = candidate.trim();
        return normalizedCandidate.length > 0 ? normalizedCandidate : null;
    }

    private async tryCompileExtensionEntrypointFallback(
        extensionPath: string,
        entrypointRelativePath: string
    ): Promise<boolean> {
        const sourceEntrypointPath = await this.resolveExtensionSourceEntrypointPath(
            extensionPath,
            entrypointRelativePath
        );
        if (!sourceEntrypointPath) {
            return false;
        }

        const relativeSourceEntrypointPath = path.relative(extensionPath, sourceEntrypointPath);
        const entrypointDirectory = path.dirname(entrypointRelativePath);
        const normalizedOutDir = entrypointDirectory === '.' ? 'dist' : entrypointDirectory;
        try {
            await this.runExtensionShellCommand(
                `npx tsc "${relativeSourceEntrypointPath}" --outDir "${normalizedOutDir}" --module CommonJS --target ES2020 --esModuleInterop --skipLibCheck --noEmitOnError false`,
                extensionPath
            );
        } catch {
            // tsc can still emit output with diagnostics when noEmitOnError=false
        }

        return fs.pathExists(path.join(extensionPath, entrypointRelativePath));
    }

    private async resolveExtensionSourceEntrypointPath(
        extensionPath: string,
        entrypointRelativePath: string
    ): Promise<string | null> {
        const normalizedEntrypoint = entrypointRelativePath.replace(/\\/g, '/');
        const candidateRelativePaths = new Set<string>([
            normalizedEntrypoint.replace(/\.js$/i, '.ts'),
            normalizedEntrypoint.replace(/\.js$/i, '.tsx'),
        ]);
        if (normalizedEntrypoint.startsWith('dist/')) {
            const sourceRelative = `src/${normalizedEntrypoint.slice('dist/'.length)}`;
            candidateRelativePaths.add(sourceRelative.replace(/\.js$/i, '.ts'));
            candidateRelativePaths.add(sourceRelative.replace(/\.js$/i, '.tsx'));
        }

        for (const candidateRelativePath of candidateRelativePaths) {
            const candidateAbsolutePath = path.join(extensionPath, candidateRelativePath);
            if (await fs.pathExists(candidateAbsolutePath)) {
                return candidateAbsolutePath;
            }
        }
        return null;
    }

    private async ensureExtensionDependencies(
        extensionPath: string,
        packageManager: ExtensionPackageManager
    ): Promise<void> {
        const nodeModulesPath = path.join(extensionPath, 'node_modules');
        if (await fs.pathExists(nodeModulesPath)) {
            return;
        }
        await this.runExtensionShellCommand(this.getExtensionInstallCommand(packageManager), extensionPath);
    }

    private async resolveExtensionPackageManager(
        extensionPath: string,
        packageJson: MarketplaceExtensionPackageJson
    ): Promise<ExtensionPackageManager> {
        const packageManagerField =
            typeof packageJson.packageManager === 'string'
                ? packageJson.packageManager.toLowerCase()
                : '';

        if (packageManagerField.startsWith('pnpm@')) {
            return 'pnpm';
        }
        if (packageManagerField.startsWith('yarn@')) {
            return 'yarn';
        }
        if (packageManagerField.startsWith('bun@')) {
            return 'bun';
        }
        if (await fs.pathExists(path.join(extensionPath, 'pnpm-lock.yaml'))) {
            return 'pnpm';
        }
        if (await fs.pathExists(path.join(extensionPath, 'yarn.lock'))) {
            return 'yarn';
        }
        if (await fs.pathExists(path.join(extensionPath, 'bun.lockb'))) {
            return 'bun';
        }
        return 'npm';
    }

    private getExtensionInstallCommand(packageManager: ExtensionPackageManager): string {
        switch (packageManager) {
            case 'pnpm':
                return 'pnpm install';
            case 'yarn':
                return 'yarn install';
            case 'bun':
                return 'bun install';
            default:
                return 'npm install --no-audit --no-fund';
        }
    }

    private getExtensionBuildCommand(packageManager: ExtensionPackageManager): string {
        switch (packageManager) {
            case 'pnpm':
                return 'pnpm run build';
            case 'yarn':
                return 'yarn run build';
            case 'bun':
                return 'bun run build';
            default:
                return 'npm run build';
        }
    }

    private async runExtensionShellCommand(command: string, workingDirectory: string): Promise<void> {
        appLogger.info('MarketplaceService', `Running extension command: ${command}`, {
            workingDirectory,
        });
        try {
            await execAsync(command, { cwd: workingDirectory, windowsHide: true });
        } catch (error) {
            const commandError = error as Error & { stdout?: string; stderr?: string };
            const detailedMessage = commandError.stderr?.trim()
                || commandError.stdout?.trim()
                || commandError.message;
            throw new Error(`Extension command failed (${command}): ${detailedMessage}`);
        }
    }

    private createExtensionBuildFailureError(error: Error): Error {
        const originalMessage = error.message;
        const hasModuleResolutionFailure =
            originalMessage.includes("Cannot find module '@main/")
            || originalMessage.includes("Cannot find module '@shared/")
            || originalMessage.includes("Cannot find module 'react'")
            || originalMessage.includes("Cannot find module 'lucide-react'")
            || originalMessage.includes("Cannot find module '@tabler/icons-react'");
        const hasJsxConfigurationFailure =
            originalMessage.includes("Cannot use JSX unless the '--jsx' flag is provided");

        if (hasModuleResolutionFailure || hasJsxConfigurationFailure) {
            return new Error(
                'Extension build failed in an isolated marketplace environment. '
                + 'This extension currently depends on Tengra internal aliases (@main/@shared), '
                + 'or missing self-declared frontend dependencies/JSX config. '
                + 'Publish prebuilt dist assets or provide a self-contained build setup in the extension repository. '
                + `Original error: ${originalMessage}`
            );
        }

        return error;
    }

    private async cloneExtensionRepository(url: string, targetPath: string): Promise<void> {
        try {
            if (await fs.pathExists(targetPath)) {
                const gitDirectoryPath = path.join(targetPath, '.git');
                if (await fs.pathExists(gitDirectoryPath)) {
                    appLogger.info('MarketplaceService', `Extension directory ${targetPath} already exists, attempting pull...`);
                    try {
                        await execAsync('git pull --ff-only', { cwd: targetPath });
                        return;
                    } catch (pullError) {
                        appLogger.warn('MarketplaceService', `Git pull failed in ${targetPath}; reinstalling a clean copy.`, {
                            reason: pullError instanceof Error ? pullError.message : String(pullError),
                        });
                    }
                } else {
                    appLogger.warn('MarketplaceService', `Extension directory ${targetPath} is not a git repository, reinstalling clean copy.`);
                }
                await fs.remove(targetPath);
            }
            appLogger.info('MarketplaceService', `Cloning extension from ${url} into ${targetPath}`);
            await execAsync(`git clone "${url}" "${targetPath}"`);
        } catch (error) {
            appLogger.error('MarketplaceService', `Failed to clone extension repository: ${url}`, error as Error);
            throw new Error(`Git operations failed for extension: ${(error as Error).message}`);
        }
    }

    async fetchExtensionReadme(extensionId: string, repository?: string): Promise<string | null> {
        try {
            if (!repository) {
                const registry = await this.fetchRegistry();
                const extension = registry.extensions?.find(e => e.id === extensionId);
                repository = extension?.repository;
            }

            if (!repository?.includes('github.com')) {
                return null;
            }

            const baseUrl = repository.replace(/\.git$/, '');
            const rawBase = baseUrl.replace('github.com', 'raw.githubusercontent.com');
            const branches = ['main', 'master'];

            for (const branch of branches) {
                try {
                    const readmeUrl = `${rawBase}/${branch}/README.md`;
                    const response = await axios.get(readmeUrl, { timeout: 3000 });
                    if (response.data && typeof response.data === 'string') {
                        return response.data;
                    }
                } catch {
                    continue;
                }
            }
            return null;
        } catch (error) {
            appLogger.warn('MarketplaceService', `Failed to fetch readme for ${extensionId}`, error as Error);
            return null;
        }
    }
}


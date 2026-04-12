/**
 * Extension Service - Main process service for extension management
 * MKT-DEV-01: Extension SDK/templates/CLI
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

import { BaseService } from '@main/services/base.service';
import { SettingsService } from '@main/services/system/settings.service';
import {
    ConfigurationChangeEvent,
    ExtensionContext,
    ExtensionDevOptions,
    ExtensionManifest,
    ExtensionModule,
    ExtensionPermission,
    ExtensionProfileData,
    ExtensionPublishOptions,
    ExtensionPublishResult,
    ExtensionRuntimeInfo,
    ExtensionStatus,
    ExtensionTestOptions,
    ExtensionTestResult,
} from '@shared/types/extension';
import { createExtensionLogger, createExtensionState, validateManifest } from '@shared/utils/extension.util';
import { app, BrowserWindow, ipcMain } from 'electron';

/** Extension instance */
interface ExtensionInstance {
    manifest: ExtensionManifest;
    context: ExtensionRuntimeContext;
    status: ExtensionStatus;
    module: ExtensionModule | null;
    profileData: ExtensionProfileData;
}

/** Extension service state */
interface ExtensionServiceState {
    extensions: Map<string, ExtensionInstance>;
    watchers: Map<string, fs.FSWatcher>;
    extensionConfigs: Map<string, Record<string, RuntimeValue>>;
    configListeners: Map<string, Set<(event: ConfigurationChangeEvent) => void>>;
    mainWindow: BrowserWindow | null;
    extensionsPath: string;
}

interface ExtensionActionResult {
    success: boolean;
    error?: string;
    messageKey?: string;
    messageParams?: Record<string, string | number>;
}

interface ExtensionPackageJsonAuthor {
    name?: string;
    email?: string;
    url?: string;
}

interface ExtensionPackageJson {
    id?: string;
    name?: string;
    version?: string;
    description?: string;
    main?: string;
    license?: string;
    author?: string | ExtensionPackageJsonAuthor;
    tengra?: Partial<ExtensionManifest>;
    manifest?: Partial<ExtensionManifest>;
}

type ExtensionCommandHandler = (...args: RuntimeValue[]) => RuntimeValue | Promise<RuntimeValue>;

interface ExtensionCommandBridge {
    registerCommand(commandId: string, handler: ExtensionCommandHandler): { dispose: () => void };
    executeCommand<T extends RuntimeValue = RuntimeValue>(commandId: string, ...args: RuntimeValue[]): Promise<T>;
    listCommands(): string[];
}

interface ExtensionRuntimeContext extends ExtensionContext {
    commands: ExtensionCommandBridge;
}

const ALLOWED_PERMISSIONS: ReadonlySet<ExtensionPermission> = new Set([
    'filesystem',
    'network',
    'process',
    'clipboard',
    'notifications',
    'database',
    'git',
    'terminal',
    'ai',
]);
const MAX_EXTENSION_SCRIPT_BYTES = 1024 * 1024;
const EXTENSION_MESSAGE_KEY = {
    SANDBOX_SIZE_LIMIT: 'errors.extension.sandboxSizeLimit',
    PATH_NOT_ALLOWED: 'mainProcess.extensionService.pathNotAllowed',
    PACKAGE_JSON_NOT_FOUND: 'mainProcess.extensionService.packageJsonNotFound',
    NO_TENGRA_CONFIGURATION: 'mainProcess.extensionService.noTengraConfiguration',
    EXTENSION_NOT_FOUND: 'mainProcess.extensionService.extensionNotFound',
    ENTRY_POINT_OUTSIDE_ROOT: 'mainProcess.extensionService.entryPointOutsideRoot',
    ACTIVATE_FUNCTION_MISSING: 'mainProcess.extensionService.activateFunctionMissing'
} as const;
const EXTENSION_ERROR_MESSAGE = {
    PATH_NOT_ALLOWED: 'Extension path is not allowed',
    PACKAGE_JSON_NOT_FOUND: 'package.json not found',
    NO_TENGRA_CONFIGURATION: 'No tengra configuration found in package.json',
    EXTENSION_NOT_FOUND: 'Extension not found',
    ENTRY_POINT_OUTSIDE_ROOT: 'Extension entry point resolves outside extension root',
    ACTIVATE_FUNCTION_MISSING: 'Extension module must export an activate function'
} as const;
const EXTENSION_STATE_CHANNEL = 'extension:state-changed';
type ExtensionStateEvent =
    | 'installed'
    | 'updated'
    | 'uninstalled'
    | 'activated'
    | 'deactivated'
    | 'disabled'
    | 'activation-failed'
    | 'scan-completed';

/**
 * Extension Service
 * Manages extension lifecycle, development, and profiling
 */
export class ExtensionService extends BaseService {
    private state: ExtensionServiceState = {
        extensions: new Map(),
        watchers: new Map(),
        extensionConfigs: new Map(),
        configListeners: new Map(),
        mainWindow: null,
        extensionsPath: '',
    };

    constructor(private settingsService: SettingsService) {
        super('ExtensionService');
    }

    override async initialize(): Promise<void> {
        this.logInfo('Initializing Extension Service...');

        // Set up extensions directory
        const userDataPath = app.getPath('userData');
        this.state.extensionsPath = path.join(userDataPath, 'extensions');

        try {
            await fs.promises.access(this.state.extensionsPath, fs.constants.F_OK);
        } catch {
            await fs.promises.mkdir(this.state.extensionsPath, { recursive: true });
        }

        this.setupIpcHandlers();
        
        // Auto-scan extensions directory
        void this.scanExtensions();

        this.logInfo('Extension Service initialized successfully');
    }

    /** Scan extensions directory and install all found extensions */
    private async scanExtensions(): Promise<void> {
        if (!this.state.extensionsPath) {
            return;
        }

        try {
            const entries = await fs.promises.readdir(this.state.extensionsPath, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory() && !entry.isSymbolicLink()) {
                    continue;
                }

                const extPath = path.join(this.state.extensionsPath, entry.name);
                
                // Skip if marked as uninstalled (Windows file lock fallback)
                const markerPath = path.join(extPath, '.uninstalled');
                if (fs.existsSync(markerPath)) {
                    this.logInfo(`Skipping uninstalled extension folder: ${extPath}. Attempting cleanup...`);
                    try {
                        // Try again to delete it, maybe the lock is gone now.
                        await fs.promises.rm(extPath, { recursive: true, force: true });
                        this.logInfo(`Delayed cleanup successful for ${extPath}`);
                    } catch (cleanupErr) {
                        this.logWarn(`Delayed cleanup still failing for ${extPath}`);
                    }
                    continue;
                }

                const result = await this.installExtension(extPath);
                if (!result.success || !result.extensionId) {
                    continue;
                }

                await this.syncScannedExtensionState(result.extensionId);
            }
            this.emitStateChange('scan-completed');
        } catch (error) {
            this.logError('Failed to scan extensions directory', error as Error);
        }
    }

    private async syncScannedExtensionState(extensionId: string): Promise<void> {
        const settings = this.settingsService.getSettings();
        const isDisabled = settings.extensionDisabledServers?.includes(extensionId) ?? false;
        if (isDisabled) {
            const disabledInstance = this.state.extensions.get(extensionId);
            if (disabledInstance) {
                disabledInstance.status = 'disabled';
                this.emitStateChange('disabled', extensionId, 'disabled');
            }
            return;
        }

        const instance = this.state.extensions.get(extensionId);
        const shouldActivateOnStartup = instance?.manifest.activationEvents?.some(event => event.type === 'onStartup') ?? false;
        if (shouldActivateOnStartup) {
            await this.activateExtension(extensionId);
        }
    }

    override async cleanup(): Promise<void> {
        this.logInfo('Cleaning up Extension Service...');

        // Stop all watchers
        for (const [extensionId, watcher] of this.state.watchers) {
            watcher.close();
            this.state.watchers.delete(extensionId);
        }

        // Deactivate all extensions
        for (const [extensionId] of this.state.extensions) {
            try {
                await this.deactivateExtension(extensionId);
            } catch (error) {
                this.logError(`Failed to deactivate ${extensionId}`, error as Error);
            }
        }

        this.state.extensionConfigs.clear();
        this.state.configListeners.clear();

        this.removeIpcHandlers();
        this.logInfo('Extension Service cleaned up');
    }

    /** Set the main window reference */
    setMainWindow(window: BrowserWindow): void {
        this.state.mainWindow = window;
    }

    /** Setup IPC handlers */
    private setupIpcHandlers(): void {
        ipcMain.handle('extension:get-all', this.handleGetAll.bind(this));
        ipcMain.handle('extension:get', this.handleGet.bind(this));
        ipcMain.handle('extension:install', this.handleInstall.bind(this));
        ipcMain.handle('extension:uninstall', this.handleUninstall.bind(this));
        ipcMain.handle('extension:activate', this.handleActivate.bind(this));
        ipcMain.handle('extension:deactivate', this.handleDeactivate.bind(this));
        ipcMain.handle('extension:dev-start', this.handleDevStart.bind(this));
        ipcMain.handle('extension:dev-stop', this.handleDevStop.bind(this));
        ipcMain.handle('extension:dev-reload', this.handleDevReload.bind(this));
        ipcMain.handle('extension:test', this.handleTest.bind(this));
        ipcMain.handle('extension:publish', this.handlePublish.bind(this));
        ipcMain.handle('extension:get-profile', this.handleGetProfile.bind(this));
        ipcMain.handle('extension:validate', this.handleValidate.bind(this));
        ipcMain.handle('extension:get-state', this.handleGetState.bind(this));
        ipcMain.handle('extension:get-config', this.handleGetConfig.bind(this));
        ipcMain.handle('extension:update-config', this.handleUpdateConfig.bind(this));
    }

    /** Remove IPC handlers */
    private removeIpcHandlers(): void {
        ipcMain.removeHandler('extension:get-all');
        ipcMain.removeHandler('extension:get');
        ipcMain.removeHandler('extension:install');
        ipcMain.removeHandler('extension:uninstall');
        ipcMain.removeHandler('extension:activate');
        ipcMain.removeHandler('extension:deactivate');
        ipcMain.removeHandler('extension:dev-start');
        ipcMain.removeHandler('extension:dev-stop');
        ipcMain.removeHandler('extension:dev-reload');
        ipcMain.removeHandler('extension:test');
        ipcMain.removeHandler('extension:publish');
        ipcMain.removeHandler('extension:get-profile');
        ipcMain.removeHandler('extension:validate');
        ipcMain.removeHandler('extension:get-state');
        ipcMain.removeHandler('extension:get-config');
        ipcMain.removeHandler('extension:update-config');
    }

    // IPC Handlers

    private handleGetAll(): { success: boolean; extensions: ExtensionRuntimeInfo[] } {
        const extensions = Array.from(this.state.extensions.values()).map((instance) => ({
            manifest: instance.manifest,
            status: instance.status,
            extensionPath: instance.context.extensionPath,
            isDev: this.state.watchers.has(instance.manifest.id),
            uiBundleStamp: this.getExtensionUiBundleStamp(instance),
        }));
        return { success: true, extensions };
    }

    private handleGet(_event: Electron.IpcMainInvokeEvent, extensionId: string): { success: boolean; extension?: ExtensionRuntimeInfo } {
        const instance = this.state.extensions.get(extensionId);
        if (!instance) {
            return { success: false };
        }
        return {
            success: true,
            extension: {
                manifest: instance.manifest,
                status: instance.status,
                extensionPath: instance.context.extensionPath,
                isDev: this.state.watchers.has(extensionId),
                uiBundleStamp: this.getExtensionUiBundleStamp(instance),
            },
        };
    }

    private async handleInstall(_event: Electron.IpcMainInvokeEvent, extensionPath: string): Promise<{ success: boolean; extensionId?: string; error?: string }> {
        try {
            return await this.installExtension(extensionPath);
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    private async handleUninstall(_event: Electron.IpcMainInvokeEvent, extensionId: string): Promise<{ success: boolean; error?: string; messageKey?: string; messageParams?: Record<string, string | number> }> {
        try {
            return await this.uninstallExtension(extensionId);
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    private async handleActivate(_event: Electron.IpcMainInvokeEvent, extensionId: string): Promise<ExtensionActionResult> {
        try {
            const result = await this.activateExtension(extensionId);
            if (result.success) {
                const settings = this.settingsService.getSettings();
                const disabled = settings.extensionDisabledServers || [];
                const newDisabled = disabled.filter(id => id !== extensionId);
                await this.settingsService.saveSettings({ extensionDisabledServers: newDisabled });
            }
            return result;
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    private async handleDeactivate(_event: Electron.IpcMainInvokeEvent, extensionId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const result = await this.deactivateExtension(extensionId);
            if (result.success) {
                const settings = this.settingsService.getSettings();
                const disabled = settings.extensionDisabledServers || [];
                if (!disabled.includes(extensionId)) {
                    await this.settingsService.saveSettings({ extensionDisabledServers: [...disabled, extensionId] });
                }
            }
            return result;
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    private async handleDevStart(_event: Electron.IpcMainInvokeEvent, options: ExtensionDevOptions): Promise<{ success: boolean; error?: string }> {
        try {
            return await this.startDevServer(options);
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    private async handleDevStop(_event: Electron.IpcMainInvokeEvent, extensionId: string): Promise<{ success: boolean; error?: string }> {
        try {
            return await this.stopDevServer(extensionId);
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    private async handleDevReload(_event: Electron.IpcMainInvokeEvent, extensionId: string): Promise<{ success: boolean; error?: string }> {
        try {
            return await this.reloadExtension(extensionId);
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    private async handleTest(_event: Electron.IpcMainInvokeEvent, options: ExtensionTestOptions): Promise<ExtensionTestResult> {
        return await this.runTests(options);
    }

    private async handlePublish(_event: Electron.IpcMainInvokeEvent, options: ExtensionPublishOptions): Promise<ExtensionPublishResult> {
        return await this.publishExtension(options);
    }

    private handleGetProfile(_event: Electron.IpcMainInvokeEvent, extensionId: string): { success: boolean; profile?: ExtensionProfileData } {
        const instance = this.state.extensions.get(extensionId);
        if (!instance) {
            return { success: false };
        }

        // Update memory usage (approximate for demo/debugging purposes)
        instance.profileData.memoryUsage = process.memoryUsage().heapUsed;

        return { success: true, profile: instance.profileData };
    }

    private handleGetState(_event: Electron.IpcMainInvokeEvent, extensionId: string): { success: boolean; state?: { global: Record<string, RuntimeValue>, workspace: Record<string, RuntimeValue> } } {
        const instance = this.state.extensions.get(extensionId);
        if (!instance) {
            return { success: false };
        }

        const globalState: Record<string, RuntimeValue> = {};
        for (const key of instance.context.globalState.keys()) {
            globalState[key] = instance.context.globalState.get(key);
        }

        const workspaceState: Record<string, RuntimeValue> = {};
        for (const key of instance.context.workspaceState.keys()) {
            workspaceState[key] = instance.context.workspaceState.get(key);
        }

        return { success: true, state: { global: globalState, workspace: workspaceState } };
    }

    private handleValidate(_event: Electron.IpcMainInvokeEvent, manifest: RuntimeValue): { valid: boolean; errors: string[] } {
        return validateManifest(manifest);
    }

    private handleGetConfig(
        _event: Electron.IpcMainInvokeEvent,
        extensionId: string
    ): { success: boolean; config?: Record<string, RuntimeValue>; error?: string } {
        const instance = this.state.extensions.get(extensionId);
        if (!instance) {
            return { success: false, error: EXTENSION_ERROR_MESSAGE.EXTENSION_NOT_FOUND };
        }
        return { success: true, config: this.getExtensionConfigSnapshot(extensionId) };
    }

    private async handleUpdateConfig(
        _event: Electron.IpcMainInvokeEvent,
        extensionId: string,
        configPatch: RuntimeValue
    ): Promise<{ success: boolean; config?: Record<string, RuntimeValue>; error?: string }> {
        if (!configPatch || typeof configPatch !== 'object' || Array.isArray(configPatch)) {
            return { success: false, error: 'Invalid extension config payload' };
        }

        try {
            const updatedConfig = await this.updateExtensionConfig(
                extensionId,
                configPatch as Record<string, RuntimeValue>
            );
            return { success: true, config: updatedConfig };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    // Public API Methods

    /** Get all extensions */
    getAllExtensions(): { success: boolean; extensions: Array<{ manifest: ExtensionManifest; status: ExtensionStatus }> } {
        const result = this.handleGetAll();
        return {
            success: result.success,
            extensions: result.extensions.map(e => ({ manifest: e.manifest, status: e.status }))
        };
    }

    /** Get single extension */
    getExtension(extensionId: string): { success: boolean; extension?: { manifest: ExtensionManifest; status: ExtensionStatus } } {
        const result = this.handleGet({} as Electron.IpcMainInvokeEvent, extensionId);
        return {
            success: result.success,
            extension: result.extension ? { manifest: result.extension.manifest, status: result.extension.status } : undefined
        };
    }

    /** Validate manifest */
    validateManifest(manifest: RuntimeValue): { valid: boolean; errors: string[] } {
        return validateManifest(manifest);
    }

    /** Install an extension from a path */
    async installExtension(extensionPath: string): Promise<{
        success: boolean;
        extensionId?: string;
        error?: string;
        messageKey?: string;
        messageParams?: Record<string, string | number>;
    }> {
        const resolvedExtensionPath = this.resolveAndValidateExtensionPath(extensionPath);
        if (!resolvedExtensionPath) {
            return {
                success: false,
                error: EXTENSION_ERROR_MESSAGE.PATH_NOT_ALLOWED,
                messageKey: EXTENSION_MESSAGE_KEY.PATH_NOT_ALLOWED
            };
        }

        const manifestPath = path.join(resolvedExtensionPath, 'package.json');

        try {
            await fs.promises.access(manifestPath, fs.constants.F_OK);
        } catch {
            return {
                success: false,
                error: EXTENSION_ERROR_MESSAGE.PACKAGE_JSON_NOT_FOUND,
                messageKey: EXTENSION_MESSAGE_KEY.PACKAGE_JSON_NOT_FOUND
            };
        }

        const manifestContent = await fs.promises.readFile(manifestPath, 'utf-8');
        const packageJson = JSON.parse(manifestContent) as ExtensionPackageJson;
        const resolvedManifest = this.buildManifestFromPackageJson(packageJson);
        if (!resolvedManifest) {
            return {
                success: false,
                error: EXTENSION_ERROR_MESSAGE.NO_TENGRA_CONFIGURATION,
                messageKey: EXTENSION_MESSAGE_KEY.NO_TENGRA_CONFIGURATION
            };
        }

        const validation = validateManifest(resolvedManifest);
        if (!validation.valid) {
            return { success: false, error: `Invalid manifest: ${validation.errors.join(', ')}` };
        }

        const manifest = resolvedManifest as ExtensionManifest;
        const permissionValidation = this.validateDeclaredPermissions(manifest.permissions);
        if (!permissionValidation.valid) {
            return { success: false, error: permissionValidation.error };
        }

        const existing = this.state.extensions.get(manifest.id);
        if (existing?.status === 'active') {
            const deactivation = await this.deactivateExtension(manifest.id);
            if (!deactivation.success) {
                return { success: false, error: deactivation.error ?? 'Failed to deactivate existing extension' };
            }
        }
        const existingWatcher = this.state.watchers.get(manifest.id);
        if (existingWatcher) {
            existingWatcher.close();
            this.state.watchers.delete(manifest.id);
        }

        await this.ensureExtensionConfigLoaded(manifest.id, resolvedExtensionPath);

        // Create extension context
        const baseContext: ExtensionContext = {
            extensionId: manifest.id,
            extensionPath: resolvedExtensionPath,
            globalState: createExtensionState(`${manifest.id}:global`),
            workspaceState: createExtensionState(`${manifest.id}:workspace`),
            subscriptions: [],
            logger: createExtensionLogger(manifest.id, {
                info: (message, ...args) => this.streamLog(manifest.id, 'info', message, ...args),
                warn: (message, ...args) => this.streamLog(manifest.id, 'warn', message, ...args),
                error: (message, error) => this.streamLog(manifest.id, 'error', message, error as Error),
                debug: (message, ...args) => this.streamLog(manifest.id, 'debug', message, ...args),
            }),
            configuration: this.createConfigAccessor(manifest.id),
        };
        const context: ExtensionRuntimeContext = {
            ...baseContext,
            commands: this.createCommandAccessor(manifest.id, baseContext),
        };

        // Create profile data
        const profileData: ExtensionProfileData = {
            extensionId: manifest.id,
            memoryUsage: 0,
            cpuUsage: 0,
            activationTime: 0,
            callCount: 0,
            errorCount: 0,
            timestamps: {},
        };

        // Store extension
        const instance: ExtensionInstance = {
            manifest,
            context,
            status: 'installed',
            module: null,
            profileData,
        };

        this.state.extensions.set(manifest.id, instance);
        const event: ExtensionStateEvent = existing ? 'updated' : 'installed';
        this.logInfo(`Extension ${existing ? 'updated' : 'installed'}: ${manifest.id}`);
        this.emitStateChange(event, manifest.id, 'installed');

        return { success: true, extensionId: manifest.id };
    }

    private emitStateChange(
        event: ExtensionStateEvent,
        extensionId?: string,
        status?: ExtensionStatus
    ): void {
        const targetWindow = this.state.mainWindow;
        if (!targetWindow || targetWindow.isDestroyed()) {
            return;
        }

        targetWindow.webContents.send(EXTENSION_STATE_CHANNEL, {
            event,
            extensionId,
            status,
            timestamp: Date.now(),
        });
    }

    /** Helper to stream logs via IPC */
    private streamLog(extensionId: string, level: string, message: string, ...args: RuntimeValue[]): void {
        const fullMessage = `[Extension: ${extensionId}] ${message}`;
        switch (level) {
            case 'info': this.logInfo(fullMessage, ...args as []); break;
            case 'warn': this.logWarn(fullMessage, ...args as []); break;
            case 'error': {
                const possibleError = args[0];
                this.logError(fullMessage, possibleError instanceof Error ? possibleError : undefined);
                break;
            }
            case 'debug': this.logDebug(fullMessage, ...args as []); break;
        }

        if (this.state.mainWindow) {
            this.state.mainWindow.webContents.send('extension:log-update', {
                extensionId,
                level,
                message,
                timestamp: Date.now(),
            });
        }
    }

    /** Uninstall an extension */
    async uninstallExtension(extensionId: string): Promise<{
        success: boolean;
        error?: string; 
        messageKey?: string;
        messageParams?: Record<string, string | number>;
    }> {
        const instance = this.state.extensions.get(extensionId);
        if (!instance) {
            return {
                success: false,
                error: EXTENSION_ERROR_MESSAGE.EXTENSION_NOT_FOUND,
                messageKey: EXTENSION_MESSAGE_KEY.EXTENSION_NOT_FOUND
            };
        }

        // Deactivate first if active
        if (instance.status === 'active') {
            await this.deactivateExtension(extensionId);
        }

        // Stop watcher if any
        const watcher = this.state.watchers.get(extensionId);
        if (watcher) {
            watcher.close();
            this.state.watchers.delete(extensionId);
        }

        // Clean up subscriptions
        for (const disposable of instance.context.subscriptions) {
            try {
                disposable.dispose();
            } catch (error) {
                this.logError('Failed to dispose subscription', error as Error);
            }
        }

        // Delete from disk if it's in the managed extensions folder
        const extensionPath = instance.context.extensionPath;
        if (this.state.extensionsPath && extensionPath.startsWith(this.state.extensionsPath)) {
            try {
                // Give some time for OS to release file handles after watcher/process closure
                await new Promise(resolve => setTimeout(resolve, 200));

                const stats = fs.lstatSync(extensionPath);
                if (stats.isSymbolicLink()) {
                    fs.unlinkSync(extensionPath);
                    this.logInfo(`Extension symlink removed: ${extensionPath}`);
                } else {
                    // Optimized deletion for Windows: try to rename first if possible
                    // as it releases the lock on the original path name immediately
                    const trashPath = `${extensionPath}.trash-${Date.now()}`;
                    try {
                        fs.renameSync(extensionPath, trashPath);
                        await fs.promises.rm(trashPath, { recursive: true, force: true });
                    } catch {
                        // If rename fails, try direct deletion with retries
                        let lastErr: Error | null = null;
                        for (let i = 0; i < 5; i++) {
                            try {
                                await fs.promises.rm(extensionPath, { recursive: true, force: true });
                                lastErr = null;
                                break;
                            } catch (err) {
                                lastErr = err as Error;
                                await new Promise(resolve => setTimeout(resolve, 150 * (i + 1)));
                            }
                        }
                        if (lastErr) { throw lastErr; }
                    }
                    this.logInfo(`Extension folder deleted: ${extensionPath}`);
                }
            } catch (err) {
                this.logError(`Failed to delete extension folder: ${extensionPath}`, err as Error);
                
                // On Windows, EPERM often means a file is locked. 
                // CRITICAL IMPROVEMENT: Create a .uninstalled marker file so we know to skip this 
                // folder on next start if deletion failed.
                try {
                    const markerPath = path.join(extensionPath, '.uninstalled');
                    fs.writeFileSync(markerPath, JSON.stringify({
                        uninstalledAt: new Date().toISOString(),
                        reason: (err as Error).message
                    }));
                } catch (markerErr) {
                    this.logError('Failed to create .uninstalled marker', markerErr as Error);
                }

                this.state.extensions.delete(extensionId);
                this.state.extensionConfigs.delete(extensionId);
                this.state.configListeners.delete(extensionId);
                this.emitStateChange('uninstalled', extensionId);

                return {
                    success: true, // Mark as success because we've removed it from the active session
                    messageKey: 'extension.uninstall.partial_success'
                };
            }
        }

        this.state.extensions.delete(extensionId);
        this.state.extensionConfigs.delete(extensionId);
        this.state.configListeners.delete(extensionId);
        this.logInfo(`Extension uninstalled: ${extensionId}`);
        this.emitStateChange('uninstalled', extensionId);

        return { success: true };
    }

    /** Activate an extension */
    async activateExtension(extensionId: string): Promise<ExtensionActionResult> {
        const instance = this.state.extensions.get(extensionId);
        if (!instance) {
            return {
                success: false,
                error: EXTENSION_ERROR_MESSAGE.EXTENSION_NOT_FOUND,
                messageKey: EXTENSION_MESSAGE_KEY.EXTENSION_NOT_FOUND
            };
        }

        if (instance.status === 'active') {
            return { success: true };
        }

        const startTime = Date.now();
        instance.status = 'loading';

        try {
            // Load extension module
            const modulePath = path.join(instance.context.extensionPath, instance.manifest.main);
            const resolvedModulePath = this.resolveSafeChildPath(instance.context.extensionPath, modulePath);
            if (!resolvedModulePath) {
                throw new Error(EXTENSION_ERROR_MESSAGE.ENTRY_POINT_OUTSIDE_ROOT);
            }
            await fs.promises.access(resolvedModulePath, fs.constants.F_OK);
            const loadedModule = await this.loadSandboxedExtensionModule(extensionId, resolvedModulePath);
            instance.module = loadedModule;
            await loadedModule.activate(instance.context);

            instance.status = 'active';
            instance.profileData.activationTime = Date.now() - startTime;
            instance.profileData.timestamps.activated = startTime;

            this.logInfo(`Extension activated: ${extensionId} (${instance.profileData.activationTime}ms)`);
            this.emitStateChange('activated', extensionId, 'active');
            return { success: true };
        } catch (error) {
            const maxSizeKb = Math.floor(MAX_EXTENSION_SCRIPT_BYTES / 1024);
            const isSandboxSizeLimitError = (error as Error).message === EXTENSION_MESSAGE_KEY.SANDBOX_SIZE_LIMIT;
            const isEntryPointOutsideRootError = (error as Error).message === EXTENSION_ERROR_MESSAGE.ENTRY_POINT_OUTSIDE_ROOT;
            const isActivateFunctionMissingError = (error as Error).message === EXTENSION_ERROR_MESSAGE.ACTIVATE_FUNCTION_MISSING;
            instance.status = 'error';
            instance.profileData.errorCount++;
            instance.profileData.lastError = (error as Error).message;
            this.logError(`Failed to activate ${extensionId}`, error as Error);
            this.emitStateChange('activation-failed', extensionId, 'error');
            return {
                success: false,
                error: isSandboxSizeLimitError
                    ? `Extension script exceeds sandbox size limit (${maxSizeKb} KB)`
                    : isEntryPointOutsideRootError
                        ? EXTENSION_ERROR_MESSAGE.ENTRY_POINT_OUTSIDE_ROOT
                        : isActivateFunctionMissingError
                            ? EXTENSION_ERROR_MESSAGE.ACTIVATE_FUNCTION_MISSING
                    : (error as Error).message,
                messageKey: isSandboxSizeLimitError
                    ? EXTENSION_MESSAGE_KEY.SANDBOX_SIZE_LIMIT
                    : isEntryPointOutsideRootError
                        ? EXTENSION_MESSAGE_KEY.ENTRY_POINT_OUTSIDE_ROOT
                        : isActivateFunctionMissingError
                            ? EXTENSION_MESSAGE_KEY.ACTIVATE_FUNCTION_MISSING
                            : undefined,
                messageParams: isSandboxSizeLimitError ? { maxSizeKb } : undefined
            };
        }
    }

    /** Deactivate an extension */
    async deactivateExtension(extensionId: string): Promise<{
        success: boolean;
        error?: string;
        messageKey?: string;
        messageParams?: Record<string, string | number>;
    }> {
        const instance = this.state.extensions.get(extensionId);
        if (!instance) {
            return {
                success: false,
                error: EXTENSION_ERROR_MESSAGE.EXTENSION_NOT_FOUND,
                messageKey: EXTENSION_MESSAGE_KEY.EXTENSION_NOT_FOUND
            };
        }

        if (instance.status !== 'active') {
            return { success: true };
        }

        try {
            // Call deactivate if available
            if (instance.module && typeof instance.module.deactivate === 'function') {
                await instance.module.deactivate();
            }

            // Clean up subscriptions
            for (const disposable of instance.context.subscriptions) {
                try {
                    disposable.dispose();
                } catch (error) {
                    this.logError('Failed to dispose subscription', error as Error);
                }
            }
            instance.context.subscriptions = [];

            instance.status = 'inactive';
            instance.profileData.timestamps.deactivated = Date.now();

            this.logInfo(`Extension deactivated: ${extensionId}`);
            this.emitStateChange('deactivated', extensionId, 'inactive');
            return { success: true };
        } catch (error) {
            this.logError(`Failed to deactivate ${extensionId}`, error as Error);
            return { success: false, error: (error as Error).message };
        }
    }

    /** Start development server (Hot Reload) */
    async startDevServer(options: ExtensionDevOptions): Promise<{
        success: boolean;
        error?: string;
        messageKey?: string;
        messageParams?: Record<string, string | number>;
    }> {
        // Install extension first
        const installResult = await this.installExtension(options.extensionPath);
        if (!installResult.success || !installResult.extensionId) {
            return {
                success: false,
                error: installResult.error,
                messageKey: installResult.messageKey,
                messageParams: installResult.messageParams
            };
        }

        const extensionId = installResult.extensionId;

        // Activate extension
        const activateResult = await this.activateExtension(extensionId);
        if (!activateResult.success) {
            return {
                success: false,
                error: activateResult.error,
                messageKey: activateResult.messageKey,
                messageParams: activateResult.messageParams
            };
        }

        // Start file watcher
        if (!this.state.watchers.has(extensionId)) {
            const extensionRoot = this.state.extensions.get(extensionId)?.context.extensionPath ?? options.extensionPath;
            let debounceTimer: NodeJS.Timeout | null = null;
            const watcher = fs.watch(extensionRoot, { recursive: true }, (_event, filename) => {
                if (filename && (filename.endsWith('.js') || filename.endsWith('package.json'))) {
                    // Debounce reload
                    if (debounceTimer) { clearTimeout(debounceTimer); }
                    debounceTimer = setTimeout(() => {
                        this.logInfo(`File change detected in ${extensionId}: ${filename}. Reloading...`);
                        void this.reloadExtension(extensionId);
                    }, 300);
                }
            });
            this.state.watchers.set(extensionId, watcher);
        }

        this.logInfo(`Dev server started for ${extensionId} with Hot Reload`);
        return { success: true };
    }

    /** Stop development server */
    async stopDevServer(extensionId: string): Promise<{ success: boolean; error?: string }> {
        const watcher = this.state.watchers.get(extensionId);
        if (watcher) {
            watcher.close();
            this.state.watchers.delete(extensionId);
        }
        await this.deactivateExtension(extensionId);
        this.logInfo(`Dev server stopped for ${extensionId}`);
        return { success: true };
    }

    /** Reload extension */
    async reloadExtension(extensionId: string): Promise<{
        success: boolean;
        error?: string;
        messageKey?: string;
        messageParams?: Record<string, string | number>;
    }> {
        await this.deactivateExtension(extensionId);
        const result = await this.activateExtension(extensionId);
        this.logInfo(`Extension reloaded: ${extensionId}`);
        return result;
    }

    /** Run extension tests */
    async runTests(options: ExtensionTestOptions): Promise<ExtensionTestResult> {
        this.logInfo(`Running tests for extension at ${options.extensionPath}`);

        // This would integrate with a test runner
        return {
            success: true,
            passed: 0,
            failed: 0,
            skipped: 0,
            duration: 0,
        };
    }

    /** Publish extension */
    async publishExtension(options: ExtensionPublishOptions): Promise<ExtensionPublishResult> {
        this.logInfo(`Publishing extension at ${options.extensionPath}`);

        // This would integrate with a registry
        return {
            success: true,
            extensionId: 'pending',
            version: '1.0.0',
        };
    }

    /** Get profile data */
    getProfile(extensionId: string): { success: boolean; profile?: ExtensionProfileData } {
        return this.handleGetProfile({} as Electron.IpcMainInvokeEvent, extensionId);
    }

    /** Get state data */
    getState(extensionId: string): { success: boolean; state?: { global: Record<string, RuntimeValue>, workspace: Record<string, RuntimeValue> } } {
        return this.handleGetState({} as Electron.IpcMainInvokeEvent, extensionId);
    }

    private validateDeclaredPermissions(
        permissions: ExtensionManifest['permissions']
    ): { valid: true } | { valid: false; error: string } {
        if (!permissions) {
            return { valid: true };
        }

        for (const permission of permissions) {
            if (!ALLOWED_PERMISSIONS.has(permission)) {
                return { valid: false, error: `Unsupported extension permission: ${permission}` };
            }
        }

        return { valid: true };
    }

    private buildManifestFromPackageJson(packageJson: ExtensionPackageJson): Partial<ExtensionManifest> | null {
        const extensionConfig = this.extractExtensionManifestConfig(packageJson);
        if (!extensionConfig) {
            return null;
        }

        const resolvedAuthor = this.resolveExtensionAuthor(extensionConfig.author ?? packageJson.author);
        return {
            ...extensionConfig,
            id: extensionConfig.id ?? packageJson.id ?? packageJson.name,
            name: extensionConfig.name ?? packageJson.name,
            version: extensionConfig.version ?? packageJson.version,
            description: extensionConfig.description ?? packageJson.description,
            main: extensionConfig.main ?? packageJson.main,
            license: extensionConfig.license ?? packageJson.license,
            author: resolvedAuthor,
            category: extensionConfig.category ?? 'other',
            keywords: Array.isArray(extensionConfig.keywords) ? extensionConfig.keywords : [],
        };
    }

    private extractExtensionManifestConfig(packageJson: ExtensionPackageJson): Partial<ExtensionManifest> | null {
        if (packageJson.tengra && typeof packageJson.tengra === 'object' && !Array.isArray(packageJson.tengra)) {
            return packageJson.tengra;
        }
        if (packageJson.manifest && typeof packageJson.manifest === 'object' && !Array.isArray(packageJson.manifest)) {
            return packageJson.manifest;
        }
        return null;
    }

    private resolveExtensionAuthor(
        author: ExtensionPackageJsonAuthor | ExtensionManifest['author'] | string | undefined
    ): ExtensionManifest['author'] | undefined {
        if (typeof author === 'string') {
            const normalizedName = author.trim();
            if (normalizedName.length === 0) {
                return undefined;
            }
            return { name: normalizedName };
        }

        if (!author || typeof author !== 'object') {
            return undefined;
        }

        const normalizedName = typeof author.name === 'string' ? author.name.trim() : '';
        if (normalizedName.length === 0) {
            return undefined;
        }

        const normalizedAuthor: ExtensionManifest['author'] = { name: normalizedName };
        if (typeof author.email === 'string' && author.email.trim().length > 0) {
            normalizedAuthor.email = author.email.trim();
        }
        if (typeof author.url === 'string' && author.url.trim().length > 0) {
            normalizedAuthor.url = author.url.trim();
        }
        return normalizedAuthor;
    }

    private resolveAndValidateExtensionPath(extensionPath: string): string | null {
        const normalizedCandidate = path.resolve(extensionPath);
        if (!fs.existsSync(normalizedCandidate)) {
            return null;
        }

        try {
            const stats = fs.lstatSync(normalizedCandidate);
            if (!stats.isDirectory() || stats.isSymbolicLink()) {
                return null;
            }
            return normalizedCandidate;
        } catch {
            return null;
        }
    }

    private resolveSafeChildPath(rootPath: string, targetPath: string): string | null {
        const normalizedRoot = path.resolve(rootPath);
        const normalizedTarget = path.resolve(targetPath);
        if (
            normalizedTarget === normalizedRoot ||
            normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`)
        ) {
            return normalizedTarget;
        }

        return null;
    }

    private getExtensionUiBundleStamp(instance: ExtensionInstance): string | undefined {
        const uiPath = instance.manifest.ui;
        if (typeof uiPath !== 'string' || uiPath.trim().length === 0) {
            return undefined;
        }

        const resolvedUiPath = this.resolveSafeChildPath(
            instance.context.extensionPath,
            path.join(instance.context.extensionPath, uiPath)
        );
        if (!resolvedUiPath || !fs.existsSync(resolvedUiPath)) {
            return instance.manifest.version;
        }

        try {
            const stats = fs.statSync(resolvedUiPath);
            return `${instance.manifest.version}:${Math.trunc(stats.mtimeMs)}:${stats.size}`;
        } catch (error) {
            this.logWarn(`Failed to inspect extension UI bundle stamp for ${instance.manifest.id}`, {
                error: error instanceof Error ? error.message : String(error),
            });
            return instance.manifest.version;
        }
    }

    private async loadSandboxedExtensionModule(extensionId: string, modulePath: string): Promise<ExtensionModule> {
        const source = await fs.promises.readFile(modulePath, 'utf8');
        if (Buffer.byteLength(source, 'utf8') > MAX_EXTENSION_SCRIPT_BYTES) {
            throw new Error(EXTENSION_MESSAGE_KEY.SANDBOX_SIZE_LIMIT);
        }

        const sandboxModule: { exports: RuntimeValue } = { exports: {} };
        const sandbox = {
            module: sandboxModule,
            exports: sandboxModule.exports,
            require: this.createSandboxRequire(extensionId),
            console: Object.freeze({
                log: (...args: RuntimeValue[]) => this.streamLog(extensionId, 'info', args.map(String).join(' ')),
                warn: (...args: RuntimeValue[]) => this.streamLog(extensionId, 'warn', args.map(String).join(' ')),
                error: (...args: RuntimeValue[]) => this.streamLog(extensionId, 'error', args.map(String).join(' ')),
            }),
            setTimeout,
            clearTimeout,
        };

        const context = vm.createContext(sandbox, {
            codeGeneration: { strings: false, wasm: false },
        });
        const wrappedSource = `(function(){ "use strict";\n${source}\n})();`;
        const script = new vm.Script(wrappedSource, { filename: modulePath });
        script.runInContext(context, { timeout: 1000 });

        const loaded = sandboxModule.exports as Partial<ExtensionModule>;
        if (typeof loaded.activate !== 'function') {
            throw new Error(EXTENSION_ERROR_MESSAGE.ACTIVATE_FUNCTION_MISSING);
        }

        return loaded as ExtensionModule;
    }

    private createSandboxRequire(extensionId: string): (moduleName: string) => RuntimeValue {
        const loggerBridge = {
            appLogger: {
                info: (...args: RuntimeValue[]) => this.streamLog(extensionId, 'info', args.map(String).join(' ')),
                warn: (...args: RuntimeValue[]) => this.streamLog(extensionId, 'warn', args.map(String).join(' ')),
                error: (...args: RuntimeValue[]) => this.streamLog(extensionId, 'error', args.map(String).join(' ')),
                debug: (...args: RuntimeValue[]) => this.streamLog(extensionId, 'debug', args.map(String).join(' ')),
            },
        };

        return (moduleName: string): RuntimeValue => {
            if (moduleName === '@main/logging/logger') {
                return loggerBridge;
            }
            if (moduleName === '@shared/types/extension') {
                return {};
            }
            throw new Error(`Unsupported extension module import: ${moduleName}`);
        };
    }

    private createCommandAccessor(
        extensionId: string,
        context: ExtensionContext
    ): ExtensionRuntimeContext['commands'] {
        const commandHandlers = new Map<string, ExtensionCommandHandler>();
        return {
            registerCommand: (commandId: string, handler: ExtensionCommandHandler): { dispose: () => void } => {
                const normalizedCommandId = commandId.trim();
                if (normalizedCommandId.length === 0) {
                    throw new Error('Extension command id is required');
                }

                commandHandlers.set(normalizedCommandId, handler);
                this.logInfo(`[Extension: ${extensionId}] Registered command: ${normalizedCommandId}`);

                const disposable = {
                    dispose: (): void => {
                        commandHandlers.delete(normalizedCommandId);
                    },
                };
                context.subscriptions.push(disposable);
                return disposable;
            },
            executeCommand: async <T extends RuntimeValue = RuntimeValue>(
                commandId: string,
                ...args: RuntimeValue[]
            ): Promise<T> => {
                const handler = commandHandlers.get(commandId);
                if (!handler) {
                    throw new Error(`Extension command not found: ${commandId}`);
                }

                const result = await handler(...args);
                return result as T;
            },
            listCommands: (): string[] => Array.from(commandHandlers.keys()),
        };
    }

    /** Create configuration accessor */
    private createConfigAccessor(extensionId: string): ExtensionContext['configuration'] {
        return {
            get: <T>(section: string, defaultValue?: T): T | undefined => {
                const config = this.state.extensionConfigs.get(extensionId) ?? {};
                if (Object.prototype.hasOwnProperty.call(config, section)) {
                    return config[section] as T;
                }
                return defaultValue;
            },
            update: async (section: string, value: RuntimeValue): Promise<void> => {
                const trimmedSection = section.trim();
                if (trimmedSection.length === 0) {
                    throw new Error('Extension configuration section is required');
                }
                await this.updateExtensionConfig(extensionId, { [trimmedSection]: value });
            },
            has: (section: string): boolean => {
                const config = this.state.extensionConfigs.get(extensionId) ?? {};
                return Object.prototype.hasOwnProperty.call(config, section);
            },
            onDidChange: (listener: (event: ConfigurationChangeEvent) => void) => {
                let listeners = this.state.configListeners.get(extensionId);
                if (!listeners) {
                    listeners = new Set<(event: ConfigurationChangeEvent) => void>();
                    this.state.configListeners.set(extensionId, listeners);
                }
                listeners.add(listener);
                return {
                    dispose: () => {
                        listeners?.delete(listener);
                        if (listeners?.size === 0) {
                            this.state.configListeners.delete(extensionId);
                        }
                    }
                };
            },
        };
    }

    private getExtensionConfigPath(extensionPath: string): string {
        return path.join(extensionPath, '.tengra-config.json');
    }

    private async ensureExtensionConfigLoaded(extensionId: string, extensionPath: string): Promise<void> {
        if (this.state.extensionConfigs.has(extensionId)) {
            return;
        }
        const loadedConfig = await this.readExtensionConfigFile(extensionPath);
        this.state.extensionConfigs.set(extensionId, loadedConfig);
    }

    private async readExtensionConfigFile(extensionPath: string): Promise<Record<string, RuntimeValue>> {
        const configPath = this.getExtensionConfigPath(extensionPath);
        try {
            const serialized = await fs.promises.readFile(configPath, 'utf8');
            const parsed = JSON.parse(serialized) as RuntimeValue;
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                this.logWarn(`Invalid extension config at ${configPath}; expected object`);
                return {};
            }
            return { ...(parsed as Record<string, RuntimeValue>) };
        } catch (error) {
            const readError = error as NodeJS.ErrnoException;
            if (readError.code !== 'ENOENT') {
                this.logError(`Failed to read extension config: ${configPath}`, readError);
            }
            return {};
        }
    }

    private async persistExtensionConfig(extensionId: string): Promise<void> {
        const instance = this.state.extensions.get(extensionId);
        if (!instance) {
            throw new Error(EXTENSION_ERROR_MESSAGE.EXTENSION_NOT_FOUND);
        }
        const nextConfig = this.state.extensionConfigs.get(extensionId) ?? {};
        const configPath = this.getExtensionConfigPath(instance.context.extensionPath);
        await fs.promises.writeFile(configPath, JSON.stringify(nextConfig, null, 2), 'utf8');
    }

    private notifyExtensionConfigChanged(extensionId: string, section: string): void {
        const listeners = this.state.configListeners.get(extensionId);
        if (!listeners || listeners.size === 0) {
            return;
        }
        const event: ConfigurationChangeEvent = {
            affectsConfiguration: (candidateSection: string): boolean => {
                const normalizedCandidate = candidateSection.trim();
                if (normalizedCandidate.length === 0) {
                    return false;
                }
                return section === normalizedCandidate
                    || section.startsWith(`${normalizedCandidate}.`)
                    || normalizedCandidate.startsWith(`${section}.`);
            },
        };
        for (const listener of listeners) {
            try {
                listener(event);
            } catch (error) {
                this.logError(`Extension config listener failed: ${extensionId}`, error as Error);
            }
        }
    }

    private getExtensionConfigSnapshot(extensionId: string): Record<string, RuntimeValue> {
        const current = this.state.extensionConfigs.get(extensionId) ?? {};
        return { ...current };
    }

    private async updateExtensionConfig(
        extensionId: string,
        configPatch: Record<string, RuntimeValue>
    ): Promise<Record<string, RuntimeValue>> {
        if (!this.state.extensions.has(extensionId)) {
            throw new Error(EXTENSION_ERROR_MESSAGE.EXTENSION_NOT_FOUND);
        }
        const currentConfig = this.state.extensionConfigs.get(extensionId) ?? {};
        const nextConfig = {
            ...currentConfig,
            ...configPatch,
        };
        this.state.extensionConfigs.set(extensionId, nextConfig);
        await this.persistExtensionConfig(extensionId);
        for (const key of Object.keys(configPatch)) {
            this.notifyExtensionConfigChanged(extensionId, key);
        }
        return { ...nextConfig };
    }
}




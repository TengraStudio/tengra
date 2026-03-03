/**
 * Extension Service - Main process service for extension management
 * MKT-DEV-01: Extension SDK/templates/CLI
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

import { BaseService } from '@main/services/base.service';
import {
    ExtensionContext,
    ExtensionDevOptions,
    ExtensionManifest,
    ExtensionModule,
    ExtensionPermission,
    ExtensionProfileData,
    ExtensionPublishOptions,
    ExtensionPublishResult,
    ExtensionStatus,
    ExtensionTestOptions,
    ExtensionTestResult,
} from '@shared/types/extension';
import { createExtensionLogger, createExtensionState, validateManifest } from '@shared/utils/extension.util';
import { BrowserWindow, ipcMain } from 'electron';

/** Extension instance */
interface ExtensionInstance {
    manifest: ExtensionManifest;
    context: ExtensionContext;
    status: ExtensionStatus;
    module: ExtensionModule | null;
    profileData: ExtensionProfileData;
}

/** Extension service state */
interface ExtensionServiceState {
    extensions: Map<string, ExtensionInstance>;
    watchers: Map<string, fs.FSWatcher>;
    mainWindow: BrowserWindow | null;
    extensionsPath: string;
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

/**
 * Extension Service
 * Manages extension lifecycle, development, and profiling
 */
export class ExtensionService extends BaseService {
    private state: ExtensionServiceState = {
        extensions: new Map(),
        watchers: new Map(),
        mainWindow: null,
        extensionsPath: '',
    };

    constructor() {
        super('ExtensionService');
    }

    override async initialize(): Promise<void> {
        this.logInfo('Initializing Extension Service...');

        // Set up extensions directory
        const userDataPath = process.env.USERDATA || '';
        this.state.extensionsPath = path.join(userDataPath, 'extensions');

        try {
            await fs.promises.access(this.state.extensionsPath, fs.constants.F_OK);
        } catch {
            await fs.promises.mkdir(this.state.extensionsPath, { recursive: true });
        }

        this.setupIpcHandlers();
        this.logInfo('Extension Service initialized successfully');
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
    }

    // IPC Handlers

    private handleGetAll(): { success: boolean; extensions: Array<{ manifest: ExtensionManifest; status: ExtensionStatus }> } {
        const extensions = Array.from(this.state.extensions.values()).map((instance) => ({
            manifest: instance.manifest,
            status: instance.status,
            isDev: this.state.watchers.has(instance.manifest.id),
        }));
        return { success: true, extensions };
    }

    private handleGet(_event: Electron.IpcMainInvokeEvent, extensionId: string): { success: boolean; extension?: { manifest: ExtensionManifest; status: ExtensionStatus; isDev: boolean } } {
        const instance = this.state.extensions.get(extensionId);
        if (!instance) {
            return { success: false };
        }
        return {
            success: true,
            extension: {
                manifest: instance.manifest,
                status: instance.status,
                isDev: this.state.watchers.has(extensionId),
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

    private async handleUninstall(_event: Electron.IpcMainInvokeEvent, extensionId: string): Promise<{ success: boolean; error?: string }> {
        try {
            return await this.uninstallExtension(extensionId);
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    private async handleActivate(_event: Electron.IpcMainInvokeEvent, extensionId: string): Promise<{ success: boolean; error?: string }> {
        try {
            return await this.activateExtension(extensionId);
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    private async handleDeactivate(_event: Electron.IpcMainInvokeEvent, extensionId: string): Promise<{ success: boolean; error?: string }> {
        try {
            return await this.deactivateExtension(extensionId);
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

    private handleGetState(_event: Electron.IpcMainInvokeEvent, extensionId: string): { success: boolean; state?: { global: Record<string, unknown>, workspace: Record<string, unknown> } } {
        const instance = this.state.extensions.get(extensionId);
        if (!instance) {
            return { success: false };
        }

        const globalState: Record<string, unknown> = {};
        for (const key of instance.context.globalState.keys()) {
            globalState[key] = instance.context.globalState.get(key);
        }

        const workspaceState: Record<string, unknown> = {};
        for (const key of instance.context.workspaceState.keys()) {
            workspaceState[key] = instance.context.workspaceState.get(key);
        }

        return { success: true, state: { global: globalState, workspace: workspaceState } };
    }

    private handleValidate(_event: Electron.IpcMainInvokeEvent, manifest: unknown): { valid: boolean; errors: string[] } {
        return validateManifest(manifest);
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
    validateManifest(manifest: unknown): { valid: boolean; errors: string[] } {
        return validateManifest(manifest);
    }

    /** Install an extension from a path */
    async installExtension(extensionPath: string): Promise<{ success: boolean; extensionId?: string; error?: string }> {
        const resolvedExtensionPath = this.resolveAndValidateExtensionPath(extensionPath);
        if (!resolvedExtensionPath) {
            return { success: false, error: 'Extension path is not allowed' };
        }

        const manifestPath = path.join(resolvedExtensionPath, 'package.json');

        try {
            await fs.promises.access(manifestPath, fs.constants.F_OK);
        } catch {
            return { success: false, error: 'package.json not found' };
        }

        const manifestContent = await fs.promises.readFile(manifestPath, 'utf-8');
        const packageJson = JSON.parse(manifestContent);
        const manifest = packageJson.tengra as ExtensionManifest;

        if (!manifest) {
            return { success: false, error: 'No tengra configuration found in package.json' };
        }

        const validation = validateManifest(manifest);
        if (!validation.valid) {
            return { success: false, error: `Invalid manifest: ${validation.errors.join(', ')}` };
        }

        const permissionValidation = this.validateDeclaredPermissions(manifest.permissions);
        if (!permissionValidation.valid) {
            return { success: false, error: permissionValidation.error };
        }

        // Create extension context
        const context: ExtensionContext = {
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
        this.logInfo(`Extension installed: ${manifest.id}`);

        return { success: true, extensionId: manifest.id };
    }

    /** Helper to stream logs via IPC */
    private streamLog(extensionId: string, level: string, message: string, ...args: unknown[]): void {
        const fullMessage = `[Extension: ${extensionId}] ${message}`;
        switch (level) {
            case 'info': this.logInfo(fullMessage, ...args as []); break;
            case 'warn': this.logWarn(fullMessage, ...args as []); break;
            case 'error': this.logError(fullMessage, args[0] as Error); break;
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
    async uninstallExtension(extensionId: string): Promise<{ success: boolean; error?: string }> {
        const instance = this.state.extensions.get(extensionId);
        if (!instance) {
            return { success: false, error: 'Extension not found' };
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

        this.state.extensions.delete(extensionId);
        this.logInfo(`Extension uninstalled: ${extensionId}`);

        return { success: true };
    }

    /** Activate an extension */
    async activateExtension(extensionId: string): Promise<{ success: boolean; error?: string }> {
        const instance = this.state.extensions.get(extensionId);
        if (!instance) {
            return { success: false, error: 'Extension not found' };
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
                throw new Error('Extension entry point resolves outside extension root');
            }
            await fs.promises.access(resolvedModulePath, fs.constants.F_OK);
            const loadedModule = await this.loadSandboxedExtensionModule(extensionId, resolvedModulePath);
            instance.module = loadedModule;
            await loadedModule.activate(instance.context);

            instance.status = 'active';
            instance.profileData.activationTime = Date.now() - startTime;
            instance.profileData.timestamps.activated = startTime;

            this.logInfo(`Extension activated: ${extensionId} (${instance.profileData.activationTime}ms)`);
            return { success: true };
        } catch (error) {
            instance.status = 'error';
            instance.profileData.errorCount++;
            instance.profileData.lastError = (error as Error).message;
            this.logError(`Failed to activate ${extensionId}`, error as Error);
            return { success: false, error: (error as Error).message };
        }
    }

    /** Deactivate an extension */
    async deactivateExtension(extensionId: string): Promise<{ success: boolean; error?: string }> {
        const instance = this.state.extensions.get(extensionId);
        if (!instance) {
            return { success: false, error: 'Extension not found' };
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
            return { success: true };
        } catch (error) {
            this.logError(`Failed to deactivate ${extensionId}`, error as Error);
            return { success: false, error: (error as Error).message };
        }
    }

    /** Start development server (Hot Reload) */
    async startDevServer(options: ExtensionDevOptions): Promise<{ success: boolean; error?: string }> {
        // Install extension first
        const installResult = await this.installExtension(options.extensionPath);
        if (!installResult.success || !installResult.extensionId) {
            return { success: false, error: installResult.error };
        }

        const extensionId = installResult.extensionId;

        // Activate extension
        const activateResult = await this.activateExtension(extensionId);
        if (!activateResult.success) {
            return { success: false, error: activateResult.error };
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
    async reloadExtension(extensionId: string): Promise<{ success: boolean; error?: string }> {
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
    getState(extensionId: string): { success: boolean; state?: { global: Record<string, unknown>, workspace: Record<string, unknown> } } {
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

    private async loadSandboxedExtensionModule(extensionId: string, modulePath: string): Promise<ExtensionModule> {
        const source = await fs.promises.readFile(modulePath, 'utf8');
        if (Buffer.byteLength(source, 'utf8') > MAX_EXTENSION_SCRIPT_BYTES) {
            throw new Error('Extension script exceeds sandbox size limit');
        }

        const sandboxModule: { exports: unknown } = { exports: {} };
        const sandbox = {
            module: sandboxModule,
            exports: sandboxModule.exports,
            console: Object.freeze({
                log: (...args: unknown[]) => this.streamLog(extensionId, 'info', args.map(String).join(' ')),
                warn: (...args: unknown[]) => this.streamLog(extensionId, 'warn', args.map(String).join(' ')),
                error: (...args: unknown[]) => this.streamLog(extensionId, 'error', args.map(String).join(' ')),
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
            throw new Error('Extension module must export an activate function');
        }

        return loaded as ExtensionModule;
    }

    /** Create configuration accessor */
    private createConfigAccessor(_extensionId: string): ExtensionContext['configuration'] {
        void _extensionId;
        return {
            get<T>(_section: string, defaultValue?: T): T | undefined {
                void _section;
                // This would read from actual configuration
                return defaultValue;
            },
            async update(_section: string, _value: unknown): Promise<void> {
                void _section;
                void _value;
                // This would update actual configuration
            },
            has(_section: string): boolean {
                void _section;
                return false;
            },
            onDidChange: () => ({ dispose: () => { } }),
        };
    }
}

// Singleton instance
let extensionServiceInstance: ExtensionService | null = null;

/** Get or create the extension service instance */
export function getExtensionService(): ExtensionService {
    if (!extensionServiceInstance) {
        extensionServiceInstance = new ExtensionService();
    }
    return extensionServiceInstance;
}

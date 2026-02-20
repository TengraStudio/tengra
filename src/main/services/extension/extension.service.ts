/**
 * Extension Service - Main process service for extension management
 * MKT-DEV-01: Extension SDK/templates/CLI
 */

import * as fs from 'fs';
import * as path from 'path';

import { BaseService } from '@main/services/base.service';
import {
    ExtensionContext,
    ExtensionDevOptions,
    ExtensionManifest,
    ExtensionProfileData,
    ExtensionPublishOptions,
    ExtensionPublishResult,
    ExtensionStatus,
    ExtensionTestOptions,
    ExtensionTestResult,
} from '@shared/types/extension';
import { createExtensionLogger,createExtensionState, validateManifest } from '@shared/utils/extension.util';
import { BrowserWindow, ipcMain } from 'electron';

/** Extension instance */
interface ExtensionInstance {
    manifest: ExtensionManifest;
    context: ExtensionContext;
    status: ExtensionStatus;
    module: unknown;
    profileData: ExtensionProfileData;
}

/** Extension service state */
interface ExtensionServiceState {
    extensions: Map<string, ExtensionInstance>;
    mainWindow: BrowserWindow | null;
    extensionsPath: string;
}

/**
 * Extension Service
 * Manages extension lifecycle, development, and profiling
 */
export class ExtensionService extends BaseService {
    private state: ExtensionServiceState = {
        extensions: new Map(),
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

        if (!fs.existsSync(this.state.extensionsPath)) {
            fs.mkdirSync(this.state.extensionsPath, { recursive: true });
        }

        this.setupIpcHandlers();
        this.logInfo('Extension Service initialized successfully');
    }

    override async cleanup(): Promise<void> {
        this.logInfo('Cleaning up Extension Service...');

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
    }

    // IPC Handlers

    private handleGetAll(): { success: boolean; extensions: Array<{ manifest: ExtensionManifest; status: ExtensionStatus }> } {
        const extensions = Array.from(this.state.extensions.values()).map((instance) => ({
            manifest: instance.manifest,
            status: instance.status,
        }));
        return { success: true, extensions };
    }

    private handleGet(_event: Electron.IpcMainInvokeEvent, extensionId: string): { success: boolean; extension?: { manifest: ExtensionManifest; status: ExtensionStatus } } {
        const instance = this.state.extensions.get(extensionId);
        if (!instance) {
            return { success: false };
        }
        return { success: true, extension: { manifest: instance.manifest, status: instance.status } };
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
        return { success: true, profile: instance.profileData };
    }

    private handleValidate(_event: Electron.IpcMainInvokeEvent, manifest: unknown): { valid: boolean; errors: string[] } {
        return validateManifest(manifest);
    }

    // Public API Methods

    /** Get all extensions */
    getAllExtensions(): { success: boolean; extensions: Array<{ manifest: ExtensionManifest; status: ExtensionStatus }> } {
        return this.handleGetAll();
    }

    /** Get single extension */
    getExtension(extensionId: string): { success: boolean; extension?: { manifest: ExtensionManifest; status: ExtensionStatus } } {
        return this.handleGet({} as Electron.IpcMainInvokeEvent, extensionId);
    }

    /** Validate manifest */
    validateManifest(manifest: unknown): { valid: boolean; errors: string[] } {
        return validateManifest(manifest);
    }

    /** Install an extension from a path */
    async installExtension(extensionPath: string): Promise<{ success: boolean; extensionId?: string; error?: string }> {
        const manifestPath = path.join(extensionPath, 'package.json');

        if (!fs.existsSync(manifestPath)) {
            return { success: false, error: 'package.json not found' };
        }

        const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
        const packageJson = JSON.parse(manifestContent);
        const manifest = packageJson.tandem as ExtensionManifest;

        if (!manifest) {
            return { success: false, error: 'No tandem configuration found in package.json' };
        }

        const validation = validateManifest(manifest);
        if (!validation.valid) {
            return { success: false, error: `Invalid manifest: ${validation.errors.join(', ')}` };
        }

        // Create extension context
        const context: ExtensionContext = {
            extensionId: manifest.id,
            extensionPath,
            globalState: createExtensionState(`${manifest.id}:global`),
            workspaceState: createExtensionState(`${manifest.id}:workspace`),
            subscriptions: [],
            logger: createExtensionLogger(manifest.id, {
                info: (message, ...args) => this.logInfo(message, ...args),
                warn: (message, ...args) => this.logWarn(message, ...args),
                error: (message, error) => this.logError(message, error),
                debug: (message, ...args) => this.logDebug(message, ...args),
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
            if (fs.existsSync(modulePath)) {
                // In a real implementation, this would load the module in a sandboxed context
                // For now, we just mark it as loaded
                instance.module = {};
            }

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
            if (
                instance.module &&
                typeof (instance.module as { deactivate?: () => Promise<void> | void }).deactivate ===
                    'function'
            ) {
                await (instance.module as { deactivate: () => Promise<void> | void }).deactivate();
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

    /** Start development server */
    async startDevServer(options: ExtensionDevOptions): Promise<{ success: boolean; error?: string }> {
        // Install extension first
        const installResult = await this.installExtension(options.extensionPath);
        if (!installResult.success || !installResult.extensionId) {
            return { success: false, error: installResult.error };
        }

        // Activate extension
        const activateResult = await this.activateExtension(installResult.extensionId);
        if (!activateResult.success) {
            return { success: false, error: activateResult.error };
        }

        this.logInfo(`Dev server started for ${installResult.extensionId}`);
        return { success: true };
    }

    /** Stop development server */
    async stopDevServer(extensionId: string): Promise<{ success: boolean; error?: string }> {
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

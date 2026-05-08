/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Buffer } from 'buffer';
import { spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';

import { ipc } from '@main/core/ipc-decorators';
import { BaseService } from '@main/services/base.service';
import { t } from '@main/utils/i18n.util';
import { serializeToIpc } from '@main/utils/ipc-serializer.util';
import { NETWORK_DEFAULTS } from '@shared/constants/app-config';
import { RUNTIME_CHANNELS } from '@shared/constants/ipc-channels';
import { RuntimeValue } from '@shared/types/common';
import { JsonObject } from '@shared/types/common';
import {
    RuntimeBootstrapExecutionEntry,
    RuntimeBootstrapExecutionResult,
    RuntimeBootstrapPlan,
    RuntimeBootstrapPlanEntry,
    RuntimeInstallSubdirectory,
    RuntimeManifest,
    RuntimeManifestTarget,
    RuntimeTargetEnvironment,
} from '@shared/types/runtime-manifest';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { app, type BrowserWindow } from 'electron';

import { RuntimeHealthService } from './runtime-health.service';
import { RuntimeManifestService } from './runtime-manifest.service';
import {
    getManagedRuntimeBinDir,
    getManagedRuntimeDownloadsDir,
    getManagedRuntimeManifestsDir,
    getManagedRuntimeModelsDir,
    getManagedRuntimeTempDir,
} from './runtime-path.service';

const LEGACY_SERVICE_ARTIFACTS = [
    'token-service.log',
    'tokens.store.json',
] as const;
const STALE_ELECTRON_CACHE_DIRECTORIES = [
    'blob_storage',
] as const;

const TERMINAL_LOG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const IGNORABLE_CLEANUP_ERROR_CODES = new Set(['EBUSY', 'ENOENT', 'EPERM']);

export class RuntimeBootstrapService extends BaseService {
    private readonly allowedDownloadHosts = new Set([
        'github.com',
        'release-assets.githubusercontent.com',
        'objects.githubusercontent.com',
        'raw.githubusercontent.com',
    ]);
    private latestExecutionResult: RuntimeBootstrapExecutionResult | null = null;
    public onScanFinished?: (result: RuntimeBootstrapExecutionResult) => void;
    private isMainProcessReadyGetter?: () => boolean;
    private initializationPromise: Promise<void> | null = null;

    constructor(
        private readonly runtimeManifestService: RuntimeManifestService = new RuntimeManifestService(),
        private readonly runtimeHealthService: RuntimeHealthService = new RuntimeHealthService()
    ) {
        super('RuntimeBootstrapService');
    }

    async initialize(): Promise<void> {
        if (this.initializationPromise) {
            await this.initializationPromise;
            return;
        }

        if (!this.latestExecutionResult) {
            this.latestExecutionResult = this.createInitializingExecutionResult();
        }

        this.initializationPromise = (async () => {
            try {
                void this.runStartupRefresh().catch(error => {
                    this.logError('Managed runtime background refresh failed', error);
                });
            } finally {
                this.logInfo('Managed runtime bootstrap initialized');
            }
        })();

        await this.initializationPromise;
    }

    getLatestExecutionResult(): RuntimeBootstrapExecutionResult | null {
        return this.latestExecutionResult;
    }

    async runComponentAction(
        componentId: string,
        options?: { getMainWindow?: () => BrowserWindow | null }
    ): Promise<{ success: boolean; message: string }> {
        if (componentId === 'ollama') {
            const { startOllama } = await import('@main/startup/ollama');
            const result = await startOllama(options?.getMainWindow ?? (() => null), false);
            return { success: result.success, message: result.message };
        }

        if (componentId === 'sd-cpp' || componentId === 'biome' || componentId === 'ruff' || componentId === 'golangci-lint') {
            await this.ensureManagedRuntime();
            return { success: true, message: t('backend.runtimeInstallTriggered') };
        }

        return { success: false, message: `No runtime action is registered for ${componentId}` };
    }

    buildInstallPlan(
        rawManifest: RuntimeManifest | JsonObject,
        environment: RuntimeTargetEnvironment = this.runtimeManifestService.getCurrentEnvironment()
    ): RuntimeBootstrapPlan {
        const manifest = this.runtimeManifestService.parseManifest(rawManifest);
        const entries = manifest.components.map(component => this.buildPlanEntry(component, environment));

        return {
            manifestVersion: manifest.releaseTag,
            environment,
            entries,
            summary: {
                ready: entries.filter(entry => entry.status === 'ready').length,
                install: entries.filter(entry => entry.status === 'install').length,
                external: entries.filter(entry => entry.status === 'external').length,
                unsupported: entries.filter(entry => entry.status === 'unsupported').length,
            },
        };
    }

    async scanManagedRuntime(manifestUrl?: string): Promise<RuntimeBootstrapExecutionResult> {
        const manifest = await this.loadManifest(manifestUrl);
        const plan = this.buildInstallPlan(manifest);
        const entries = this.scanPlan(plan);
        const health = await this.runtimeHealthService.assessPlan(this.buildHealthPlan(plan, entries));
        this.latestExecutionResult = this.buildExecutionResult(plan, entries, health);
        this.onScanFinished?.(this.latestExecutionResult);
        return this.latestExecutionResult;
    }

    async ensureManagedRuntime(manifestUrl?: string): Promise<RuntimeBootstrapExecutionResult> {
        const manifest = await this.loadManifest(manifestUrl);
        const plan = this.buildInstallPlan(manifest);
        const entries = await this.executePlan(plan);
        const health = await this.runtimeHealthService.assessPlan(this.buildHealthPlan(plan, entries));
        this.latestExecutionResult = this.buildExecutionResult(plan, entries, health);
        this.onScanFinished?.(this.latestExecutionResult);
        return this.latestExecutionResult;
    }

    private buildPlanEntry(
        component: RuntimeManifest['components'][number],
        environment: RuntimeTargetEnvironment
    ): RuntimeBootstrapPlanEntry {
        const isPlatformSupported =
            !component.supportedPlatforms || component.supportedPlatforms.includes(environment.platform);
        const isArchSupported =
            !component.supportedArches || component.supportedArches.includes(environment.arch);
        if (!isPlatformSupported || !isArchSupported) {
            return {
                componentId: component.id,
                displayName: component.displayName,
                version: component.version,
                status: 'unsupported',
                source: component.source,
                requirement: component.requirement,
                reason: 'unsupported-platform',
                installUrl: component.installUrl,
            };
        }

        if (component.source === 'external') {
            if (component.targets.length > 0) {
                const target = this.runtimeManifestService.selectTarget(component, environment);
                if (!target) {
                    return {
                        componentId: component.id,
                        displayName: component.displayName,
                        version: component.version,
                        status: 'unsupported',
                        source: component.source,
                        requirement: component.requirement,
                        reason: 'unsupported-platform',
                        installUrl: component.installUrl,
                    };
                }
            }
            return {
                componentId: component.id,
                displayName: component.displayName,
                version: component.version,
                status: 'external',
                source: component.source,
                requirement: component.requirement,
                reason: 'external-dependency',
                installUrl: component.installUrl,
            };
        }

        const target = this.runtimeManifestService.selectTarget(component, environment);
        if (!target) {
            return {
                componentId: component.id,
                displayName: component.displayName,
                version: component.version,
                status: 'unsupported',
                source: component.source,
                requirement: component.requirement,
                reason: 'unsupported-platform',
            };
        }

        const installPath = this.resolveInstallPath(target);
        const fileExists = fs.existsSync(installPath);

        return {
            componentId: component.id,
            displayName: component.displayName,
            version: component.version,
            status: fileExists ? 'ready' : 'install',
            source: component.source,
            requirement: component.requirement,
            reason: fileExists ? 'file-present' : 'missing-file',
            installPath,
            target,
        };
    }

    private async loadManifest(manifestUrl?: string): Promise<RuntimeManifest> {
        const envManifestUrl = process.env['TENGRA_RUNTIME_MANIFEST_URL'];
        const resolvedManifestUrl =
            manifestUrl ?? envManifestUrl ?? NETWORK_DEFAULTS.RUNTIME_MANIFEST_URL;
        const cachedManifestPath = path.join(
            getManagedRuntimeManifestsDir(),
            'runtime-manifest.json'
        );
        const usesDefaultManifestUrl =
            manifestUrl === undefined &&
            envManifestUrl === undefined &&
            resolvedManifestUrl === NETWORK_DEFAULTS.RUNTIME_MANIFEST_URL;

        // PRE-LAUNCH BYPASS: Disable manifest network fetch while repo is private
        // TODO: Remove this once the repository is public
        const isPreLaunch = false;
        if (isPreLaunch && usesDefaultManifestUrl) {
            this.logInfo('Runtime manifest fetch skipped (pre-launch phase)');
            if (fs.existsSync(cachedManifestPath)) {
                const cachedManifestText = await fsPromises.readFile(cachedManifestPath, 'utf8');
                return this.runtimeManifestService.parseManifest(
                    safeJsonParse<JsonObject>(cachedManifestText, {})
                );
            }
            return this.createEmptyManifest();
        }

        // OPTIMIZATION: Load cached manifest immediately for sub-1s boot
        let cachedManifest: RuntimeManifest | null = null;
        try {
            if (fs.existsSync(cachedManifestPath)) {
                const cachedManifestText = await fsPromises.readFile(cachedManifestPath, 'utf8');
                cachedManifest = this.runtimeManifestService.parseManifest(
                    safeJsonParse<JsonObject>(cachedManifestText, {})
                );
            }
        } catch (e) {
            this.logDebug('Failed to read cached manifest during optimistic phase', e);
        }

        // If we have a cached manifest, trigger the network update in the background and return cache
        if (cachedManifest && usesDefaultManifestUrl) {
            void (async () => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s bg timeout
                try {
                    const response = await fetch(resolvedManifestUrl, {
                        redirect: 'follow',
                        signal: controller.signal,
                    });
                    if (response.ok) {
                        const manifestText = await response.text();
                        await this.cacheManifest(manifestText);
                        this.logDebug('Background runtime manifest update complete');
                    }
                } catch (e) {
                    this.logDebug('Background runtime manifest update failed', e);
                } finally {
                    clearTimeout(timeoutId);
                }
            })();
            return cachedManifest;
        }

        // Fallback for missing cache or custom URL: blocking load
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s blocking timeout
        try {
            this.validateDownloadUrl(resolvedManifestUrl);
            const response = await fetch(resolvedManifestUrl, {
                redirect: 'follow',
                signal: controller.signal,
            });
            if (!response.ok) {
                throw new Error('error.system.manifest_read_failed');
            }
            const manifestText = await response.text();
            await this.cacheManifest(manifestText);
            return this.runtimeManifestService.parseManifest(
                safeJsonParse<JsonObject>(manifestText, {})
            );
        } catch (error) {
            return this.loadCachedOrFallbackManifest(
                cachedManifestPath,
                usesDefaultManifestUrl,
                error
            );
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private async loadCachedOrFallbackManifest(
        cachedManifestPath: string,
        allowEmptyFallback: boolean,
        originalError: unknown
    ): Promise<RuntimeManifest> {
        try {
            this.logWarn(
                `Falling back to cached runtime manifest at ${cachedManifestPath}; reason=${this.describeManifestLoadError(originalError)}`
            );
            const cachedManifestText = await fsPromises.readFile(cachedManifestPath, 'utf8');
            return this.runtimeManifestService.parseManifest(
                safeJsonParse<JsonObject>(cachedManifestText, {})
            );
        } catch (cacheError) {
            if (!allowEmptyFallback) {
                throw (cacheError instanceof Error ? cacheError : new Error('error.system.manifest_read_failed'));
            }

            this.logInfo(
                `Runtime manifest unavailable; continuing with empty managed runtime manifest (${cachedManifestPath})`
            );
            return this.createEmptyManifest();
        }
    }

    private describeManifestLoadError(error: unknown): string {
        if (!(error instanceof Error)) {
            return 'unknown';
        }

        const namedError = error as Error & { code?: string };
        const code = typeof namedError.code === 'string' ? namedError.code : '';
        const message = namedError.message?.trim() ?? '';
        if (code.length > 0 && message.length > 0) {
            return `${code}:${message}`;
        }
        if (code.length > 0) {
            return code;
        }
        return message.length > 0 ? message : 'error';
    }

    private createEmptyManifest(): RuntimeManifest {
        return {
            schemaVersion: 1,
            releaseTag: 'runtime-unavailable',
            generatedAt: new Date().toISOString(),
            components: [],
        };
    }

    private createInitializingExecutionResult(): RuntimeBootstrapExecutionResult {
        const environment = this.runtimeManifestService.getCurrentEnvironment();
        return {
            manifestVersion: 'initializing',
            environment,
            entries: [],
            summary: {
                ready: 0,
                installed: 0,
                installRequired: 0,
                failed: 0,
                external: 0,
                unsupported: 0,
                blockingFailures: 0,
            },
            health: {
                entries: [],
                summary: {
                    ready: 0,
                    missing: 0,
                    invalid: 0,
                    external: 0,
                    unsupported: 0,
                },
            },
            mainProcessReady: this.isMainProcessReadyGetter ? this.isMainProcessReadyGetter() : false,
        };
    }

    private async runStartupRefresh(): Promise<void> {
        try {
            await this.cleanupManagedAppData();
            const result = await this.scanManagedRuntime();
            this.logInfo(
                `Managed runtime scan finished: ready=${result.summary.ready}, installRequired=${result.summary.installRequired}, failed=${result.summary.failed}`
            );
            if (result.summary.installRequired > 0) {
                this.logInfo(`Found ${result.summary.installRequired} missing managed dependencies. Starting background installation...`);
                const installResult = await this.ensureManagedRuntime();
                this.logInfo(`Background installation complete. Installed: ${installResult.summary.installed}, Failed: ${installResult.summary.failed}`);
            }
        } catch (error) {
            this.logError('Managed runtime scan failed', error);
        }
    }

    private async cleanupManagedAppData(): Promise<void> {
        const userDataRoot = app.getPath('userData');
        await this.removeStaleElectronCaches(userDataRoot);
        await this.removeLegacyServiceArtifacts(userDataRoot);
        await this.removeExpiredTerminalLogs(userDataRoot);
    }

    private async removeStaleElectronCaches(userDataRoot: string): Promise<void> {
        for (const directoryName of STALE_ELECTRON_CACHE_DIRECTORIES) {
            await this.removePathIfPresent(path.join(userDataRoot, directoryName));
        }
    }

    private async removeLegacyServiceArtifacts(userDataRoot: string): Promise<void> {
        const servicesDir = path.join(userDataRoot, 'services');
        for (const fileName of LEGACY_SERVICE_ARTIFACTS) {
            await this.removePathIfPresent(path.join(servicesDir, fileName));
        }
    }

    private async removeExpiredTerminalLogs(userDataRoot: string): Promise<void> {
        const terminalLogsDir = path.join(userDataRoot, 'terminal-logs');
        try {
            const entries = await fsPromises.readdir(terminalLogsDir, { withFileTypes: true });
            const now = Date.now();
            for (const entry of entries) {
                if (!entry.isFile() || !entry.name.endsWith('.log')) {
                    continue;
                }
                const filePath = path.join(terminalLogsDir, entry.name);
                const stat = await fsPromises.stat(filePath);
                if (now - stat.mtimeMs <= TERMINAL_LOG_RETENTION_MS) {
                    continue;
                }
                await fsPromises.unlink(filePath);
            }
        } catch {
            // Missing terminal log directory is fine.
        }
    }

    private async removePathIfPresent(targetPath: string): Promise<void> {
        try {
            await fsPromises.rm(targetPath, { recursive: true, force: true });
        } catch (error) {
            if (this.isIgnorableCleanupError(error as Error)) {
                this.logDebug(`Skipping managed app-data cleanup for locked artifact at ${targetPath}`);
                return;
            }
            this.logWarn(
                `Failed to remove managed app-data artifact at ${targetPath}`,
                error instanceof Error ? error : undefined
            );
        }
    }

    private isIgnorableCleanupError(error: Error | { code?: string } | null): boolean {
        if (!(error instanceof Error)) {
            return false;
        }

        const cleanupError = error as Error & { code?: string };
        return typeof cleanupError.code === 'string' && IGNORABLE_CLEANUP_ERROR_CODES.has(cleanupError.code);
    }

    private async cacheManifest(manifestText: string): Promise<void> {
        const manifestPath = path.join(getManagedRuntimeManifestsDir(), 'runtime-manifest.json');
        await fsPromises.mkdir(path.dirname(manifestPath), { recursive: true });
        await fsPromises.writeFile(manifestPath, manifestText, 'utf8');
    }

    private async executePlan(plan: RuntimeBootstrapPlan): Promise<RuntimeBootstrapExecutionEntry[]> {
        const results: RuntimeBootstrapExecutionEntry[] = [];
        for (const entry of plan.entries) {
            results.push(await this.executeEntry(entry));
        }
        return results;
    }

    private scanPlan(plan: RuntimeBootstrapPlan): RuntimeBootstrapExecutionEntry[] {
        return plan.entries.map(entry => {
            if (entry.status === 'ready') {
                return this.createExecutionEntry(entry, 'ready');
            }
            if (entry.status === 'external') {
                return this.createExecutionEntry(entry, 'external');
            }
            if (entry.status === 'unsupported') {
                return this.createExecutionEntry(entry, 'unsupported');
            }

            return this.createExecutionEntry(entry, 'install-required', undefined, 'Managed runtime install required');
        });
    }

    private async executeEntry(
        entry: RuntimeBootstrapPlan['entries'][number]
    ): Promise<RuntimeBootstrapExecutionEntry> {
        if (entry.status === 'ready') {
            return this.createExecutionEntry(entry, 'ready');
        }
        if (entry.status === 'external') {
            return this.createExecutionEntry(entry, 'external');
        }
        if (entry.status === 'unsupported' || !entry.target || !entry.installPath) {
            return this.createExecutionEntry(entry, 'unsupported');
        }

        try {
            const downloadedAssetPath = await this.downloadTarget(entry.target);
            await this.installTarget(downloadedAssetPath, entry.target, entry.installPath);
            return this.createExecutionEntry(entry, 'installed', downloadedAssetPath);
        } catch (error) {
            this.logError(`Installation failed for ${entry.componentId}:`, error);
            return {
                ...this.createExecutionEntry(entry, 'failed'),
                error: error instanceof Error ? error.message : 'Unknown runtime bootstrap failure',
            };
        }
    }

    private createExecutionEntry(
        entry: RuntimeBootstrapPlan['entries'][number],
        status: RuntimeBootstrapExecutionEntry['status'],
        downloadedAssetPath?: string,
        error?: string
    ): RuntimeBootstrapExecutionEntry {
        return {
            componentId: entry.componentId,
            displayName: entry.displayName,
            version: entry.version,
            status,
            requirement: entry.requirement,
            source: entry.source,
            installPath: entry.installPath,
            downloadedAssetPath,
            installUrl: entry.installUrl,
            error,
        };
    }

    private async downloadTarget(target: RuntimeManifestTarget): Promise<string> {
        this.validateDownloadUrl(target.downloadUrl);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minute timeout for large binary downloads
        try {
            this.logInfo(`Starting download for ${target.assetName}...`);
            const response = await fetch(target.downloadUrl, {
                redirect: 'follow',
                signal: controller.signal,
            });
            if (!response.ok) {
                this.logError(`Download rejected by server: HTTP ${response.status} ${response.statusText} for ${target.downloadUrl}`);
                throw new Error(`error.llm.download_failed: HTTP ${response.status}`);
            }
            
            const totalBytes = Number(response.headers.get('content-length')) || 0;
            const chunks = await this.readResponseStream(response, target.assetName, totalBytes);
            
            this.logInfo(`Download complete for ${target.assetName}`);
            const buffer = Buffer.concat(chunks);

            const downloadPath = path.join(getManagedRuntimeDownloadsDir(), target.assetName);
            this._performChecksumVerification(buffer, target.sha256, target.assetName);
            await fsPromises.mkdir(path.dirname(downloadPath), { recursive: true });
            await fsPromises.writeFile(downloadPath, buffer);
            return downloadPath;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private _performChecksumVerification(data: Buffer, expectedSha256: string, assetName: string): void {
        if (!expectedSha256) {
            this.logInfo(`Skipping checksum verification for ${assetName} (no hash provided)`);
            return;
        }
        const hash = crypto.createHash('sha256');
        hash.update(data);
        const digest = hash.digest('hex');
        if (digest !== expectedSha256.toLowerCase()) {
            this.logError(`Checksum mismatch for ${assetName}. Expected: ${expectedSha256}, Got: ${digest}. Downloaded file size: ${data.length} bytes.`);
            throw new Error('error.terminal.hash_verification_failed');
        }
    }

    private async installTarget(
        downloadPath: string,
        target: RuntimeManifestTarget,
        installPath: string
    ): Promise<void> {
        const installRoot = this.resolveInstallRoot(target.installSubdirectory);
        await fsPromises.mkdir(installRoot, { recursive: true });
        if (target.archiveFormat === 'raw') {
            await fsPromises.copyFile(downloadPath, installPath);
        } else {
            await this.extractArchive(downloadPath, installRoot);
        }
        await this.ensureExecutable(installPath, target.installSubdirectory);
        await fsPromises.unlink(downloadPath).catch(() => Promise.resolve());
    }

    private async extractArchive(downloadPath: string, installRoot: string): Promise<void> {
        const lowerPath = downloadPath.toLowerCase();
        if (lowerPath.endsWith('.zip')) {
            await this.extractZip(downloadPath, installRoot);
            return;
        }
        if (lowerPath.endsWith('.tar.gz') || lowerPath.endsWith('.tgz')) {
            await this.runProcess('tar', ['-xzf', downloadPath, '-C', installRoot]);
            return;
        }
        throw new Error('error.terminal.unsupported');
    }

    private async extractZip(downloadPath: string, installRoot: string): Promise<void> {
        if (process.platform === 'win32') {
            const command = `Expand-Archive -Path "${downloadPath.replace(/"/g, '""')}" -DestinationPath "${installRoot.replace(/"/g, '""')}" -Force`;
            await this.runProcess('powershell', ['-NoProfile', '-Command', command]);
            return;
        }
        await this.runProcess('unzip', ['-o', downloadPath, '-d', installRoot]);
    }

    private async runProcess(command: string, args: string[]): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            const child = spawn(command, args, { shell: false, windowsHide: true });
            child.on('error', reject);
            child.on('close', code => {
                if (code === 0) {
                    resolve();
                    return;
                }
                reject(new Error('error.process.exit_failed'));
            });
        });
    }

    private async ensureExecutable(installPath: string, subdirectory: RuntimeInstallSubdirectory): Promise<void> {
        if (process.platform === 'win32' || subdirectory !== 'bin') {
            return;
        }
        await fsPromises.chmod(installPath, 0o755);
    }

    private validateDownloadUrl(url: string): void {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') {
            throw new Error('error.system.https_required');
        }
        if (!this.allowedDownloadHosts.has(parsed.hostname.toLowerCase())) {
            throw new Error('error.system.https_required');
        }
    }

    private buildHealthPlan(
        plan: RuntimeBootstrapPlan,
        entries: RuntimeBootstrapExecutionEntry[]
    ): RuntimeBootstrapPlan {
        const resultById = new Map(entries.map(entry => [entry.componentId, entry]));
        return {
            ...plan,
            entries: plan.entries.map(entry => {
                const result = resultById.get(entry.componentId);
                if (!result?.installPath) {
                    return entry;
                }
                return {
                    ...entry,
                    installPath: result.installPath,
                };
            }),
        };
    }

    private buildExecutionResult(
        plan: RuntimeBootstrapPlan,
        entries: RuntimeBootstrapExecutionEntry[],
        health: RuntimeBootstrapExecutionResult['health']
    ): RuntimeBootstrapExecutionResult {
        return {
            manifestVersion: plan.manifestVersion,
            environment: plan.environment,
            entries,
            summary: {
                ready: entries.filter(entry => entry.status === 'ready').length,
                installed: entries.filter(entry => entry.status === 'installed').length,
                installRequired: entries.filter(entry => entry.status === 'install-required').length,
                failed: entries.filter(entry => entry.status === 'failed').length,
                external: entries.filter(entry => entry.status === 'external').length,
                unsupported: entries.filter(entry => entry.status === 'unsupported').length,
                blockingFailures: entries.filter(
                    entry =>
                        (entry.status === 'failed' || entry.status === 'install-required') &&
                        entry.requirement === 'required'
                ).length,
            },
            health,
        };
    }

    private async readResponseStream(
        response: Response,
        assetName: string,
        totalBytes: number
    ): Promise<Uint8Array[]> {
        const chunks: Uint8Array[] = [];
        if (!response.body) {
            const arrayBuffer = await response.arrayBuffer();
            chunks.push(new Uint8Array(arrayBuffer));
            return chunks;
        }

        let downloadedBytes = 0;
        let lastLogTime = Date.now();
        const reader = response.body.getReader();

        // NASA Rule 2: Limit unbounded loops
        const MAX_CHUNKS = 1000000;
        for (let i = 0; i < MAX_CHUNKS; i++) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            if (value) {
                chunks.push(value);
                downloadedBytes += value.length;

                const now = Date.now();
                if (now - lastLogTime > 2000) {
                    this.logDownloadProgress(assetName, downloadedBytes, totalBytes);
                    lastLogTime = now;
                }
            }
        }
        return chunks;
    }

    private logDownloadProgress(assetName: string, downloadedBytes: number, totalBytes: number): void {
        const downloadedMb = (downloadedBytes / 1024 / 1024).toFixed(2);
        if (totalBytes > 0) {
            const percent = Math.round((downloadedBytes / totalBytes) * 100);
            const totalMb = (totalBytes / 1024 / 1024).toFixed(2);
            this.logInfo(`Downloading ${assetName}: ${percent}% (${downloadedMb} MB / ${totalMb} MB)`);
        } else {
            this.logInfo(`Downloading ${assetName}: ${downloadedMb} MB`);
        }
    }

    private resolveInstallPath(target: RuntimeManifestTarget): string {
        return path.join(
            this.resolveInstallRoot(target.installSubdirectory),
            target.executableRelativePath
        );
    }

    private resolveInstallRoot(subdirectory: RuntimeInstallSubdirectory): string {
        switch (subdirectory) {
            case 'bin':
                return getManagedRuntimeBinDir();
            case 'models':
                return getManagedRuntimeModelsDir();
            case 'temp':
                return getManagedRuntimeTempDir();
        }
    }

    // --- IPC Decorated Methods ---

    public setMainProcessReadyGetter(getter: () => boolean): void {
        this.isMainProcessReadyGetter = getter;
    }

    @ipc(RUNTIME_CHANNELS.GET_STATUS)
    async getStatusIpc(): Promise<RuntimeValue> {
        const result = this.getLatestExecutionResult();
        if (result) {
            result.mainProcessReady = this.isMainProcessReadyGetter ? this.isMainProcessReadyGetter() : true;
        }
        return serializeToIpc(result);
    }

    @ipc(RUNTIME_CHANNELS.REFRESH_STATUS)
    async refreshStatusIpc(): Promise<RuntimeValue> {
        const result = await this.scanManagedRuntime();
        return serializeToIpc(result);
    }

    @ipc(RUNTIME_CHANNELS.REPAIR)
    async repairIpc(manifestUrl: RuntimeValue): Promise<RuntimeValue> {
        const result = await this.ensureManagedRuntime(typeof manifestUrl === 'string' ? manifestUrl : undefined);
        return serializeToIpc(result);
    }

    @ipc(RUNTIME_CHANNELS.RUN_COMPONENT_ACTION)
    async runComponentActionIpc(componentId: RuntimeValue): Promise<RuntimeValue> {
        if (typeof componentId !== 'string') {
            throw new Error('componentId must be a string');
        }
        const result = await this.runComponentAction(componentId);
        return serializeToIpc(result);
    }
}


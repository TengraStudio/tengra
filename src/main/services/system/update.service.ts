/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { ipc } from '@main/core/ipc-decorators';
import { BaseService } from '@main/services/base.service';
import { getManagedRuntimeTempDir } from '@main/services/system/runtime-path.service';
import { SettingsService } from '@main/services/system/settings.service';
import { UPDATE_CHANNELS } from '@shared/constants/ipc-channels';
import { app, BrowserWindow } from 'electron';

type UpdateState =
    | 'checking'
    | 'available'
    | 'downloading'
    | 'downloaded'
    | 'not-available'
    | 'error'
    | 'warning';

type GithubReleaseAsset = {
    name: string;
    browser_download_url: string;
    size: number;
};

type GithubRelease = {
    tag_name: string;
    name?: string;
    body?: string;
    html_url: string;
    published_at?: string;
    assets: GithubReleaseAsset[];
};

type UpdaterStatus = {
    state: UpdateState;
    version?: string;
    progress?: number;
    bytesPerSecond?: number;
    total?: number;
    transferred?: number;
    error?: string;
    warning?: string;
};

export class UpdateService extends BaseService {
    private settingsService: SettingsService;
    private window: BrowserWindow | null = null;
    private isSupported = true;
    private latestRelease: GithubRelease | null = null;
    private downloadedAssetPath: string | null = null;
    private downloadedAssetName: string | null = null;

    constructor(settingsService: SettingsService) {
        super('UpdateService');
        this.settingsService = settingsService;
        this.isSupported = process.env.NODE_ENV === 'test' || app.isPackaged;
    }

    override async cleanup(): Promise<void> {
        this.window = null;
    }

    init(window: BrowserWindow) {
        this.window = window;

        if (!this.isSupported) {
            this.logDebug('Skipping update checks in development mode');
            return;
        }

        const settings = this.settingsService.getSettings();
        if (settings.autoUpdate?.enabled && settings.autoUpdate.checkOnStartup) {
            setTimeout(() => {
                void this.checkForUpdates().catch(error => {
                    this.handleError(error);
                });
            }, 5000);
        }
    }

    @ipc(UPDATE_CHANNELS.CHECK)
    async checkForUpdatesIpc(): Promise<{ success: boolean; version?: string; available: boolean; releaseNotes?: string; error?: string }> {
        const result = await this.checkForUpdates();
        if (!result) {
            return { success: false, available: false, error: 'Update check failed' };
        }

        return {
            success: true,
            available: result.available,
            version: result.version,
            releaseNotes: result.releaseNotes,
        };
    }

    @ipc(UPDATE_CHANNELS.DOWNLOAD)
    async downloadUpdateIpc(): Promise<{ success: boolean; error?: string }> {
        try {
            const result = await this.downloadUpdate();
            return { success: result };
        } catch (error) {
            return { success: false, error: this.toMessage(error) };
        }
    }

    @ipc(UPDATE_CHANNELS.INSTALL)
    async quitAndInstallIpc(): Promise<{ success: boolean; error?: string }> {
        try {
            await this.quitAndInstall();
            return { success: true };
        } catch (error) {
            return { success: false, error: this.toMessage(error) };
        }
    }

    async checkForUpdates(): Promise<{ available: boolean; version?: string; releaseNotes?: string } | null> {
        if (!this.isSupported) {
            this.sendStatus({ state: 'warning', warning: 'Updates are disabled in this build' });
            return null;
        }

        this.sendStatus({ state: 'checking' });

        try {
            const release = await this.fetchLatestRelease();
            const currentVersion = this.normalizeVersion(app.getVersion());
            const latestVersion = this.normalizeVersion(release.tag_name);

            this.latestRelease = release;

            if (!latestVersion || !currentVersion || this.compareVersions(latestVersion, currentVersion) <= 0) {
                this.sendStatus({ state: 'not-available' });
                return { available: false };
            }

            this.sendStatus({ state: 'available', version: latestVersion });
            return {
                available: true,
                version: latestVersion,
                releaseNotes: release.body ?? '',
            };
        } catch (error) {
            this.handleError(error);
            return null;
        }
    }

    async downloadUpdate(): Promise<boolean> {
        if (!this.latestRelease) {
            const checked = await this.checkForUpdates();
            if (!checked?.available) {
                return false;
            }
        }

        const release = this.latestRelease;
        if (!release) {
            throw new Error('No release metadata is available');
        }

        const asset = this.pickReleaseAsset(release);
        if (!asset) {
            throw new Error('No downloadable release asset was found');
        }

        const downloadDir = getManagedRuntimeTempDir();
        const outputPath = path.join(downloadDir, asset.name);

        this.sendStatus({ state: 'downloading', version: this.normalizeVersion(release.tag_name) ?? undefined, progress: 0 });

        await this.downloadFile(asset.browser_download_url, outputPath, asset.size);
        this.downloadedAssetPath = outputPath;
        this.downloadedAssetName = asset.name;
        this.sendStatus({ state: 'downloaded', version: this.normalizeVersion(release.tag_name) ?? undefined });
        return true;
    }

    async quitAndInstall(): Promise<void> {
        const executablePath = app.getPath('exe');
        const release = this.latestRelease;
        if (!release) {
            throw new Error('No release metadata is available');
        }

        const asset = this.pickReleaseAsset(release);
        const downloadedAssetPath = this.downloadedAssetPath ?? (asset ? path.join(getManagedRuntimeTempDir(), asset.name) : null);
        if (!downloadedAssetPath || !fs.existsSync(downloadedAssetPath)) {
            throw new Error('The update has not been downloaded yet');
        }

        const helperScript = this.resolveUpdaterScriptPath();
        if (!helperScript) {
            throw new Error('Updater helper script was not found');
        }

        const helperArgs = this.buildHelperArgs(helperScript, downloadedAssetPath, executablePath);
        const helperCommand = process.platform === 'win32' && helperScript.endsWith('.ps1')
            ? 'powershell'
            : process.execPath;

        const child = spawn(helperCommand, helperArgs, {
            detached: true,
            stdio: 'ignore',
            windowsHide: true,
            env: helperScript.endsWith('.js')
                ? { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
                : process.env,
        });

        child.unref();

        this.sendStatus({ state: 'checking' });
        app.quit();
    }

    private resolveUpdaterScriptPath(): string | null {
        const candidates = [
            ...(process.platform === 'win32'
                ? [
                    path.join(process.resourcesPath || '', 'updater', 'tengra-updater.ps1'),
                    path.join(app.getAppPath(), 'assets', 'updater', 'tengra-updater.ps1'),
                    path.join(process.cwd(), 'assets', 'updater', 'tengra-updater.ps1'),
                ]
                : [
                    path.join(process.resourcesPath || '', 'updater', 'tengra-updater.js'),
                    path.join(app.getAppPath(), 'assets', 'updater', 'tengra-updater.js'),
                    path.join(process.cwd(), 'assets', 'updater', 'tengra-updater.js'),
                ]),
        ];

        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }

        return null;
    }

    private buildHelperArgs(helperScript: string, sourcePath: string, targetPath: string): string[] {
        if (helperScript.endsWith('.ps1')) {
            return [
                '-NoProfile',
                '-ExecutionPolicy',
                'Bypass',
                '-File',
                helperScript,
                '-ProcessId',
                String(process.pid),
                '-SourcePath',
                sourcePath,
                '-TargetPath',
                targetPath,
                '-LaunchAfter',
                targetPath,
            ];
        }

        return [
            helperScript,
            '--process-id',
            String(process.pid),
            '--source-path',
            sourcePath,
            '--target-path',
            targetPath,
            '--launch-after',
            targetPath,
        ];
    }

    private async fetchLatestRelease(): Promise<GithubRelease> {
        const response = await fetch('https://api.github.com/repos/TengraStudio/tengra/releases/latest', {
            headers: {
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'Tengra-Updater',
            },
        });

        if (!response.ok) {
            throw new Error(`GitHub release lookup failed with status ${response.status}`);
        }

        return await response.json() as GithubRelease;
    }

    private pickReleaseAsset(release: GithubRelease): GithubReleaseAsset | null {
        const platform = process.platform;
        const allowedExtensions = platform === 'win32'
            ? ['.exe', '.zip']
            : platform === 'darwin'
                ? ['.dmg', '.zip']
                : ['.appimage', '.deb', '.rpm', '.zip'];

        const preferred = release.assets.find(asset => {
            const lowerName = asset.name.toLowerCase();
            return allowedExtensions.some(extension => lowerName.endsWith(extension));
        });

        return preferred ?? null;
    }

    private async downloadFile(url: string, outputPath: string, expectedSize?: number): Promise<void> {
        const response = await fetch(url);
        if (!response.ok || !response.body) {
            throw new Error(`Failed to download update: ${response.status}`);
        }

        fs.mkdirSync(path.dirname(outputPath), { recursive: true });

        const total = expectedSize ?? Number(response.headers.get('content-length') ?? 0);
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(outputPath, buffer);
        this.sendStatus({
            state: 'downloading',
            progress: total > 0 ? 100 : undefined,
            bytesPerSecond: undefined,
            total,
            transferred: buffer.byteLength,
        });
    }

    private normalizeVersion(version: string): string | null {
        const cleaned = version.trim().replace(/^v/i, '');
        return cleaned.length > 0 ? cleaned : null;
    }

    private compareVersions(left: string, right: string): number {
        const parse = (value: string) => value.split('.').map(part => Number.parseInt(part, 10) || 0);
        const [a1, a2 = 0, a3 = 0] = parse(left);
        const [b1, b2 = 0, b3 = 0] = parse(right);
        if (a1 !== b1) { return a1 - b1; }
        if (a2 !== b2) { return a2 - b2; }
        return a3 - b3;
    }

    private sendStatus(status: UpdaterStatus): void {
        if (this.window && !this.window.isDestroyed()) {
            this.window.webContents.send('update:status', status);
        }
    }

    private handleError(error: unknown): void {
        const message = this.toMessage(error);
        this.logError('Update error', error);
        this.sendStatus({ state: 'error', error: message });
    }

    private toMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }

        return String(error);
    }
}


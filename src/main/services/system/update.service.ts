
import { DataService } from '@main/services/data/data.service';
import { SettingsService } from '@main/services/system/settings.service';
import { IpcValue } from '@shared/types';
import { getErrorMessage } from '@shared/utils/error.util';
import { app, BrowserWindow, ipcMain } from 'electron';
import log from 'electron-log';
import { autoUpdater } from 'electron-updater';

export class UpdateService {
    private settingsService: SettingsService;
    private window: BrowserWindow | null = null;

    constructor(
        settingsService: SettingsService,
        dataService: DataService
    ) {
        this.settingsService = settingsService;

        // Configure electron-log
        log.transports.file.level = 'info';
        log.transports.file.resolvePathFn = () => dataService.getPath('logs') + '/update.log';
        autoUpdater.logger = log;

        // Disable auto-download if configured (we'll handle it manually based on settings)
        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = true;
    }

    init(window: BrowserWindow) {
        this.window = window;

        // Don't run in development unless forced
        if (!app.isPackaged && !process.env.FORCE_UPDATE_TEST) {
            log.info('Skipping auto-updater in development mode');
            return;
        }

        this.registerEvents();
        this.registerIpcHandlers();

        const settings = this.settingsService.getSettings();
        if (settings.autoUpdate?.enabled && settings.autoUpdate?.checkOnStartup) {
            // Delay check slightly to not slow down startup
            setTimeout(() => {
                void this.checkForUpdates();
            }, 5000);
        }
    }

    private registerEvents() {
        autoUpdater.on('checking-for-update', () => {
            this.sendToWindow('update:status', { state: 'checking' });
        });

        autoUpdater.on('update-available', (info) => {
            log.info('Update available:', info);
            this.sendToWindow('update:status', { state: 'available', version: info.version });

            const settings = this.settingsService.getSettings();
            if (settings.autoUpdate?.downloadAutomatically && !settings.autoUpdate?.notifyOnly) {
                void this.downloadUpdate();
            }
        });

        autoUpdater.on('update-not-available', (info) => {
            log.info('Update not available:', info);
            this.sendToWindow('update:status', { state: 'not-available' });
        });

        autoUpdater.on('error', (err) => {
            console.error('Update error:', err);
            this.sendToWindow('update:status', { state: 'error', error: err.message });
        });

        autoUpdater.on('download-progress', (progressObj) => {
            // log.info('Download speed: ' + progressObj.bytesPerSecond + ...)

            this.sendToWindow('update:status', {
                state: 'downloading',
                progress: progressObj.percent,
                bytesPerSecond: progressObj.bytesPerSecond,
                total: progressObj.total,
                transferred: progressObj.transferred
            });
        });

        autoUpdater.on('update-downloaded', (info) => {
            log.info('Update downloaded');
            this.sendToWindow('update:status', { state: 'downloaded', version: info.version });
        });
    }

    private registerIpcHandlers() {
        ipcMain.handle('update:check', async () => {
            return await this.checkForUpdates();
        });

        ipcMain.handle('update:download', async () => {
            return await this.downloadUpdate();
        });

        ipcMain.handle('update:install', () => {
            this.quitAndInstall();
        });
    }

    async checkForUpdates() {
        try {
            await autoUpdater.checkForUpdates();
        } catch (error) {
            log.error('Failed to check for updates', getErrorMessage(error as Error));
            throw error;
        }
    }

    async downloadUpdate() {
        try {
            await autoUpdater.downloadUpdate();
        } catch (error) {
            log.error('Failed to download update', getErrorMessage(error as Error));
            throw error;
        }
    }

    quitAndInstall() {
        autoUpdater.quitAndInstall();
    }

    private sendToWindow(channel: string, ...args: IpcValue[]) {
        if (this.window && !this.window.isDestroyed()) {
            this.window.webContents.send(channel, ...args);
        }
    }
}

/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { BaseService } from '@main/services/base.service';
import { app, BrowserWindow } from 'electron';

import { EventBusService } from './event-bus.service';
import { SettingsService } from './settings.service';

export class PowerManagerService extends BaseService {
    private isLowPowerModeActive = false;
    private isHibernating = false;
    private hibernationTimeout: NodeJS.Timeout | null = null;
    private readonly HIBERNATION_DELAY_MS = 10 * 60 * 1000; // 10 minutes

    constructor(
        private settingsService: SettingsService,
        private eventBus: EventBusService
    ) {
        super('PowerManagerService');
    }

    async initialize(): Promise<void> {
        this.logInfo('Initializing PowerManagerService...');
        
        app.on('browser-window-blur', () => this.handleWindowBlur());
        app.on('browser-window-focus', () => this.handleWindowFocus());

        // We'll hook into window show/hide events once the window is created
        app.on('browser-window-created', (_event, window) => {
            window.on('show', () => this.handleWindowFocus());
            window.on('hide', () => this.handleWindowBlur());
            window.on('minimize', () => this.handleWindowBlur());
            window.on('restore', () => this.handleWindowFocus());
        });
        
        this.logInfo('PowerManagerService initialized');
    }

    private handleWindowBlur() {
        if (this.hasInteractiveWindow()) {
            return;
        }
        const settings = this.settingsService.getSettings();
        if (settings.window?.lowPowerMode) {
            this.enterLowPowerMode();
        }
        
        if (settings.window?.autoHibernation) {
            this.startHibernationTimer();
        }
    }

    private handleWindowFocus() {
        if (!this.hasInteractiveWindow()) {
            return;
        }
        this.exitLowPowerMode();
        this.cancelHibernation();
        if (this.isHibernating) {
            this.resumeHibernatedServices();
        }
    }

    private enterLowPowerMode() {
        if (this.isLowPowerModeActive) {return;}
        this.isLowPowerModeActive = true;
        this.logInfo('Entering low power mode...');
        
        // 1. Tell all browser windows to throttle
        BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) {
                win.webContents.setBackgroundThrottling(true);
                win.webContents.setAudioMuted(true);
                win.webContents.send('power:state-changed', { lowPowerMode: true });
            }
        });

        // 2. Broadcast event
        this.eventBus.emit('power:state-changed', { isLowPowerMode: true });
        this.eventBus.emitCustom('power:low-power-entry', { timestamp: Date.now() });
        
        // 3. Lower process priority for child processes (if possible via ProcessManager)
        // This is a future enhancement for ProcessManagerService
    }

    private exitLowPowerMode() {
        if (!this.isLowPowerModeActive) {return;}
        this.isLowPowerModeActive = false;
        this.logInfo('Exiting low power mode...');
        
        BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) {
                win.webContents.setBackgroundThrottling(false);
                win.webContents.setAudioMuted(false);
                win.webContents.send('power:state-changed', { lowPowerMode: false });
            }
        });

        this.eventBus.emit('power:state-changed', { isLowPowerMode: false });
        this.eventBus.emitCustom('power:low-power-exit', { timestamp: Date.now() });
    }

    private startHibernationTimer() {
        this.cancelHibernation();
        this.logInfo('Starting hibernation timer...');
        this.hibernationTimeout = setTimeout(() => {
            this.hibernateServices();
        }, this.HIBERNATION_DELAY_MS);
    }

    private cancelHibernation() {
        if (this.hibernationTimeout) {
            clearTimeout(this.hibernationTimeout);
            this.hibernationTimeout = null;
        }
    }

    private hibernateServices() {
        if (this.isHibernating) {
            return;
        }
        this.isHibernating = true;
        this.logInfo('Hibernating background services due to inactivity...');
        // Only hibernate truly non-critical heavy services.
        this.eventBus.emitCustom('power:hibernation-start', { timestamp: Date.now() });
    }

    private resumeHibernatedServices() {
        if (!this.isHibernating) {
            return;
        }
        this.isHibernating = false;
        this.logInfo('Resuming services from hibernation...');
        this.eventBus.emitCustom('power:hibernation-stop', { timestamp: Date.now() });
    }

    private hasInteractiveWindow(): boolean {
        const windows = BrowserWindow.getAllWindows().filter(window => !window.isDestroyed());
        if (windows.length === 0) {
            return false;
        }
        return windows.some(window => window.isFocused() || window.isVisible());
    }

    async cleanup(): Promise<void> {
        this.cancelHibernation();
    }

    isLowPowerMode(): boolean {
        return this.isLowPowerModeActive;
    }
}


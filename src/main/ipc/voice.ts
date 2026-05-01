/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@main/logging/logger';
import { getVoiceService } from '@main/services/ui/voice.service';
import { VoiceCommand, VoiceSettings, VoiceSynthesisOptions } from '@shared/types/voice';
import { ipcMain } from 'electron';

let isVoiceIpcRegistered = false;

/**
 * Registers voice IPC channels.
 * Handlers are declared here to be visible to static analysis contract tests.
 */
export const registerVoiceIpc = (): void => {
    if (isVoiceIpcRegistered) {
        return;
    }
    isVoiceIpcRegistered = true;

    const voiceService = getVoiceService();

    // Handlers call the service's handleX methods which include retry logic and telemetry
    ipcMain.handle('voice:get-settings', async () => await voiceService.handleGetSettings());
    ipcMain.handle('voice:update-settings', async (event, settings: Partial<VoiceSettings>) => await voiceService.handleUpdateSettings(event, settings));
    ipcMain.handle('voice:get-commands', async () => await voiceService.handleGetCommands());
    ipcMain.handle('voice:add-command', async (event, command: VoiceCommand) => await voiceService.handleAddCommand(event, command));
    ipcMain.handle('voice:remove-command', async (event, commandId: string) => await voiceService.handleRemoveCommand(event, commandId));
    ipcMain.handle('voice:update-command', async (event, command: VoiceCommand) => await voiceService.handleUpdateCommand(event, command));
    ipcMain.handle('voice:process-transcript', async (event, transcript: string) => await voiceService.handleProcessTranscript(event, transcript));
    ipcMain.handle('voice:execute-command', async (event, command: VoiceCommand) => await voiceService.handleExecuteCommand(event, command));
    ipcMain.handle('voice:get-voices', async () => await voiceService.handleGetVoices());
    ipcMain.handle('voice:synthesize', async (event, options: VoiceSynthesisOptions) => await voiceService.handleSynthesize(event, options));
    ipcMain.handle('voice:stop-speaking', async () => await voiceService.handleStopSpeaking());
    ipcMain.handle('voice:set-listening', async (event, listening: boolean) => await voiceService.handleSetListening(event, listening));
    ipcMain.handle('voice:send-event', async (event, eventType: any, data: any) => await voiceService.handleSendEvent(event, eventType, data));
    ipcMain.handle('voice:health', async () => await voiceService.handleHealth());

    appLogger.debug('VoiceIPC', 'Voice IPC handlers registered in main process');
};

export const registerVoiceHandlers = registerVoiceIpc;

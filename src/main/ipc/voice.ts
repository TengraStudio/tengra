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

let isVoiceIpcRegistered = false;

/**
 * Registers voice IPC channels through VoiceService initialization.
 */
export const registerVoiceIpc = (): void => {
    if (isVoiceIpcRegistered) {
        return;
    }
    isVoiceIpcRegistered = true;

    const voiceService = getVoiceService();
    void voiceService.initialize().catch(error => {
        appLogger.error('VoiceIPC', 'Failed to initialize voice IPC handlers', error as Error);
        isVoiceIpcRegistered = false;
    });
};

export const registerVoiceHandlers = registerVoiceIpc;

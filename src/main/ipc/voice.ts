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

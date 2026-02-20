/**
 * Voice Service - Main process service for voice recognition and synthesis
 * Implements UI-11: Voice-first interface option
 */

import { BaseService } from '@main/services/base.service';
import {
    DEFAULT_VOICE_COMMANDS,
    DEFAULT_VOICE_SETTINGS,
    VoiceCommand,
    VoiceEvent,
    VoiceEventType,
    VoiceInfo,
    VoiceRecognitionResult,
    VoiceSettings,
    VoiceSynthesisOptions,
} from '@shared/types/voice';
import { BrowserWindow, ipcMain } from 'electron';

/** Voice service state */
interface VoiceServiceState {
    settings: VoiceSettings;
    commands: VoiceCommand[];
    isListening: boolean;
    isSpeaking: boolean;
    wakeWordDetected: boolean;
    mainWindow: BrowserWindow | null;
}

/**
 * Voice Service
 * Handles speech recognition, synthesis, and command processing
 * Note: Actual speech recognition/synthesis happens in renderer via Web Speech API
 * This service coordinates state and handles command execution
 */
export class VoiceService extends BaseService {
    private state: VoiceServiceState = {
        settings: { ...DEFAULT_VOICE_SETTINGS },
        commands: [...DEFAULT_VOICE_COMMANDS],
        isListening: false,
        isSpeaking: false,
        wakeWordDetected: false,
        mainWindow: null,
    };

    constructor() {
        super('VoiceService');
    }

    override async initialize(): Promise<void> {
        this.logInfo('Initializing Voice Service...');
        this.setupIpcHandlers();
        this.logInfo('Voice Service initialized successfully');
    }

    override async cleanup(): Promise<void> {
        this.logInfo('Cleaning up Voice Service...');
        this.removeIpcHandlers();
        this.state.mainWindow = null;
        this.logInfo('Voice Service cleaned up');
    }

    /** Set the main window reference for sending events */
    setMainWindow(window: BrowserWindow): void {
        this.state.mainWindow = window;
    }

    /** Setup IPC handlers for voice operations */
    private setupIpcHandlers(): void {
        ipcMain.handle('voice:get-settings', this.handleGetSettings.bind(this));
        ipcMain.handle('voice:update-settings', this.handleUpdateSettings.bind(this));
        ipcMain.handle('voice:get-commands', this.handleGetCommands.bind(this));
        ipcMain.handle('voice:add-command', this.handleAddCommand.bind(this));
        ipcMain.handle('voice:remove-command', this.handleRemoveCommand.bind(this));
        ipcMain.handle('voice:update-command', this.handleUpdateCommand.bind(this));
        ipcMain.handle('voice:process-transcript', this.handleProcessTranscript.bind(this));
        ipcMain.handle('voice:execute-command', this.handleExecuteCommand.bind(this));
        ipcMain.handle('voice:get-voices', this.handleGetVoices.bind(this));
        ipcMain.handle('voice:synthesize', this.handleSynthesize.bind(this));
        ipcMain.handle('voice:stop-speaking', this.handleStopSpeaking.bind(this));
        ipcMain.handle('voice:set-listening', this.handleSetListening.bind(this));
        ipcMain.handle('voice:send-event', this.handleSendEvent.bind(this));
    }

    /** Remove IPC handlers */
    private removeIpcHandlers(): void {
        ipcMain.removeHandler('voice:get-settings');
        ipcMain.removeHandler('voice:update-settings');
        ipcMain.removeHandler('voice:get-commands');
        ipcMain.removeHandler('voice:add-command');
        ipcMain.removeHandler('voice:remove-command');
        ipcMain.removeHandler('voice:update-command');
        ipcMain.removeHandler('voice:process-transcript');
        ipcMain.removeHandler('voice:execute-command');
        ipcMain.removeHandler('voice:get-voices');
        ipcMain.removeHandler('voice:synthesize');
        ipcMain.removeHandler('voice:stop-speaking');
        ipcMain.removeHandler('voice:set-listening');
        ipcMain.removeHandler('voice:send-event');
    }

    // Public API Methods

    getSettings(): { success: boolean; settings: VoiceSettings } {
        return { success: true, settings: this.state.settings };
    }

    updateSettings(settings: Partial<VoiceSettings>): { success: boolean; settings: VoiceSettings } {
        this.state.settings = { ...this.state.settings, ...settings };
        this.sendEvent('settings-updated', this.state.settings);
        return { success: true, settings: this.state.settings };
    }

    getCommands(): { success: boolean; commands: VoiceCommand[] } {
        return { success: true, commands: this.state.commands };
    }

    addCommand(command: VoiceCommand): { success: boolean; command: VoiceCommand } {
        this.state.commands.push(command);
        this.sendEvent('command-added', command);
        return { success: true, command };
    }

    removeCommand(commandId: string): { success: boolean } {
        const index = this.state.commands.findIndex((c) => c.id === commandId);
        if (index === -1) {
            return { success: false };
        }
        this.state.commands.splice(index, 1);
        this.sendEvent('command-removed', commandId);
        return { success: true };
    }

    updateCommand(command: VoiceCommand): { success: boolean; command: VoiceCommand | null } {
        const index = this.state.commands.findIndex((c) => c.id === command.id);
        if (index === -1) {
            return { success: false, command: null };
        }
        this.state.commands[index] = command;
        this.sendEvent('command-updated', command);
        return { success: true, command };
    }

    processTranscript(transcript: string): { success: boolean; result: VoiceRecognitionResult; command: VoiceCommand | null } {
        const normalizedTranscript = transcript.toLowerCase().trim();
        const result: VoiceRecognitionResult = {
            success: true,
            transcript,
            confidence: 1.0,
            isFinal: true,
            timestamp: Date.now(),
        };

        // Check for wake word
        const wakeWords = [this.state.settings.wakeWord, ...this.state.settings.customWakeWords];
        const hasWakeWord = wakeWords.some((word) =>
            normalizedTranscript.startsWith(word.toLowerCase())
        );

        if (hasWakeWord) {
            this.state.wakeWordDetected = true;
            this.sendEvent('wake-word-detected', transcript);

            // Remove wake word from transcript
            const wakeWord = wakeWords.find((word) =>
                normalizedTranscript.startsWith(word.toLowerCase())
            );
            if (wakeWord) {
                const commandText = normalizedTranscript.slice(wakeWord.length).trim();
                const matchedCommand = this.matchCommand(commandText);
                if (matchedCommand) {
                    return { success: true, result, command: matchedCommand };
                }
            }
        }

        // Try to match command without wake word if in continuous mode
        if (this.state.settings.continuousListening || this.state.wakeWordDetected) {
            const matchedCommand = this.matchCommand(normalizedTranscript);
            if (matchedCommand) {
                return { success: true, result, command: matchedCommand };
            }
        }

        return { success: true, result, command: null };
    }

    executeCommand(command: VoiceCommand): { success: boolean; action: string } {
        this.logInfo(`Executing voice command: ${command.id}`);
        this.sendEvent('command-executed', command);
        return { success: true, action: command.action.type };
    }

    getVoices(): { success: boolean; voices: VoiceInfo[] } {
        // Voices are retrieved in renderer via Web Speech API
        return { success: true, voices: [] };
    }

    synthesize(_options: VoiceSynthesisOptions): { success: boolean } {
        this.state.isSpeaking = true;
        this.sendEvent('speech-started', _options);
        // Actual synthesis happens in renderer
        return { success: true };
    }

    stopSpeaking(): { success: boolean } {
        this.state.isSpeaking = false;
        this.sendEvent('speech-ended', null);
        return { success: true };
    }

    setListening(listening: boolean): { success: boolean } {
        this.state.isListening = listening;
        this.sendEvent(listening ? 'listening-started' : 'listening-stopped', null);
        return { success: true };
    }

    // IPC Handlers (delegate to public methods)

    private handleGetSettings(): { success: boolean; settings: VoiceSettings } {
        return this.getSettings();
    }

    private handleUpdateSettings(
        _event: Electron.IpcMainInvokeEvent,
        settings: Partial<VoiceSettings>
    ): { success: boolean; settings: VoiceSettings } {
        return this.updateSettings(settings);
    }

    private handleGetCommands(): { success: boolean; commands: VoiceCommand[] } {
        return this.getCommands();
    }

    private handleAddCommand(
        _event: Electron.IpcMainInvokeEvent,
        command: VoiceCommand
    ): { success: boolean; command: VoiceCommand } {
        return this.addCommand(command);
    }

    private handleRemoveCommand(
        _event: Electron.IpcMainInvokeEvent,
        commandId: string
    ): { success: boolean } {
        return this.removeCommand(commandId);
    }

    private handleUpdateCommand(
        _event: Electron.IpcMainInvokeEvent,
        command: VoiceCommand
    ): { success: boolean; command: VoiceCommand | null } {
        return this.updateCommand(command);
    }

    private handleProcessTranscript(
        _event: Electron.IpcMainInvokeEvent,
        transcript: string
    ): { success: boolean; result: VoiceRecognitionResult; command: VoiceCommand | null } {
        return this.processTranscript(transcript);
    }

    private handleExecuteCommand(
        _event: Electron.IpcMainInvokeEvent,
        command: VoiceCommand
    ): { success: boolean; action: string } {
        return this.executeCommand(command);
    }

    private handleGetVoices(): { success: boolean; voices: VoiceInfo[] } {
        return this.getVoices();
    }

    private handleSynthesize(
        _event: Electron.IpcMainInvokeEvent,
        options: VoiceSynthesisOptions
    ): { success: boolean } {
        return this.synthesize(options);
    }

    private handleStopSpeaking(): { success: boolean } {
        return this.stopSpeaking();
    }

    private handleSetListening(
        _event: Electron.IpcMainInvokeEvent,
        listening: boolean
    ): { success: boolean } {
        return this.setListening(listening);
    }

    private handleSendEvent(
        _event: Electron.IpcMainInvokeEvent,
        eventType: VoiceEventType,
        data: unknown
    ): { success: boolean } {
        this.sendEvent(eventType, data);
        return { success: true };
    }

    /**
     * Match transcript against available commands
     */
    private matchCommand(transcript: string): VoiceCommand | null {
        const normalizedTranscript = transcript.toLowerCase().trim();

        for (const command of this.state.commands) {
            if (!command.enabled) {
                continue;
            }

            // Check main phrase
            if (normalizedTranscript === command.phrase.toLowerCase()) {
                return command;
            }

            // Check aliases
            for (const alias of command.aliases) {
                if (normalizedTranscript === alias.toLowerCase()) {
                    return command;
                }
            }

            // Fuzzy match - check if transcript contains the phrase
            if (normalizedTranscript.includes(command.phrase.toLowerCase())) {
                return command;
            }
        }

        return null;
    }

    /**
     * Send event to renderer process
     */
    private sendEvent(type: VoiceEventType, data: unknown): void {
        if (this.state.mainWindow && !this.state.mainWindow.isDestroyed()) {
            const event: VoiceEvent = {
                type,
                timestamp: Date.now(),
                data: data as VoiceEvent['data'],
            };
            this.state.mainWindow.webContents.send('voice:event', event);
        }
    }

    /**
     * Notify renderer of speech synthesis completion
     */
    notifySpeechEnded(): void {
        this.state.isSpeaking = false;
        this.sendEvent('speech-ended', null);
    }

    /**
     * Get current state for debugging
     */
    getState(): VoiceServiceState {
        return { ...this.state };
    }
}

// Singleton instance
let voiceServiceInstance: VoiceService | null = null;

/** Get or create the voice service instance */
export function getVoiceService(): VoiceService {
    if (!voiceServiceInstance) {
        voiceServiceInstance = new VoiceService();
    }
    return voiceServiceInstance;
}

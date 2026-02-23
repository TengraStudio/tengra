/**
 * Voice Service - Main process service for voice recognition and synthesis
 * Implements UI-11: Voice-first interface option
 */

import { BaseService } from '@main/services/base.service';
import { JsonValue } from '@shared/types/common';
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
import { getErrorMessage } from '@shared/utils/error.util';
import { BrowserWindow, ipcMain } from 'electron';
import { z } from 'zod';

/** Voice service state */
interface VoiceServiceState {
    settings: VoiceSettings;
    commands: VoiceCommand[];
    isListening: boolean;
    isSpeaking: boolean;
    wakeWordDetected: boolean;
    mainWindow: BrowserWindow | null;
}

type VoiceUiState = 'ready' | 'empty' | 'failure';

const VOICE_ERROR_CODE = {
    VALIDATION: 'VOICE_VALIDATION_ERROR',
    OPERATION_FAILED: 'VOICE_OPERATION_FAILED',
    TRANSIENT: 'VOICE_TRANSIENT_ERROR',
} as const;

const VOICE_MESSAGE_KEY = {
    VALIDATION: 'errors.unexpected',
    OPERATION_FAILED: 'errors.unexpected',
} as const;

const VOICE_PERFORMANCE_BUDGET_MS = {
    FAST: 40,
    STANDARD: 120,
    HEAVY: 220
} as const;

const MAX_VOICE_TELEMETRY_EVENTS = 200;

type VoiceActionType = VoiceCommand['action']['type'];

const VoiceActionSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('navigate'), target: z.string().trim().min(1).max(200) }),
    z.object({ type: z.literal('execute'), command: z.string().trim().min(1).max(500) }),
    z.object({ type: z.literal('toggle'), setting: z.string().trim().min(1).max(120) }),
    z.object({ type: z.literal('select'), target: z.string().trim().min(1).max(200) }),
    z.object({
        type: z.literal('scroll'),
        direction: z.enum(['up', 'down', 'left', 'right']),
        amount: z.number().int().min(1).max(5000).optional()
    }),
    z.object({ type: z.literal('chat'), message: z.string().trim().min(1).max(4000) }),
    z.object({ type: z.literal('custom'), handlerId: z.string().trim().min(1).max(200) }),
]);

const VoiceCommandSchema: z.ZodType<VoiceCommand> = z.object({
    id: z.string().trim().min(1).max(128),
    phrase: z.string().trim().min(1).max(200),
    aliases: z.array(z.string().trim().min(1).max(200)).max(25),
    action: VoiceActionSchema,
    category: z.enum(['navigation', 'actions', 'chat', 'settings', 'accessibility', 'custom']),
    description: z.string().trim().min(1).max(500),
    enabled: z.boolean(),
    isSystem: z.boolean().optional()
});

const VoiceShortcutSchema = z.object({
    id: z.string().trim().min(1).max(128),
    phrase: z.string().trim().min(1).max(200),
    action: z.string().trim().min(1).max(300),
    enabled: z.boolean()
});

const VoiceSettingsUpdateSchema: z.ZodType<Partial<VoiceSettings>> = z.object({
    enabled: z.boolean().optional(),
    wakeWord: z.string().trim().min(1).max(64).optional(),
    customWakeWords: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
    recognitionLanguage: z.string().trim().min(2).max(20).optional(),
    synthesisVoice: z.string().trim().max(200).optional(),
    speechRate: z.number().min(0.1).max(10).optional(),
    speechPitch: z.number().min(0).max(2).optional(),
    speechVolume: z.number().min(0).max(1).optional(),
    audioFeedback: z.boolean().optional(),
    visualFeedback: z.boolean().optional(),
    accessibilityMode: z.boolean().optional(),
    shortcuts: z.array(VoiceShortcutSchema).max(200).optional(),
    customCommands: z.array(VoiceCommandSchema).max(400).optional(),
    continuousListening: z.boolean().optional(),
    silenceTimeout: z.number().int().min(100).max(30_000).optional(),
});

const TranscriptSchema = z.string().trim().min(1).max(4000);
const VoiceCommandIdSchema = z.string().trim().min(1).max(128);
const VoiceListeningSchema = z.boolean();
const VoiceSynthesisSchema: z.ZodType<VoiceSynthesisOptions> = z.object({
    text: z.string().trim().min(1).max(5000),
    rate: z.number().min(0.1).max(10).optional(),
    pitch: z.number().min(0).max(2).optional(),
    volume: z.number().min(0).max(1).optional(),
    voice: z.string().trim().max(200).optional(),
    lang: z.string().trim().max(20).optional(),
});
const VoiceEventTypeSchema = z.enum([
    'listening-started',
    'listening-stopped',
    'wake-word-detected',
    'command-recognized',
    'command-executed',
    'command-added',
    'command-removed',
    'command-updated',
    'settings-updated',
    'speech-started',
    'speech-ended',
    'error'
]);

const JsonSchema: z.ZodType<JsonValue> = z.lazy(() =>
    z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(JsonSchema),
        z.record(z.string(), JsonSchema)
    ])
);

interface VoiceTelemetryEvent {
    channel: string;
    event: 'success' | 'failure' | 'retry';
    timestamp: number;
    durationMs?: number;
    code?: string;
}

interface VoiceChannelMetrics {
    calls: number;
    failures: number;
    retries: number;
    validationFailures: number;
    budgetExceededCount: number;
    lastDurationMs: number;
    lastErrorCode: string | null;
    lastUiState: VoiceUiState | null;
}

interface VoiceResponseMetadata {
    error?: string;
    errorCode?: string;
    messageKey?: string;
    retryable?: boolean;
    uiState?: VoiceUiState;
    fallbackUsed?: boolean;
}

type VoiceResponse<T extends Record<string, unknown> = Record<string, unknown>> = { success: boolean } & T & VoiceResponseMetadata;

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
    private readonly maxRetryAttempts = 2;
    private readonly retryDelayMs = 35;
    private telemetry = {
        totalCalls: 0,
        totalFailures: 0,
        totalRetries: 0,
        validationFailures: 0,
        budgetExceededCount: 0,
        lastErrorCode: null as string | null,
        channels: {} as Record<string, VoiceChannelMetrics>,
        events: [] as VoiceTelemetryEvent[],
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
        ipcMain.handle('voice:health', this.handleHealth.bind(this));
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
        ipcMain.removeHandler('voice:health');
    }

    private getChannelMetrics(channel: string): VoiceChannelMetrics {
        if (!this.telemetry.channels[channel]) {
            this.telemetry.channels[channel] = {
                calls: 0,
                failures: 0,
                retries: 0,
                validationFailures: 0,
                budgetExceededCount: 0,
                lastDurationMs: 0,
                lastErrorCode: null,
                lastUiState: null,
            };
        }
        return this.telemetry.channels[channel];
    }

    private getPerformanceBudget(channel: string): number {
        if (
            channel === 'voice:get-settings'
            || channel === 'voice:get-commands'
            || channel === 'voice:get-voices'
            || channel === 'voice:health'
        ) {
            return VOICE_PERFORMANCE_BUDGET_MS.FAST;
        }
        if (
            channel === 'voice:process-transcript'
            || channel === 'voice:execute-command'
            || channel === 'voice:synthesize'
        ) {
            return VOICE_PERFORMANCE_BUDGET_MS.STANDARD;
        }
        return VOICE_PERFORMANCE_BUDGET_MS.HEAVY;
    }

    private trackTelemetryEvent(
        channel: string,
        event: 'success' | 'failure' | 'retry',
        details: { durationMs?: number; code?: string } = {}
    ): void {
        this.telemetry.events = [...this.telemetry.events, {
            channel,
            event,
            timestamp: Date.now(),
            durationMs: details.durationMs,
            code: details.code
        }].slice(-MAX_VOICE_TELEMETRY_EVENTS);
    }

    private trackSuccess(channel: string, durationMs: number, uiState: VoiceUiState): void {
        const channelMetrics = this.getChannelMetrics(channel);
        const budget = this.getPerformanceBudget(channel);
        this.telemetry.totalCalls += 1;
        channelMetrics.calls += 1;
        channelMetrics.lastDurationMs = durationMs;
        channelMetrics.lastUiState = uiState;
        if (durationMs > budget) {
            this.telemetry.budgetExceededCount += 1;
            channelMetrics.budgetExceededCount += 1;
        }
        this.trackTelemetryEvent(channel, 'success', { durationMs });
    }

    private trackFailure(channel: string, durationMs: number, errorCode: string, validationFailure: boolean): void {
        const channelMetrics = this.getChannelMetrics(channel);
        this.telemetry.totalCalls += 1;
        this.telemetry.totalFailures += 1;
        this.telemetry.lastErrorCode = errorCode;
        channelMetrics.calls += 1;
        channelMetrics.failures += 1;
        channelMetrics.lastDurationMs = durationMs;
        channelMetrics.lastErrorCode = errorCode;
        channelMetrics.lastUiState = 'failure';
        if (validationFailure) {
            this.telemetry.validationFailures += 1;
            channelMetrics.validationFailures += 1;
        }
        this.trackTelemetryEvent(channel, 'failure', { durationMs, code: errorCode });
    }

    private trackRetry(channel: string): void {
        const channelMetrics = this.getChannelMetrics(channel);
        this.telemetry.totalRetries += 1;
        channelMetrics.retries += 1;
        this.trackTelemetryEvent(channel, 'retry', { code: VOICE_ERROR_CODE.TRANSIENT });
    }

    private isRetryableError(error: Error): boolean {
        const normalized = getErrorMessage(error).toLowerCase();
        const fragments = [
            'timeout',
            'timed out',
            'temporar',
            'busy',
            'econnreset',
            'econnrefused',
            'network'
        ];
        return fragments.some(fragment => normalized.includes(fragment));
    }

    private buildErrorMetadata(error: Error, messageKeyOverride?: string): VoiceResponseMetadata {
        const validationFailure = error instanceof z.ZodError;
        const retryable = !validationFailure && this.isRetryableError(error);
        const errorCode = validationFailure
            ? VOICE_ERROR_CODE.VALIDATION
            : retryable
                ? VOICE_ERROR_CODE.TRANSIENT
                : VOICE_ERROR_CODE.OPERATION_FAILED;

        return {
            error: getErrorMessage(error),
            errorCode,
            messageKey: messageKeyOverride ?? (
                validationFailure ? VOICE_MESSAGE_KEY.VALIDATION : VOICE_MESSAGE_KEY.OPERATION_FAILED
            ),
            retryable
        };
    }

    private inferUiState(result: VoiceResponse): VoiceUiState {
        if (result.uiState) {
            return result.uiState;
        }
        if (!result.success) {
            return 'failure';
        }
        if ('commands' in result && Array.isArray(result.commands)) {
            return result.commands.length === 0 ? 'empty' : 'ready';
        }
        if ('voices' in result && Array.isArray(result.voices)) {
            return result.voices.length === 0 ? 'empty' : 'ready';
        }
        return 'ready';
    }

    private async waitFor(delayMs: number): Promise<void> {
        await new Promise<void>(resolve => setTimeout(resolve, delayMs));
    }

    private async executeWithRetry<T>(
        channel: string,
        operation: () => Promise<T>,
        maxAttempts: number
    ): Promise<T> {
        let lastError: Error | null = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            try {
                return await operation();
            } catch (caughtError) {
                const error = caughtError instanceof Error ? caughtError : new Error(String(caughtError));
                lastError = error;
                if (!this.isRetryableError(error) || attempt >= maxAttempts) {
                    break;
                }
                this.trackRetry(channel);
                await this.waitFor(this.retryDelayMs);
            }
        }
        throw (lastError ?? new Error('Unknown voice IPC error'));
    }

    private getHealthSummary(): {
        status: 'healthy' | 'degraded';
        uiState: VoiceUiState;
        budgets: { fastMs: number; standardMs: number; heavyMs: number };
        metrics: {
            totalCalls: number;
            totalFailures: number;
            totalRetries: number;
            validationFailures: number;
            budgetExceededCount: number;
            lastErrorCode: string | null;
            channels: Record<string, VoiceChannelMetrics>;
            events: VoiceTelemetryEvent[];
            errorRate: number;
        };
    } {
        const errorRate = this.telemetry.totalCalls === 0
            ? 0
            : this.telemetry.totalFailures / this.telemetry.totalCalls;
        const status = errorRate > 0.05 || this.telemetry.budgetExceededCount > 0
            ? 'degraded'
            : 'healthy';
        return {
            status,
            uiState: status === 'healthy' ? 'ready' : 'failure',
            budgets: {
                fastMs: VOICE_PERFORMANCE_BUDGET_MS.FAST,
                standardMs: VOICE_PERFORMANCE_BUDGET_MS.STANDARD,
                heavyMs: VOICE_PERFORMANCE_BUDGET_MS.HEAVY
            },
            metrics: {
                ...this.telemetry,
                errorRate
            }
        };
    }

    private async withPolicy(
        channel: string,
        operation: () => Promise<VoiceResponse>,
        fallback: VoiceResponse,
        options: { retries?: number; messageKey?: string } = {}
    ): Promise<VoiceResponse> {
        const startedAt = Date.now();
        try {
            const result = await this.executeWithRetry(channel, operation, options.retries ?? 1);
            const uiState = this.inferUiState(result);
            const normalized = { ...result, uiState };
            if (normalized.success) {
                this.trackSuccess(channel, Date.now() - startedAt, uiState);
            } else {
                const errorCode = normalized.errorCode ?? VOICE_ERROR_CODE.OPERATION_FAILED;
                const validationFailure = errorCode === VOICE_ERROR_CODE.VALIDATION;
                this.trackFailure(channel, Date.now() - startedAt, errorCode, validationFailure);
            }
            return normalized;
        } catch (caughtError) {
            const error = caughtError instanceof Error ? caughtError : new Error(String(caughtError));
            const metadata = this.buildErrorMetadata(error, options.messageKey);
            const validationFailure = metadata.errorCode === VOICE_ERROR_CODE.VALIDATION;
            this.trackFailure(
                channel,
                Date.now() - startedAt,
                metadata.errorCode ?? VOICE_ERROR_CODE.OPERATION_FAILED,
                validationFailure
            );
            return {
                ...fallback,
                ...metadata,
                uiState: 'failure',
                fallbackUsed: true
            };
        }
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

    private async handleGetSettings(): Promise<VoiceResponse> {
        return await this.withPolicy(
            'voice:get-settings',
            async () => ({ ...this.getSettings(), uiState: 'ready' }),
            { success: true, settings: this.state.settings, uiState: 'ready' }
        );
    }

    private async handleUpdateSettings(
        _event: Electron.IpcMainInvokeEvent,
        settings: Partial<VoiceSettings>
    ): Promise<VoiceResponse> {
        return await this.withPolicy(
            'voice:update-settings',
            async () => {
                const parsed = VoiceSettingsUpdateSchema.parse(settings);
                return { ...this.updateSettings(parsed), uiState: 'ready' };
            },
            { success: true, settings: this.state.settings, uiState: 'ready' },
            { retries: this.maxRetryAttempts }
        );
    }

    private async handleGetCommands(): Promise<VoiceResponse> {
        return await this.withPolicy(
            'voice:get-commands',
            async () => {
                const response = this.getCommands();
                return {
                    ...response,
                    uiState: response.commands.length === 0 ? 'empty' : 'ready'
                };
            },
            { success: true, commands: [], uiState: 'empty' }
        );
    }

    private async handleAddCommand(
        _event: Electron.IpcMainInvokeEvent,
        command: VoiceCommand
    ): Promise<VoiceResponse> {
        return await this.withPolicy(
            'voice:add-command',
            async () => {
                const parsed = VoiceCommandSchema.parse(command);
                return { ...this.addCommand(parsed), uiState: 'ready' };
            },
            { success: false, command, uiState: 'failure' },
            { retries: this.maxRetryAttempts }
        );
    }

    private async handleRemoveCommand(
        _event: Electron.IpcMainInvokeEvent,
        commandId: string
    ): Promise<VoiceResponse> {
        return await this.withPolicy(
            'voice:remove-command',
            async () => {
                const parsedId = VoiceCommandIdSchema.parse(commandId);
                const result = this.removeCommand(parsedId);
                return {
                    ...result,
                    uiState: result.success ? 'ready' : 'empty'
                };
            },
            { success: false, uiState: 'failure' },
            { retries: this.maxRetryAttempts }
        );
    }

    private async handleUpdateCommand(
        _event: Electron.IpcMainInvokeEvent,
        command: VoiceCommand
    ): Promise<VoiceResponse> {
        return await this.withPolicy(
            'voice:update-command',
            async () => {
                const parsed = VoiceCommandSchema.parse(command);
                const result = this.updateCommand(parsed);
                return {
                    ...result,
                    uiState: result.success ? 'ready' : 'empty'
                };
            },
            { success: false, command: null, uiState: 'failure' },
            { retries: this.maxRetryAttempts }
        );
    }

    private async handleProcessTranscript(
        _event: Electron.IpcMainInvokeEvent,
        transcript: string
    ): Promise<VoiceResponse> {
        return await this.withPolicy(
            'voice:process-transcript',
            async () => {
                const parsedTranscript = TranscriptSchema.parse(transcript);
                const result = this.processTranscript(parsedTranscript);
                return {
                    ...result,
                    uiState: result.command ? 'ready' : 'empty'
                };
            },
            {
                success: false,
                result: {
                    success: false,
                    transcript: '',
                    confidence: 0,
                    isFinal: true,
                    error: 'errors.unexpected',
                    timestamp: Date.now()
                },
                command: null,
                uiState: 'failure'
            },
            { retries: this.maxRetryAttempts }
        );
    }

    private async handleExecuteCommand(
        _event: Electron.IpcMainInvokeEvent,
        command: VoiceCommand
    ): Promise<VoiceResponse> {
        return await this.withPolicy(
            'voice:execute-command',
            async () => {
                const parsed = VoiceCommandSchema.parse(command);
                const result = this.executeCommand(parsed);
                return {
                    success: result.success,
                    action: result.action as VoiceActionType,
                    uiState: result.success ? 'ready' : 'failure'
                };
            },
            { success: false, action: 'execute', uiState: 'failure' },
            { retries: this.maxRetryAttempts }
        );
    }

    private async handleGetVoices(): Promise<VoiceResponse> {
        return await this.withPolicy(
            'voice:get-voices',
            async () => {
                const result = this.getVoices();
                return {
                    ...result,
                    uiState: result.voices.length === 0 ? 'empty' : 'ready'
                };
            },
            { success: true, voices: [], uiState: 'empty' }
        );
    }

    private async handleSynthesize(
        _event: Electron.IpcMainInvokeEvent,
        options: VoiceSynthesisOptions
    ): Promise<VoiceResponse> {
        return await this.withPolicy(
            'voice:synthesize',
            async () => {
                const parsed = VoiceSynthesisSchema.parse(options);
                const result = this.synthesize(parsed);
                return {
                    ...result,
                    uiState: result.success ? 'ready' : 'failure'
                };
            },
            { success: false, uiState: 'failure' },
            { retries: this.maxRetryAttempts }
        );
    }

    private async handleStopSpeaking(): Promise<VoiceResponse> {
        return await this.withPolicy(
            'voice:stop-speaking',
            async () => ({ ...this.stopSpeaking(), uiState: 'ready' }),
            { success: false, uiState: 'failure' }
        );
    }

    private async handleSetListening(
        _event: Electron.IpcMainInvokeEvent,
        listening: boolean
    ): Promise<VoiceResponse> {
        return await this.withPolicy(
            'voice:set-listening',
            async () => {
                const parsedListening = VoiceListeningSchema.parse(listening);
                const result = this.setListening(parsedListening);
                return {
                    ...result,
                    uiState: 'ready'
                };
            },
            { success: false, uiState: 'failure' },
            { retries: this.maxRetryAttempts }
        );
    }

    private async handleSendEvent(
        _event: Electron.IpcMainInvokeEvent,
        eventType: VoiceEventType,
        data: unknown
    ): Promise<VoiceResponse> {
        return await this.withPolicy(
            'voice:send-event',
            async () => {
                const parsedType = VoiceEventTypeSchema.parse(eventType);
                const parsedData = JsonSchema.parse(data);
                this.sendEvent(parsedType, parsedData);
                return { success: true, uiState: 'ready' };
            },
            { success: false, uiState: 'failure' },
            { retries: 1 }
        );
    }

    private async handleHealth(): Promise<VoiceResponse> {
        return await this.withPolicy(
            'voice:health',
            async () => ({
                success: true,
                data: this.getHealthSummary(),
                uiState: 'ready'
            }),
            {
                success: false,
                data: {
                    status: 'degraded',
                    uiState: 'failure',
                    budgets: {
                        fastMs: VOICE_PERFORMANCE_BUDGET_MS.FAST,
                        standardMs: VOICE_PERFORMANCE_BUDGET_MS.STANDARD,
                        heavyMs: VOICE_PERFORMANCE_BUDGET_MS.HEAVY
                    },
                    metrics: {
                        totalCalls: this.telemetry.totalCalls,
                        totalFailures: this.telemetry.totalFailures,
                        totalRetries: this.telemetry.totalRetries,
                        validationFailures: this.telemetry.validationFailures,
                        budgetExceededCount: this.telemetry.budgetExceededCount,
                        lastErrorCode: this.telemetry.lastErrorCode,
                        channels: this.telemetry.channels,
                        events: this.telemetry.events,
                        errorRate: 1
                    }
                },
                uiState: 'failure'
            }
        );
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

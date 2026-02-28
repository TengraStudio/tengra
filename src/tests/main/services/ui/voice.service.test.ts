/**
 * VoiceService Unit Tests
 * Tests for speech recognition, synthesis, command processing, and IPC lifecycle.
 */

import { VoiceService } from '@main/services/ui/voice.service';
import { DEFAULT_VOICE_COMMANDS, DEFAULT_VOICE_SETTINGS, VoiceCommand } from '@shared/types/voice';
import { BrowserWindow } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

/** Create a fake BrowserWindow with spied webContents */
function createMockWindow(): BrowserWindow {
    return {
        loadURL: vi.fn(),
        webContents: { send: vi.fn(), on: vi.fn() },
        on: vi.fn(),
        isDestroyed: vi.fn(() => false),
    } as unknown as BrowserWindow;
}

/** Helper to build a valid VoiceCommand for tests */
function makeCommand(overrides: Partial<VoiceCommand> = {}): VoiceCommand {
    return {
        id: 'test-cmd',
        phrase: 'test phrase',
        aliases: ['alias one'],
        action: { type: 'navigate', target: 'home' },
        category: 'navigation',
        description: 'A test command',
        enabled: true,
        ...overrides,
    };
}

describe('VoiceService', () => {
    let service: VoiceService;

    beforeEach(() => {
        service = new VoiceService();
    });

    // ── Lifecycle ──────────────────────────────────────────────

    describe('lifecycle', () => {
        it('initializes without error', async () => {
            await expect(service.initialize()).resolves.toBeUndefined();
        });

        it('cleans up without error', async () => {
            await service.initialize();
            await expect(service.cleanup()).resolves.toBeUndefined();
        });

        it('clears mainWindow reference on cleanup', async () => {
            const win = createMockWindow();
            service.setMainWindow(win);
            await service.initialize();
            await service.cleanup();

            const state = service.getState();
            expect(state.mainWindow).toBeNull();
        });
    });

    // ── Settings ───────────────────────────────────────────────

    describe('getSettings', () => {
        it('returns default settings', () => {
            const result = service.getSettings();
            expect(result.success).toBe(true);
            expect(result.settings).toEqual(DEFAULT_VOICE_SETTINGS);
        });
    });

    describe('updateSettings', () => {
        it('merges partial settings', () => {
            const result = service.updateSettings({ enabled: true, speechRate: 2.5 });
            expect(result.success).toBe(true);
            expect(result.settings.enabled).toBe(true);
            expect(result.settings.speechRate).toBe(2.5);
        });

        it('preserves unchanged settings', () => {
            service.updateSettings({ enabled: true });
            const result = service.getSettings();
            expect(result.settings.wakeWord).toBe(DEFAULT_VOICE_SETTINGS.wakeWord);
        });

        it('sends settings-updated event to renderer', () => {
            const win = createMockWindow();
            service.setMainWindow(win);
            service.updateSettings({ enabled: true });

            expect(win.webContents.send).toHaveBeenCalledWith(
                'voice:event',
                expect.objectContaining({ type: 'settings-updated' }),
            );
        });
    });

    // ── Commands CRUD ──────────────────────────────────────────

    describe('getCommands', () => {
        it('returns default commands', () => {
            const result = service.getCommands();
            expect(result.success).toBe(true);
            expect(result.commands).toHaveLength(DEFAULT_VOICE_COMMANDS.length);
        });
    });

    describe('addCommand', () => {
        it('adds a new command', () => {
            const cmd = makeCommand({ id: 'custom-nav' });
            const result = service.addCommand(cmd);
            expect(result.success).toBe(true);
            expect(result.command.id).toBe('custom-nav');
            expect(service.getCommands().commands).toContainEqual(cmd);
        });

        it('emits command-added event', () => {
            const win = createMockWindow();
            service.setMainWindow(win);
            service.addCommand(makeCommand());
            expect(win.webContents.send).toHaveBeenCalledWith(
                'voice:event',
                expect.objectContaining({ type: 'command-added' }),
            );
        });
    });

    describe('removeCommand', () => {
        it('removes an existing command by id', () => {
            const before = service.getCommands().commands.length;
            const firstCmd = service.getCommands().commands[0];
            const result = service.removeCommand(firstCmd.id);
            expect(result.success).toBe(true);
            expect(service.getCommands().commands).toHaveLength(before - 1);
        });

        it('returns success false for unknown id', () => {
            const result = service.removeCommand('non-existent-id');
            expect(result.success).toBe(false);
        });

        it('emits command-removed event', () => {
            const win = createMockWindow();
            service.setMainWindow(win);
            const firstCmd = service.getCommands().commands[0];
            service.removeCommand(firstCmd.id);
            expect(win.webContents.send).toHaveBeenCalledWith(
                'voice:event',
                expect.objectContaining({ type: 'command-removed' }),
            );
        });
    });

    describe('updateCommand', () => {
        it('updates an existing command', () => {
            const cmd = service.getCommands().commands[0];
            const updated = { ...cmd, description: 'Updated description' };
            const result = service.updateCommand(updated);
            expect(result.success).toBe(true);
            expect(result.command?.description).toBe('Updated description');
        });

        it('returns null command for unknown id', () => {
            const result = service.updateCommand(makeCommand({ id: 'does-not-exist' }));
            expect(result.success).toBe(false);
            expect(result.command).toBeNull();
        });

        it('emits command-updated event', () => {
            const win = createMockWindow();
            service.setMainWindow(win);
            const cmd = service.getCommands().commands[0];
            service.updateCommand({ ...cmd, description: 'Changed' });
            expect(win.webContents.send).toHaveBeenCalledWith(
                'voice:event',
                expect.objectContaining({ type: 'command-updated' }),
            );
        });
    });

    // ── Transcript processing & command matching ───────────────

    describe('processTranscript', () => {
        it('matches a command by exact phrase', () => {
            service.updateSettings({ continuousListening: true });
            const result = service.processTranscript('open settings');
            expect(result.success).toBe(true);
            expect(result.command).not.toBeNull();
            expect(result.command?.id).toBe('nav-settings');
        });

        it('matches a command by alias', () => {
            service.updateSettings({ continuousListening: true });
            const result = service.processTranscript('go to settings');
            expect(result.success).toBe(true);
            expect(result.command?.id).toBe('nav-settings');
        });

        it('matches case-insensitively', () => {
            service.updateSettings({ continuousListening: true });
            const result = service.processTranscript('OPEN SETTINGS');
            expect(result.success).toBe(true);
            expect(result.command?.id).toBe('nav-settings');
        });

        it('detects wake word and strips it before matching', () => {
            const result = service.processTranscript('tengra open settings');
            expect(result.success).toBe(true);
            expect(result.command?.id).toBe('nav-settings');
        });

        it('detects custom wake word', () => {
            service.updateSettings({ customWakeWords: ['hey assistant'] });
            const result = service.processTranscript('hey assistant open settings');
            expect(result.success).toBe(true);
            expect(result.command?.id).toBe('nav-settings');
        });

        it('returns null command when no match and not continuous', () => {
            const result = service.processTranscript('random words');
            expect(result.success).toBe(true);
            expect(result.command).toBeNull();
        });

        it('matches in continuous listening mode without wake word', () => {
            service.updateSettings({ continuousListening: true });
            const result = service.processTranscript('scroll up');
            expect(result.success).toBe(true);
            expect(result.command?.id).toBe('scroll-up');
        });

        it('does not match disabled commands', () => {
            service.updateSettings({ continuousListening: true });
            const cmd = service.getCommands().commands.find(c => c.id === 'nav-settings');
            if (cmd) {
                service.updateCommand({ ...cmd, enabled: false });
            }
            const result = service.processTranscript('open settings');
            expect(result.command?.id).not.toBe('nav-settings');
        });

        it('returns recognition result metadata', () => {
            const result = service.processTranscript('tengra go home');
            expect(result.result.transcript).toBe('tengra go home');
            expect(result.result.confidence).toBe(1.0);
            expect(result.result.isFinal).toBe(true);
            expect(result.result.timestamp).toBeGreaterThan(0);
        });

        it('fuzzy matches when phrase is contained in transcript', () => {
            service.updateSettings({ continuousListening: true });
            const result = service.processTranscript('please scroll down now');
            expect(result.success).toBe(true);
            expect(result.command?.id).toBe('scroll-down');
        });
    });

    // ── Execute command ────────────────────────────────────────

    describe('executeCommand', () => {
        it('returns success and action type', () => {
            const cmd = makeCommand({ action: { type: 'execute', command: 'do-stuff' } });
            const result = service.executeCommand(cmd);
            expect(result.success).toBe(true);
            expect(result.action).toBe('execute');
        });

        it('emits command-executed event', () => {
            const win = createMockWindow();
            service.setMainWindow(win);
            service.executeCommand(makeCommand());
            expect(win.webContents.send).toHaveBeenCalledWith(
                'voice:event',
                expect.objectContaining({ type: 'command-executed' }),
            );
        });
    });

    // ── Voices / synthesis / listening ─────────────────────────

    describe('getVoices', () => {
        it('returns empty voices (renderer-side API)', () => {
            const result = service.getVoices();
            expect(result.success).toBe(true);
            expect(result.voices).toEqual([]);
        });
    });

    describe('synthesize', () => {
        it('sets isSpeaking to true', () => {
            service.synthesize({ text: 'hello' });
            const state = service.getState();
            expect(state.isSpeaking).toBe(true);
        });

        it('emits speech-started event', () => {
            const win = createMockWindow();
            service.setMainWindow(win);
            service.synthesize({ text: 'hello' });
            expect(win.webContents.send).toHaveBeenCalledWith(
                'voice:event',
                expect.objectContaining({ type: 'speech-started' }),
            );
        });
    });

    describe('stopSpeaking', () => {
        it('sets isSpeaking to false', () => {
            service.synthesize({ text: 'speaking' });
            service.stopSpeaking();
            expect(service.getState().isSpeaking).toBe(false);
        });

        it('emits speech-ended event', () => {
            const win = createMockWindow();
            service.setMainWindow(win);
            service.stopSpeaking();
            expect(win.webContents.send).toHaveBeenCalledWith(
                'voice:event',
                expect.objectContaining({ type: 'speech-ended' }),
            );
        });
    });

    describe('setListening', () => {
        it('sets isListening to true', () => {
            service.setListening(true);
            expect(service.getState().isListening).toBe(true);
        });

        it('sets isListening to false', () => {
            service.setListening(true);
            service.setListening(false);
            expect(service.getState().isListening).toBe(false);
        });

        it('emits listening-started when true', () => {
            const win = createMockWindow();
            service.setMainWindow(win);
            service.setListening(true);
            expect(win.webContents.send).toHaveBeenCalledWith(
                'voice:event',
                expect.objectContaining({ type: 'listening-started' }),
            );
        });

        it('emits listening-stopped when false', () => {
            const win = createMockWindow();
            service.setMainWindow(win);
            service.setListening(false);
            expect(win.webContents.send).toHaveBeenCalledWith(
                'voice:event',
                expect.objectContaining({ type: 'listening-stopped' }),
            );
        });
    });

    // ── notifySpeechEnded ──────────────────────────────────────

    describe('notifySpeechEnded', () => {
        it('resets isSpeaking and emits speech-ended', () => {
            const win = createMockWindow();
            service.setMainWindow(win);
            service.synthesize({ text: 'hi' });
            service.notifySpeechEnded();

            expect(service.getState().isSpeaking).toBe(false);
            expect(win.webContents.send).toHaveBeenCalledWith(
                'voice:event',
                expect.objectContaining({ type: 'speech-ended' }),
            );
        });
    });

    // ── Event emission edge cases ──────────────────────────────

    describe('event emission', () => {
        it('does not throw when mainWindow is null', () => {
            expect(() => service.updateSettings({ enabled: true })).not.toThrow();
        });

        it('does not send events when window is destroyed', () => {
            const win = createMockWindow();
            (win.isDestroyed as ReturnType<typeof vi.fn>).mockReturnValue(true);
            service.setMainWindow(win);
            service.updateSettings({ enabled: true });
            expect(win.webContents.send).not.toHaveBeenCalled();
        });
    });

    // ── getState snapshot ──────────────────────────────────────

    describe('getState', () => {
        it('returns a copy of the internal state', () => {
            const state1 = service.getState();
            const state2 = service.getState();
            expect(state1).toEqual(state2);
            expect(state1).not.toBe(state2);
        });

        it('reflects listening state changes', () => {
            service.setListening(true);
            expect(service.getState().isListening).toBe(true);
        });

        it('reflects speaking state changes', () => {
            service.synthesize({ text: 'test' });
            expect(service.getState().isSpeaking).toBe(true);
            service.stopSpeaking();
            expect(service.getState().isSpeaking).toBe(false);
        });
    });
});


import { EventEmitter } from 'events';
import * as http from 'http';

import { OllamaService } from '@main/services/llm/ollama.service';
import { SettingsService } from '@main/services/system/settings.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { beforeEach,describe, expect, it, vi } from 'vitest';

// Mock http
vi.mock('http', () => ({
    request: vi.fn()
}));

// Mock SettingsService
const mockSettingsService = {
    getSettings: vi.fn().mockReturnValue({
        ollama: { url: 'http://127.0.0.1:11434' }
    })
};

describe('OllamaService', () => {
    let service: OllamaService;

    beforeEach(() => {
        vi.clearAllMocks();
        const mockEventBusService = {
            onCustom: vi.fn(),
            subscribe: vi.fn(),
            emit: vi.fn(),
            emitCustom: vi.fn()
        };
        service = new OllamaService(
            mockSettingsService as unknown as SettingsService,
            mockEventBusService as unknown as EventBusService
        );
    });

    it('should initialize with default host and port', () => {
        expect(service['host']).toBe('127.0.0.1');
        expect(service['port']).toBe(11434);
    });

    it('should allow setting connection manually', () => {
        service.setConnection('localhost', 11435);
        expect(service['host']).toBe('localhost');
        expect(service['port']).toBe(11435);
    });

    describe('isAvailable', () => {
        it('should return true if Ollama is reachable', async () => {
            const mockReq = new EventEmitter() as any;
            mockReq.write = vi.fn();
            mockReq.end = vi.fn();
            mockReq.setTimeout = vi.fn();

            const mockRes = new EventEmitter() as any;
            mockRes.statusCode = 200;

            (http.request as any).mockImplementation((_options: http.RequestOptions, callback: (res: http.IncomingMessage) => void) => {
                callback(mockRes);
                setImmediate(() => {
                    mockRes.emit('data', JSON.stringify({ status: 'ok' }));
                    mockRes.emit('end');
                });
                return mockReq;
            });

            const available = await service.isAvailable();
            expect(available).toBe(true);
        });

        it('should return false if Ollama request fails', async () => {
            const mockReq = new EventEmitter() as any;
            mockReq.write = vi.fn();
            mockReq.end = vi.fn();
            mockReq.setTimeout = vi.fn();

            (http.request as any).mockImplementation(() => {
                setImmediate(() => {
                    mockReq.emit('error', new Error('Connection refused'));
                });
                return mockReq;
            });

            const available = await service.isAvailable();
            expect(available).toBe(false);
        });
    });
});

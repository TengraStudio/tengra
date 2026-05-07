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
import { BaseService } from '@main/services/base.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

class TestService extends BaseService {
    constructor() {
        super('TestService');
    }

    getName(): string {
        return this.name;
    }

    callLogInfo(message: string): void {
        this.logInfo(message);
    }

    callLogError(message: string, error?: TestValue): void {
        this.logError(message, error);
    }

    callLogWarn(message: string): void {
        this.logWarn(message);
    }

    callLogDebug(message: string): void {
        this.logDebug(message);
    }
}

describe('BaseService', () => {
    let service: TestService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new TestService();
    });

    it('should store the service name', () => {
        expect(service.getName()).toBe('TestService');
    });

    it('should have default initialize that resolves', async () => {
        await expect(service.initialize()).resolves.toBeUndefined();
    });

    it('should have default cleanup that resolves', async () => {
        await expect(service.cleanup()).resolves.toBeUndefined();
    });

    it('should delegate logInfo to appLogger.info', () => {
        service.callLogInfo('test message');
        expect(appLogger.info).toHaveBeenCalledWith('TestService', 'test message', undefined);
    });

    it('should delegate logError to appLogger.error', () => {
        const error = new Error('fail');
        service.callLogError('error occurred', error);
        expect(appLogger.error).toHaveBeenCalledWith('TestService', 'error occurred', error);
    });

    it('should delegate logWarn to appLogger.warn', () => {
        service.callLogWarn('warning');
        expect(appLogger.warn).toHaveBeenCalledWith('TestService', 'warning', undefined);
    });

    it('should delegate logDebug to appLogger.debug', () => {
        service.callLogDebug('debug info');
        expect(appLogger.debug).toHaveBeenCalledWith('TestService', 'debug info', undefined);
    });

    it('should handle logError without error object', () => {
        service.callLogError('no error obj');
        expect(appLogger.error).toHaveBeenCalledWith('TestService', 'no error obj', undefined);
    });
});


/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as net from 'net';

import { DatabaseService } from '@main/services/data/database.service';
import { ProxyProcessManager } from '@main/services/proxy/proxy-process.service';
import { AuthService } from '@main/services/security/auth.service';
import { SettingsService } from '@main/services/system/settings.service';
import { describe, expect, it, vi } from 'vitest';

describe('startup proxy bridge port integration', () => {
    it('fails startup when fixed OAuth bridge port 1455 is occupied', async () => {
        let listener: net.Server | undefined = net.createServer();
        await new Promise<void>((resolve, reject) => {
            listener?.once('error', (error: NodeJS.ErrnoException) => {
                if (error.code === 'EADDRINUSE') {
                    listener = undefined;
                    resolve();
                    return;
                }
                reject(error);
            });
            listener?.listen(1455, '127.0.0.1', () => resolve());
        });

        const service = new ProxyProcessManager(
            {
                getSettings: vi.fn().mockReturnValue({ proxy: { enabled: true, url: 'http://127.0.0.1:8317/v1', key: '' } }),
                saveSettings: vi.fn().mockResolvedValue(undefined),
            } as never as SettingsService,
            {
                getRuntimeMasterKeyHex: vi.fn().mockReturnValue(''),
            } as never as AuthService,
            {
                exec: vi.fn(),
            } as never as DatabaseService,
            {
                pushLogEntry: vi.fn(),
            } as any
        );
        Object.defineProperty(service, 'isExistingProxyHealthy', {
            value: vi.fn().mockResolvedValue(false),
        });

        const status = await service.start({ port: 8317 });
        listener?.close();

        expect(status.running).toBe(false);
        expect(status.errorCode).toBe('PROXY_PORT_IN_USE');
        expect(status.error).toContain('1455');
    });
});

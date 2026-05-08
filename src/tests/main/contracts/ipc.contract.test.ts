/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, it, vi } from 'vitest';

async function collectIpcChannels(): Promise<string[]> {
    const fs = await vi.importActual<typeof import('node:fs')>('node:fs');
    const path = await vi.importActual<typeof import('node:path')>('node:path');
    const ipcFile = path.join(process.cwd(), 'src', 'shared', 'constants', 'ipc-channels.ts');
    const channels: string[] = [];
    const re = /:\s*['"`]([A-Za-z0-9-]+:[A-Za-z0-9-]+)['"`]/g;

    const content = fs.readFileSync(ipcFile, 'utf8');
    let match: RegExpExecArray | null;
    while ((match = re.exec(content)) !== null) {
        if (match[1]) {
            channels.push(match[1]);
        }
    }

    return channels;
}

describe('IPC Contract', () => {
    it('keeps channel naming pattern namespace:action', async () => {
        const channels = await collectIpcChannels();
        expect(channels.length).toBeGreaterThan(30);
        for (const channel of channels) {
            expect(channel).toMatch(/^[A-Za-z0-9-]+:[A-Za-z0-9-]+/);
        }
    });
});


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

function getAllIpcFiles(
    fs: typeof import('node:fs'),
    path: typeof import('node:path'),
    dir: string
): string[] {
    const files: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...getAllIpcFiles(fs, path, full));
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
            files.push(full);
        }
    }
    return files;
}

describe('IPC Contract', () => {
    it('keeps channel naming pattern namespace:action', async () => {
        const fs = await vi.importActual<typeof import('node:fs')>('node:fs');
        const path = await vi.importActual<typeof import('node:path')>('node:path');
        const ipcFile = path.join(process.cwd(), 'src', 'shared', 'constants', 'ipc-channels.ts');
        const files = [ipcFile];

        const channels: string[] = [];
        const re = /:\s*['"`]([A-Za-z0-9-]+:[A-Za-z0-9-]+)['"`]/g;

        for (const file of files) {
            const content = fs.readFileSync(file, 'utf8');
            let match: RegExpExecArray | null;
            while ((match = re.exec(content)) !== null) {
                if (match[1]) {
                    channels.push(match[1]);
                }
            }
        }

        expect(channels.length).toBeGreaterThan(30);
        for (const channel of channels) {
            expect(channel).toMatch(/^[A-Za-z0-9-]+:[A-Za-z0-9-]+/);
        }
    });
});


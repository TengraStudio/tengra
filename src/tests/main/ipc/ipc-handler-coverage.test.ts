import { describe, expect, it, vi } from 'vitest';

const REQUIRED_FILES = [
    'advanced-memory.ts',
    'auth.ts',
    'brain.ts',
    'code-intelligence.ts',
    'db.ts',
    'dialog.ts',
    'extension.ts',
    'file-diff.ts',
    'files.ts',
    'gallery.ts',
    'git.ts',
    'idea-generator.ts',
    'mcp.ts',
    'mcp-marketplace.ts',
    'process.ts',
    'project-agent.ts',
    'proxy-embed.ts',
    'proxy.ts'
];

describe('IPC Handler Coverage', () => {
    it('includes handler registration and wrappers in required IPC modules', async () => {
        const fs = await vi.importActual<typeof import('node:fs')>('node:fs');
        const path = await vi.importActual<typeof import('node:path')>('node:path');
        const ipcDir = path.join(process.cwd(), 'src', 'main', 'ipc');

        for (const file of REQUIRED_FILES) {
            const fullPath = path.join(ipcDir, file);
            expect(fs.existsSync(fullPath), `missing file: ${file}`).toBe(true);
            const content = fs.readFileSync(fullPath, 'utf8');
            expect(/ipcMain\s*\.\s*handle\s*\(/.test(content), `${file} has no ipcMain.handle`).toBe(true);
            const hasWrapper = /create(IpcHandler|SafeIpcHandler|ValidatedIpcHandler)\s*\(/.test(content);
            const allowedManual =
                file === 'code-intelligence.ts' ||
                file === 'mcp-marketplace.ts' ||
                file === 'proxy.ts';
            expect(hasWrapper || allowedManual, `${file} should use a wrapper handler`).toBe(true);
        }
    });
});

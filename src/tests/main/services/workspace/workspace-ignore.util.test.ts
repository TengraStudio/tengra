import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';

import {
    clearWorkspaceIgnoreMatcherCache,
    getWorkspaceIgnoreMatcher,
} from '@main/services/workspace/workspace-ignore.util';
import { afterEach, describe, expect, it } from 'vitest';

const tempRoots: string[] = [];

async function createWorkspaceRoot(): Promise<string> {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), 'tengra-ignore-'));
    tempRoots.push(rootPath);
    return rootPath;
}

afterEach(async () => {
    clearWorkspaceIgnoreMatcherCache();
    await Promise.all(
        tempRoots.splice(0, tempRoots.length).map(rootPath =>
            rm(rootPath, { recursive: true, force: true })
        )
    );
});

describe('workspace-ignore.util', () => {
    it('honors .gitignore and .tengraignore patterns', async () => {
        const rootPath = await createWorkspaceRoot();
        await mkdir(path.join(rootPath, '.git', 'info'), { recursive: true });
        await writeFile(path.join(rootPath, '.gitignore'), '*.log\ndist/\n', 'utf8');
        await writeFile(path.join(rootPath, '.tengraignore'), 'notes/\n', 'utf8');

        const matcher = await getWorkspaceIgnoreMatcher(rootPath);

        expect(matcher.ignoresAbsolute(path.join(rootPath, 'debug.log'))).toBe(true);
        expect(matcher.ignoresAbsolute(path.join(rootPath, 'dist', 'index.ts'))).toBe(true);
        expect(matcher.ignoresAbsolute(path.join(rootPath, 'notes', 'todo.md'))).toBe(true);
        expect(matcher.ignoresAbsolute(path.join(rootPath, 'src', 'index.ts'))).toBe(false);
    });

    it('applies custom extra patterns for workspace-specific excludes', async () => {
        const rootPath = await createWorkspaceRoot();
        const matcher = await getWorkspaceIgnoreMatcher(rootPath, {
            extraPatterns: ['generated/', '*.cache'],
        });

        expect(matcher.ignoresAbsolute(path.join(rootPath, 'generated', 'file.ts'))).toBe(true);
        expect(matcher.ignoresAbsolute(path.join(rootPath, 'artifact.cache'))).toBe(true);
        expect(matcher.ignoresAbsolute(path.join(rootPath, 'src', 'file.ts'))).toBe(false);
    });

    it('supports negated rules that unignore matching paths', async () => {
        const rootPath = await createWorkspaceRoot();
        await writeFile(path.join(rootPath, '.gitignore'), 'dist/\n!dist/include.ts\n', 'utf8');

        const matcher = await getWorkspaceIgnoreMatcher(rootPath);

        expect(matcher.ignoresAbsolute(path.join(rootPath, 'dist', 'skip.ts'))).toBe(true);
        expect(matcher.ignoresAbsolute(path.join(rootPath, 'dist', 'include.ts'))).toBe(false);
    });
});

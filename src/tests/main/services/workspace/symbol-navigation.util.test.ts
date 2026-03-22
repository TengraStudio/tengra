import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockScanDirForSymbols,
    mockScanDirForText,
    mockScanDirRecursively,
} = vi.hoisted(() => ({
    mockScanDirForSymbols: vi.fn(async (_root: string, _query: string, _results: object[]) => undefined),
    mockScanDirForText: vi.fn(
        async (_root: string, _query: string, _isRegex: boolean, _results: object[]) => undefined
    ),
    mockScanDirRecursively: vi.fn(async (_root: string, _files: string[]) => undefined),
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

vi.mock('@main/services/workspace/code-intelligence/file-scanner.util', () => ({
    scanDirForSymbols: mockScanDirForSymbols,
    scanDirForText: mockScanDirForText,
    scanDirRecursively: mockScanDirRecursively,
}));

import type { DatabaseService } from '@main/services/data/database.service';
import {
    scoreFilePathMatch,
    searchFiles,
} from '@main/services/workspace/code-intelligence/symbol-navigation.util';

function createMockDb(): {
    [K in keyof DatabaseService]: ReturnType<typeof vi.fn>;
} {
    return {
        findCodeSymbolsByName: vi.fn(async () => []),
        searchCodeContentByText: vi.fn(async () => []),
    } as never as { [K in keyof DatabaseService]: ReturnType<typeof vi.fn> };
}

describe('symbol-navigation util', () => {
    let mockDb: ReturnType<typeof createMockDb>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockDb = createMockDb();
    });

    it('scores closer file path matches above unrelated paths', () => {
        const closeScore = scoreFilePathMatch('src/workspace-editor.tsx', 'work edit');
        const distantScore = scoreFilePathMatch('docs/changelog.md', 'work edit');

        expect(closeScore).toBeGreaterThan(distantScore);
        expect(closeScore).toBeGreaterThan(0);
    });

    it('includes fuzzy file path matches in workspace search results', async () => {
        mockScanDirRecursively.mockImplementationOnce(async (_root: string, files: string[]) => {
            files.push('/root/src/workspace-editor.tsx', '/root/src/terminal-panel.tsx');
        });

        const results = await searchFiles(
            mockDb as never as DatabaseService,
            '/root',
            'work edit',
            'workspace-1',
            false
        );

        expect(results).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    file: '/root/src/workspace-editor.tsx',
                    type: 'file',
                    text: 'src/workspace-editor.tsx',
                }),
            ])
        );
    });

    it('keeps regex text scanning enabled for regex queries', async () => {
        mockScanDirRecursively.mockImplementationOnce(async (_root: string, files: string[]) => {
            files.push('/root/src/workspace-editor.tsx');
        });

        await searchFiles(
            mockDb as never as DatabaseService,
            '/root',
            'Widget.*Factory',
            'workspace-1',
            true
        );

        expect(mockScanDirForText).toHaveBeenCalledWith(
            '/root',
            'Widget.*Factory',
            true,
            expect.any(Array)
        );
    });
});

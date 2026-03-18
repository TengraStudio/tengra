import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    app: { getPath: () => '/tmp' }
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

vi.mock('fs/promises', () => ({
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@shared/utils/error.util', () => ({
    getErrorMessage: (e: TestValue) => (e instanceof Error ? e.message : String(e))
}));

import { mkdir, writeFile } from 'fs/promises';

import { WorkspaceScaffoldService } from '@main/services/workspace/workspace-scaffold.service';
import { WorkspaceIdea } from '@shared/types/ideas';

const mockedMkdir = vi.mocked(mkdir);
const mockedWriteFile = vi.mocked(writeFile);

function createIdea(category: WorkspaceIdea['category']): WorkspaceIdea {
    return {
        id: 'idea-1',
        sessionId: 'session-1',
        title: 'Test Workspace',
        description: 'A test workspace description',
        explanation: 'This is a test',
        category,
        valueProposition: 'Great value',
        competitiveAdvantages: ['Fast', 'Simple'],
        nameSuggestions: ['TestApp', 'TestTool'],
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}

describe('WorkspaceScaffoldService', () => {
    let service: WorkspaceScaffoldService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new WorkspaceScaffoldService();
    });

    describe('scaffoldWorkspace - website', () => {
        it('should create website scaffold with directories and files', async () => {
            const idea = createIdea('website');
            await service.scaffoldWorkspace(idea, '/target/path');

            // Creates workspace directory + subdirectories.
            expect(mockedMkdir).toHaveBeenCalledWith('/target/path', { recursive: true });
            expect(mockedMkdir).toHaveBeenCalledWith(
                expect.stringContaining('css'),
                { recursive: true }
            );

            // Creates files including README
            expect(mockedWriteFile).toHaveBeenCalledWith(
                expect.stringContaining('README.md'),
                expect.stringContaining('Test Workspace')
            );
            expect(mockedWriteFile).toHaveBeenCalledWith(
                expect.stringContaining('index.html'),
                expect.stringContaining('Test Workspace')
            );
        });
    });

    describe('scaffoldWorkspace - mobile-app', () => {
        it('should create mobile app scaffold', async () => {
            const idea = createIdea('mobile-app');
            await service.scaffoldWorkspace(idea, '/target/mobile');

            expect(mockedWriteFile).toHaveBeenCalledWith(
                expect.stringContaining('App.tsx'),
                expect.any(String)
            );
            expect(mockedWriteFile).toHaveBeenCalledWith(
                expect.stringContaining('package.json'),
                expect.any(String)
            );
        });
    });

    describe('scaffoldWorkspace - game', () => {
        it('should create game scaffold', async () => {
            const idea = createIdea('game');
            await service.scaffoldWorkspace(idea, '/target/game');

            expect(mockedMkdir).toHaveBeenCalledWith(
                expect.stringContaining('images'),
                { recursive: true }
            );
            expect(mockedWriteFile).toHaveBeenCalledWith(
                expect.stringContaining('config.json'),
                expect.any(String)
            );
        });
    });

    describe('scaffoldWorkspace - cli-tool', () => {
        it('should create CLI tool scaffold', async () => {
            const idea = createIdea('cli-tool');
            await service.scaffoldWorkspace(idea, '/target/cli');

            expect(mockedMkdir).toHaveBeenCalledWith(
                expect.stringContaining('bin'),
                { recursive: true }
            );
            expect(mockedWriteFile).toHaveBeenCalledWith(
                expect.stringContaining('cli.js'),
                expect.any(String)
            );
        });
    });

    describe('scaffoldWorkspace - desktop', () => {
        it('should create desktop scaffold', async () => {
            const idea = createIdea('desktop');
            await service.scaffoldWorkspace(idea, '/target/desktop');

            expect(mockedWriteFile).toHaveBeenCalledWith(
                expect.stringContaining('preload.js'),
                expect.any(String)
            );
        });
    });

    describe('scaffoldWorkspace - other', () => {
        it('should create generic scaffold for unknown category', async () => {
            const idea = createIdea('other');
            await service.scaffoldWorkspace(idea, '/target/other');

            expect(mockedMkdir).toHaveBeenCalledWith(
                expect.stringContaining('docs'),
                { recursive: true }
            );
        });
    });

    describe('scaffoldWorkspace - error handling', () => {
        it('should throw when mkdir fails', async () => {
            mockedMkdir.mockRejectedValueOnce(new Error('EACCES'));
            const idea = createIdea('website');
            await expect(service.scaffoldWorkspace(idea, '/noperm')).rejects.toThrow('EACCES');
        });

        it('should throw when writeFile fails', async () => {
            mockedWriteFile.mockRejectedValueOnce(new Error('ENOSPC'));
            const idea = createIdea('website');
            await expect(service.scaffoldWorkspace(idea, '/full-disk')).rejects.toThrow('ENOSPC');
        });
    });

    describe('generateReadme', () => {
        it('should generate README with title and description', () => {
            const idea = createIdea('website');
            const readme = service.generateReadme(idea);
            expect(readme).toContain('# Test Workspace');
            expect(readme).toContain('A test workspace description');
            expect(readme).toContain('Great value');
            expect(readme).toContain('Fast');
            expect(readme).toContain('TestApp');
        });

        it('should handle idea without optional fields', () => {
            const idea = createIdea('other');
            idea.competitiveAdvantages = undefined as never;
            idea.nameSuggestions = undefined as never;
            idea.explanation = undefined as never;
            idea.valueProposition = undefined as never;
            const readme = service.generateReadme(idea);
            expect(readme).toContain('# Test Workspace');
        });
    });

    describe('cleanup', () => {
        it('should resolve without error', async () => {
            await expect(service.cleanup()).resolves.toBeUndefined();
        });
    });
});

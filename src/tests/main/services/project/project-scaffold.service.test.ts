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
    getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e))
}));

import { mkdir, writeFile } from 'fs/promises';

import { ProjectScaffoldService } from '@main/services/project/project-scaffold.service';
import { ProjectIdea } from '@shared/types/ideas';

const mockedMkdir = vi.mocked(mkdir);
const mockedWriteFile = vi.mocked(writeFile);

function createIdea(category: ProjectIdea['category']): ProjectIdea {
    return {
        id: 'idea-1',
        sessionId: 'session-1',
        title: 'Test Project',
        description: 'A test project description',
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

describe('ProjectScaffoldService', () => {
    let service: ProjectScaffoldService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new ProjectScaffoldService();
    });

    describe('scaffoldProject - website', () => {
        it('should create website scaffold with directories and files', async () => {
            const idea = createIdea('website');
            await service.scaffoldProject(idea, '/target/path');

            // Creates project directory + subdirectories
            expect(mockedMkdir).toHaveBeenCalledWith('/target/path', { recursive: true });
            expect(mockedMkdir).toHaveBeenCalledWith(
                expect.stringContaining('css'),
                { recursive: true }
            );

            // Creates files including README
            expect(mockedWriteFile).toHaveBeenCalledWith(
                expect.stringContaining('README.md'),
                expect.stringContaining('Test Project')
            );
            expect(mockedWriteFile).toHaveBeenCalledWith(
                expect.stringContaining('index.html'),
                expect.stringContaining('Test Project')
            );
        });
    });

    describe('scaffoldProject - mobile-app', () => {
        it('should create mobile app scaffold', async () => {
            const idea = createIdea('mobile-app');
            await service.scaffoldProject(idea, '/target/mobile');

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

    describe('scaffoldProject - game', () => {
        it('should create game scaffold', async () => {
            const idea = createIdea('game');
            await service.scaffoldProject(idea, '/target/game');

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

    describe('scaffoldProject - cli-tool', () => {
        it('should create CLI tool scaffold', async () => {
            const idea = createIdea('cli-tool');
            await service.scaffoldProject(idea, '/target/cli');

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

    describe('scaffoldProject - desktop', () => {
        it('should create desktop scaffold', async () => {
            const idea = createIdea('desktop');
            await service.scaffoldProject(idea, '/target/desktop');

            expect(mockedWriteFile).toHaveBeenCalledWith(
                expect.stringContaining('preload.js'),
                expect.any(String)
            );
        });
    });

    describe('scaffoldProject - other', () => {
        it('should create generic scaffold for unknown category', async () => {
            const idea = createIdea('other');
            await service.scaffoldProject(idea, '/target/other');

            expect(mockedMkdir).toHaveBeenCalledWith(
                expect.stringContaining('docs'),
                { recursive: true }
            );
        });
    });

    describe('scaffoldProject - error handling', () => {
        it('should throw when mkdir fails', async () => {
            mockedMkdir.mockRejectedValueOnce(new Error('EACCES'));
            const idea = createIdea('website');
            await expect(service.scaffoldProject(idea, '/noperm')).rejects.toThrow('EACCES');
        });

        it('should throw when writeFile fails', async () => {
            mockedWriteFile.mockRejectedValueOnce(new Error('ENOSPC'));
            const idea = createIdea('website');
            await expect(service.scaffoldProject(idea, '/full-disk')).rejects.toThrow('ENOSPC');
        });
    });

    describe('generateReadme', () => {
        it('should generate README with title and description', () => {
            const idea = createIdea('website');
            const readme = service.generateReadme(idea);
            expect(readme).toContain('# Test Project');
            expect(readme).toContain('A test project description');
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
            expect(readme).toContain('# Test Project');
        });
    });

    describe('cleanup', () => {
        it('should resolve without error', async () => {
            await expect(service.cleanup()).resolves.toBeUndefined();
        });
    });
});

import { ImagePersistenceService } from '@main/services/data/image-persistence.service';
import { LogoService } from '@main/services/external/logo.service';
import { LLMService } from '@main/services/llm/llm.service';
import { LocalImageService } from '@main/services/llm/local-image.service';
import { ModelProviderInfo, ModelRegistryService } from '@main/services/llm/model-registry.service';
import { WorkspaceAnalysis, WorkspaceService } from '@main/services/workspace/workspace.service';
import { QuotaService } from '@main/services/proxy/quota.service';
import { AuthService } from '@main/services/security/auth.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface LogoServicePrivate {
    saveGeneratedImage(
        workspacePath: string,
        sourcePathOrUrl: string,
        prompt: string,
        model: string
    ): Promise<string>;
}

interface LogoTestContext {
    service: LogoService;
    chatMock: ReturnType<typeof vi.fn<LLMService['chat']>>;
    getAllModelsMock: ReturnType<typeof vi.fn<ModelRegistryService['getAllModels']>>;
}

const PROJECT_ANALYSIS: WorkspaceAnalysis = {
    type: 'node',
    frameworks: ['react'],
    dependencies: {},
    devDependencies: {},
    stats: { fileCount: 1, totalSize: 1, loc: 1, lastModified: 1 },
    languages: { TypeScript: 1 },
    files: [],
    todos: [],
};

const createService = (): LogoTestContext => {
    const chatMock = vi.fn<LLMService['chat']>().mockResolvedValue({
        content: '',
        role: 'assistant',
        images: ['https://assets.example/logo.png'],
    });
    const getAllModelsMock = vi
        .fn<ModelRegistryService['getAllModels']>()
        .mockResolvedValue([]);

    const deps: ConstructorParameters<typeof LogoService>[0] = {
        llmService: { chat: chatMock } as unknown as LLMService,
        workspaceService: {
            analyzeWorkspace: vi.fn<WorkspaceService['analyzeProject']>().mockResolvedValue(PROJECT_ANALYSIS),
        } as unknown as WorkspaceService,
        localImageService: {
            generateImage: vi.fn<LocalImageService['generateImage']>().mockResolvedValue(''),
        } as unknown as LocalImageService,
        imagePersistenceService: {
            saveImage: vi.fn<ImagePersistenceService['saveImage']>().mockResolvedValue('safe-file:///mock.png'),
        } as unknown as ImagePersistenceService,
        authService: {
            getAllAccounts: vi.fn<AuthService['getAllAccounts']>().mockResolvedValue([]),
            setActiveAccount: vi.fn<AuthService['setActiveAccount']>().mockResolvedValue(undefined),
            getAccountsByProvider: vi.fn<AuthService['getAccountsByProvider']>().mockResolvedValue([]),
        } as unknown as AuthService,
        quotaService: {
            getQuota: vi.fn<QuotaService['getQuota']>().mockResolvedValue({ accounts: [] }),
            getCopilotQuota: vi.fn<QuotaService['getCopilotQuota']>().mockResolvedValue({ accounts: [] }),
            getClaudeQuota: vi.fn<QuotaService['getClaudeQuota']>().mockResolvedValue({ accounts: [] }),
        } as unknown as QuotaService,
        modelRegistryService: {
            getAllModels: getAllModelsMock,
        } as unknown as ModelRegistryService,
    };

    return {
        service: new LogoService(deps),
        chatMock,
        getAllModelsMock,
    };
};

describe('LogoService generation model fallback', () => {
    let context: LogoTestContext;

    beforeEach(() => {
        vi.restoreAllMocks();
        context = createService();
    });

    it('resolves provider from registry suffix match when model prefix is omitted', async () => {
        const registryModels: ModelProviderInfo[] = [
            {
                id: 'openai/gpt-4o-mini',
                name: 'GPT-4o Mini',
                provider: 'openai',
            },
        ];
        context.getAllModelsMock.mockResolvedValue(registryModels);
        const saveSpy = vi
            .spyOn(context.service as unknown as LogoServicePrivate, 'saveGeneratedImage')
            .mockResolvedValue('/tmp/logo-registry.png');

        const result = await context.service.generateLogo(
            'C:\\project',
            'orbit app',
            'Minimalist',
            'gpt-4o-mini'
        );

        expect(result).toEqual(['/tmp/logo-registry.png']);
        expect(context.chatMock).toHaveBeenCalledWith(
            expect.any(Array),
            'gpt-4o-mini',
            [],
            'openai'
        );
        expect(saveSpy).toHaveBeenCalledWith(
            'C:\\project',
            'https://assets.example/logo.png',
            expect.stringContaining('Core Concept: orbit app'),
            'openai/gpt-4o-mini'
        );
    });

    it('uses explicit provider-prefixed model names without registry lookup', async () => {
        const saveSpy = vi
            .spyOn(context.service as unknown as LogoServicePrivate, 'saveGeneratedImage')
            .mockResolvedValue('/tmp/logo-prefixed.png');

        const result = await context.service.generateLogo(
            'C:\\project',
            'orbital telemetry',
            'Minimalist',
            'openai/gpt-4.1-mini'
        );

        expect(result).toEqual(['/tmp/logo-prefixed.png']);
        expect(context.getAllModelsMock).not.toHaveBeenCalled();
        expect(context.chatMock).toHaveBeenCalledWith(
            expect.any(Array),
            'gpt-4.1-mini',
            [],
            'openai'
        );
        expect(saveSpy).toHaveBeenCalledWith(
            'C:\\project',
            'https://assets.example/logo.png',
            expect.stringContaining('Core Concept: orbital telemetry'),
            'openai/gpt-4.1-mini'
        );
    });

    it('falls back to model-only generation when registry lookup fails', async () => {
        context.getAllModelsMock.mockRejectedValue(new Error('registry unavailable'));
        const saveSpy = vi
            .spyOn(context.service as unknown as LogoServicePrivate, 'saveGeneratedImage')
            .mockResolvedValue('/tmp/logo-fallback.png');

        const result = await context.service.generateLogo(
            'C:\\project',
            'fallback logo',
            'Minimalist',
            'mystery-model'
        );

        expect(result).toEqual(['/tmp/logo-fallback.png']);
        expect(context.chatMock).toHaveBeenCalledWith(
            expect.any(Array),
            'mystery-model',
            [],
            undefined
        );
        expect(saveSpy).toHaveBeenCalledWith(
            'C:\\project',
            'https://assets.example/logo.png',
            expect.stringContaining('Core Concept: fallback logo'),
            'undefined/mystery-model'
        );
    });
});

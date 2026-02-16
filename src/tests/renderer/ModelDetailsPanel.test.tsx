import { ModelDetailsPanel } from '@renderer/features/models/components/ModelDetailsPanel';
import type { OllamaLibraryModel } from '@renderer/features/models/types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

describe('ModelDetailsPanel', () => {
    it('sanitizes longDescriptionHtml script and event-handler payloads', () => {
        const selectedModel: OllamaLibraryModel = {
            provider: 'ollama',
            name: 'test-model',
            description: 'test',
            tags: ['latest'],
            longDescriptionHtml:
                '<p>Safe</p><img src="x" onerror="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">bad</a>',
            versions: [
                {
                    version: 'latest',
                    size: '1 GB',
                    maxContext: '8k',
                    inputType: 'text',
                    digest: 'sha256:test',
                },
            ],
        };

        const { container } = render(
            <ModelDetailsPanel
                selectedModel={selectedModel}
                setSelectedModel={vi.fn()}
                loadingFiles={false}
                files={[]}
                modelsDir=""
                downloading={{}}
                handleDownloadHF={vi.fn()}
                handlePullOllama={vi.fn()}
                pullingOllama={null}
                t={(key: string) => key}
            />
        );

        expect(screen.getByText('Safe')).toBeInTheDocument();
        expect(container.querySelector('script')).toBeNull();

        const unsafeImg = container.querySelector('img');
        expect(unsafeImg?.getAttribute('onerror')).toBeNull();

        const badLink = screen.getByText('bad').closest('a');
        expect(badLink?.getAttribute('href')?.toLowerCase() ?? '').not.toContain('javascript:');
    });
});

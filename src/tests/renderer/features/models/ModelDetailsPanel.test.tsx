/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ModelDetailsPanel } from '@/features/models/components/ModelDetailsPanel';
import type { OllamaLibraryModel } from '@/features/models/types';

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


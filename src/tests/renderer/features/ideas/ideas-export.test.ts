import { IdeaSession, WorkspaceIdea } from '@shared/types/ideas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { exportIdeas } from '@/features/ideas/utils/exportIdeas';

const mockSession: IdeaSession = {
    id: 'session-1',
    status: 'completed',
    model: 'test-model',
    provider: 'ollama',
    categories: ['website'],
    maxIdeas: 5,
    ideasGenerated: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
};

const mockIdeas: WorkspaceIdea[] = [
    {
        id: 'idea-1',
        sessionId: 'session-1',
        title: 'Test App',
        description: 'A test application',
        category: 'website',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
    } as WorkspaceIdea,
];

describe('exportIdeas', () => {
    let clickedLink: { href: string; download: string } | null = null;

    beforeEach(() => {
        clickedLink = null;

        // Mock DOM APIs for download
        const originalCreateElement = Document.prototype.createElement.bind(document);
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
        vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
        vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
        vi.spyOn(document, 'createElement').mockImplementation(((tag: string): HTMLElement => {
            if (tag === 'a') {
                const anchor = originalCreateElement('a') as HTMLAnchorElement;
                vi.spyOn(anchor, 'click').mockImplementation(() => {
                        clickedLink = { href: anchor.href, download: anchor.download };
                });
                return anchor;
            }
            return originalCreateElement(tag);
        }) as typeof document.createElement);

        window.electron = {
            ...window.electron,
            log: {
                ...window.electron?.log,
                error: vi.fn(),
            },
        } as typeof window.electron;
    });

    it('should export ideas as JSON', () => {
        exportIdeas(mockSession, mockIdeas, 'json');
        expect(clickedLink).toBeTruthy();
        expect(clickedLink?.download).toContain('.json');
        expect(URL.createObjectURL).toHaveBeenCalled();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
    });

    it('should export ideas as markdown', () => {
        exportIdeas(mockSession, mockIdeas, 'markdown');
        expect(clickedLink).toBeTruthy();
        expect(clickedLink?.download).toContain('.md');
    });

    it('should include session id in filename', () => {
        exportIdeas(mockSession, mockIdeas, 'json');
        expect(clickedLink?.download).toContain('session-1');
    });
});

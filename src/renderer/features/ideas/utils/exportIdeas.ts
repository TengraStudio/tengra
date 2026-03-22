import { IdeaSession, WorkspaceIdea } from '@shared/types/ideas';

import { appLogger } from '@/utils/renderer-logger';

export const exportIdeas = (currentSession: IdeaSession, ideas: WorkspaceIdea[], format: 'markdown' | 'json'): void => {
    try {
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `ideas-${currentSession.id}-${timestamp}.${format === 'markdown' ? 'md' : 'json'}`;

        let content: string;

        if (format === 'markdown') {
            content = `# Workspace Ideas - ${new Date().toLocaleDateString()}\n\n`;
            content += `**Session ID:** ${currentSession.id}\n`;
            content += `**Total Ideas:** ${ideas.length}\n\n`;
            content += `---\n\n`;

            ideas.forEach((idea, idx) => {
                const statusEmoji = idea.status === 'approved' ? '✅' : idea.status === 'rejected' ? '❌' : '⏳';
                content += `## ${idx + 1}. ${idea.title} ${statusEmoji}\n\n`;
                content += `**Category:** ${idea.category}\n`;
                content += `**Status:** ${idea.status}\n\n`;
                content += `${idea.description}\n\n`;

                if (idea.marketResearch) {
                    content += `### Market Analysis\n${idea.marketResearch.categoryAnalysis ?? ''}\n\n`;
                }

                if (idea.techStack) {
                    content += `### Tech Stack\n`;
                    const stack = idea.techStack;
                    if (stack.frontend.length) { content += `- Frontend: ${stack.frontend.map(t => t.name).join(', ')}\n`; }
                    if (stack.backend.length) { content += `- Backend: ${stack.backend.map(t => t.name).join(', ')}\n`; }
                    content += '\n';
                }

                content += `---\n\n`;
            });
        } else {
            const exportData = {
                exportedAt: new Date().toISOString(),
                sessionId: currentSession.id,
                totalIdeas: ideas.length,
                ideas: ideas.map(idea => ({
                    id: idea.id,
                    title: idea.title,
                    description: idea.description,
                    category: idea.category,
                    status: idea.status,
                    marketResearch: idea.marketResearch,
                    techStack: idea.techStack,
                    createdAt: idea.createdAt
                }))
            };
            content = JSON.stringify(exportData, null, 2);
        }

        const blob = new Blob([content], {
            type: format === 'markdown' ? 'text/markdown' : 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        appLogger.error('ExportIdeas', 'Failed to export ideas', err as Error);
    }
};


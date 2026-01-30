import { IdeaSession, ProjectIdea } from '@shared/types/ideas';

export const generateMarkdownExport = (currentSession: IdeaSession, ideas: ProjectIdea[]): string => {
    let content = `# Project Ideas - ${new Date().toLocaleDateString()}\n\n`;
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
    return content;
};

export const generateJsonExport = (currentSession: IdeaSession, ideas: ProjectIdea[]): string => {
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
    return JSON.stringify(exportData, null, 2);
};

export const exportIdeasToFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

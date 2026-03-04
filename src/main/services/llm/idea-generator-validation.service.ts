import { CatchError } from '@shared/types/common';
import { IdeaCategory, ProjectIdea } from '@shared/types/ideas';

export class IdeaGeneratorValidationService {
    isTitleTooSimilar(newTitle: string, existingIdeas: ProjectIdea[]): boolean {
        const normalizedNew = newTitle.toLowerCase().trim();

        for (const existing of existingIdeas) {
            const normalizedExisting = existing.title.toLowerCase().trim();
            if (normalizedNew === normalizedExisting) {
                return true;
            }

            const newWords = new Set(normalizedNew.split(/\s+/).filter(word => word.length > 2));
            const existingWords = new Set(
                normalizedExisting.split(/\s+/).filter(word => word.length > 2)
            );

            if (newWords.size === 0 || existingWords.size === 0) {
                continue;
            }

            let matches = 0;
            for (const word of newWords) {
                if (existingWords.has(word)) {
                    matches += 1;
                }
            }

            const similarity = matches / Math.max(newWords.size, existingWords.size);
            if (similarity > 0.7) {
                return true;
            }
        }

        return false;
    }

    isIdeaTooSimilar(
        newIdea: { title: string; description: string },
        existingIdeas: ProjectIdea[]
    ): boolean {
        if (this.isTitleTooSimilar(newIdea.title, existingIdeas)) {
            return true;
        }

        const newDescriptionWords = new Set(
            newIdea.description
                .toLowerCase()
                .split(/\s+/)
                .filter(word => word.length > 3)
        );
        if (newDescriptionWords.size === 0) {
            return false;
        }

        for (const existing of existingIdeas) {
            const existingWords = new Set(
                existing.description
                    .toLowerCase()
                    .split(/\s+/)
                    .filter(word => word.length > 3)
            );
            if (existingWords.size === 0) {
                continue;
            }

            let matches = 0;
            for (const word of newDescriptionWords) {
                if (existingWords.has(word)) {
                    matches += 1;
                }
            }

            const similarity = matches / Math.max(newDescriptionWords.size, existingWords.size);
            if (similarity > 0.5) {
                return true;
            }
        }

        return false;
    }

    buildPreviousIdeasContext(ideas: ProjectIdea[], currentCategories: IdeaCategory[]): string {
        if (ideas.length === 0) {
            return '';
        }

        const relevantIdeas = ideas
            .filter(idea => currentCategories.includes(idea.category))
            .slice(0, 50);
        if (relevantIdeas.length === 0) {
            return '';
        }

        const ideaList = relevantIdeas
            .map(idea => `- "${idea.title}": ${idea.description.slice(0, 100)}`)
            .join('\n');

        return `\n\n=== PREVIOUSLY GENERATED IDEAS (DO NOT REPEAT THESE) ===
The following ideas have already been generated. You MUST create something COMPLETELY DIFFERENT:
${ideaList}

IMPORTANT: Your new idea must be distinctly different from ALL of the above. Do not use similar names, concepts, or approaches.
============================================\n\n`;
    }

    isRetryableError(error: CatchError): boolean {
        const normalized = String(error).toLowerCase();
        return (
            normalized.includes('rate limit') ||
            normalized.includes('429') ||
            normalized.includes('quota') ||
            normalized.includes('timeout') ||
            normalized.includes('econnreset') ||
            normalized.includes('etimedout') ||
            normalized.includes('network') ||
            normalized.includes('temporarily unavailable') ||
            normalized.includes('socket hang up')
        );
    }

    sanitizeCustomPrompt(prompt: string): string {
        return prompt
            .replace(/```/g, '')
            .replace(/===+/g, '---')
            .replace(/(\r?\n){3,}/g, '\n\n')
            .slice(0, 1000);
    }
}

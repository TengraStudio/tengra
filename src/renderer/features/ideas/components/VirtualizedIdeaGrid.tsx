/**
 * Virtualized Idea Grid Component
 * Uses react-virtuoso for efficient rendering of large idea lists
 */

import { ProjectIdea } from '@shared/types/ideas';
import { Lightbulb } from 'lucide-react';
import React, { useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';

import { useTranslation } from '@/i18n';

import { IdeaCard } from './IdeaCard';

interface VirtualizedIdeaGridProps {
    ideas: ProjectIdea[]
    onSelectIdea: (idea: ProjectIdea) => void
    itemsPerRow?: number
    itemHeight?: number
}

export const VirtualizedIdeaGrid: React.FC<VirtualizedIdeaGridProps> = ({
    ideas,
    onSelectIdea,
    itemsPerRow = 2,
    itemHeight = 320
}) => {
    const { t } = useTranslation();

    // Create rows of ideas for virtualization
    const ideaRows = useMemo(() => {
        const rows = [];
        for (let i = 0; i < ideas.length; i += itemsPerRow) {
            rows.push(ideas.slice(i, i + itemsPerRow));
        }
        return rows;
    }, [ideas, itemsPerRow]);

    const renderRow = (index: number) => {
        const row = ideaRows[index];
        if (!row) {
            return null;
        }

        return (
            <div
                className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4"
                style={{ height: itemHeight }}
            >
                {row.map((idea) => (
                    <IdeaCard
                        key={idea.id}
                        idea={idea}
                        onClick={() => onSelectIdea(idea)}
                    />
                ))}
                {/* Fill empty slots in the last row */}
                {row.length < itemsPerRow && Array.from({ length: itemsPerRow - row.length }).map((_, emptyIndex) => (
                    <div key={`empty-${emptyIndex}`} />
                ))}
            </div>
        );
    };

    if (ideas.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                    <Lightbulb className="w-8 h-8 text-muted-foreground/30" />
                </div>
                <h3 className="text-lg font-medium text-muted-foreground/60">
                    {t('ideas.empty.noIdeas')}
                </h3>
                <p className="text-sm text-muted-foreground/40 mt-1">
                    {t('ideas.empty.noIdeasDesc')}
                </p>
            </div>
        );
    }

    // For small lists (< 20 items), use regular grid for better UX
    if (ideas.length < 20) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ideas.map(idea => (
                    <IdeaCard
                        key={idea.id}
                        idea={idea}
                        onClick={() => onSelectIdea(idea)}
                    />
                ))}
            </div>
        );
    }

    return (
        <Virtuoso
            style={{ height: '70vh' }}
            totalCount={ideaRows.length}
            itemContent={renderRow}
            overscan={2}
            data={ideaRows}
        />
    );
};

export default VirtualizedIdeaGrid;
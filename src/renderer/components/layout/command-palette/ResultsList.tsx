import { CommandItem } from '@renderer/components/layout/CommandPalette';
import { Search } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

import './results-list.css';

interface ResultsListProps {
    groupedCommands: Record<string, CommandItem[]>;
    categoryLabels: Record<string, string>;
    selectedIndex: number;
    setSelectedIndex: (id: string) => void;
    getFlatIndex: () => number;
    noResults: boolean;
    t: (key: string) => string;
}

export const ResultsList: React.FC<ResultsListProps> = ({
    groupedCommands,
    categoryLabels,
    selectedIndex,
    setSelectedIndex,
    getFlatIndex,
    noResults,
    t,
}) => {
    return (
        <div
            className="tengra-results-list custom-scrollbar"
            role="listbox"
            aria-label={t('commandPalette.results')}
        >
            {Object.entries(groupedCommands).map(([category, items]) => (
                <div key={category}>
                    <h3 className="tengra-results-list__heading">
                        {categoryLabels[category]}
                    </h3>
                    {items.map(cmd => {
                        const flatIdx = getFlatIndex();
                        const isSelected = flatIdx === selectedIndex;
                        return (
                            <button
                                id={`command-option-${cmd.id}`}
                                key={cmd.id}
                                onClick={cmd.action}
                                onMouseEnter={() => setSelectedIndex(cmd.id)}
                                className={cn(
                                    'tengra-results-list__item',
                                    isSelected && 'tengra-results-list__item--selected'
                                )}
                                role="option"
                                aria-selected={isSelected}
                            >
                                <span
                                    className={cn(
                                        'tengra-results-list__item-icon-wrap',
                                        isSelected && 'tengra-results-list__item-icon-wrap--selected'
                                    )}
                                >
                                    {cmd.icon}
                                </span>
                                <div className="tengra-results-list__item-content">
                                    <div className="tengra-results-list__item-label truncate">
                                        {cmd.label}
                                    </div>
                                    {cmd.description && (
                                        <div
                                            className={cn(
                                                'tengra-results-list__item-description truncate',
                                                isSelected
                                                    ? 'tengra-results-list__item-description--selected'
                                                    : 'tengra-results-list__item-description--default'
                                            )}
                                        >
                                            {cmd.description}
                                        </div>
                                    )}
                                </div>
                                {cmd.shortcut && (
                                    <kbd
                                        className={cn(
                                            'tengra-results-list__kbd',
                                            isSelected
                                                ? 'tengra-results-list__kbd--selected'
                                                : 'tengra-results-list__kbd--default'
                                        )}
                                    >
                                        {cmd.shortcut}
                                    </kbd>
                                )}
                            </button>
                        );
                    })}
                </div>
            ))}

            {noResults && (
                <div className="tengra-results-list__empty">
                    <div className="tengra-results-list__empty-icon-wrap">
                        <Search className="tengra-results-list__empty-icon" />
                    </div>
                    <div className="text-foreground font-semibold mb-1">
                        {t('commandPalette.noResults')}
                    </div>
                    <div className="text-muted-foreground/50 text-xs">
                        {t('commandPalette.noResultsHint')}
                    </div>
                </div>
            )}
        </div>
    );
};

ResultsList.displayName = 'ResultsList';

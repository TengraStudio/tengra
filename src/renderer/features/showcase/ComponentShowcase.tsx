/**
 * Component Showcase - lightweight Storybook alternative.
 * Renders shared UI components with interactive prop controls.
 */
import { ChevronRight, Component, Moon, Sun } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';

import {
  animatedCardStory,
  badgeStory,
  buttonStory,
  cardStory,
  confirmationModalStory,
  formModalStory,
  inputStory,
  modalStory,
  rippleButtonStory,
  textareaStory,
} from './stories';
import type { ComponentStory } from './types';

const ALL_STORIES: ComponentStory[] = [
  buttonStory, rippleButtonStory,
  inputStory, textareaStory,
  cardStory, animatedCardStory, badgeStory,
  modalStory, confirmationModalStory, formModalStory,
];

/** Groups stories by their category field */
const groupByCategory = (stories: ComponentStory[]): Record<string, ComponentStory[]> => {
  const groups: Record<string, ComponentStory[]> = {};
  for (const story of stories) {
    const cat = story.category ?? 'showcase.categories.other';
    if (!groups[cat]) { groups[cat] = []; }
    groups[cat].push(story);
  }
  return groups;
};

/** Sidebar listing all available component stories */
const StorySidebar: React.FC<{
  stories: ComponentStory[]
  selected: string
  onSelect: (name: string) => void
}> = ({ stories, selected, onSelect }) => {
  const grouped = useMemo(() => groupByCategory(stories), [stories]);
  const { t } = useTranslation();

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-card/50 overflow-y-auto">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Component className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-sm">{t('common.components')}</h2>
        </div>
      </div>
      <nav className="p-2">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="mb-3">
            <p className="px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
              {t(category)}
            </p>
            {items.map((s) => (
              <button
                key={s.name}
                onClick={() => onSelect(s.name)}
                className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1.5 ${
                  selected === s.name
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-muted/40'
                }`}
              >
                <ChevronRight className="w-3 h-3" />
                {t(s.name)}
              </button>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
};

/** Preview panel rendering a story's variants */
const StoryPreview: React.FC<{ story: ComponentStory }> = ({ story }) => {
  const Comp = story.component;
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">{t(story.name)}</h1>
      <div className="grid gap-4">
        {story.variants.map((variant) => (
          <div
            key={variant.name}
            className="p-4 rounded-xl border border-border bg-card/30"
          >
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-sm font-semibold">{t(variant.name)}</h3>
              {variant.description && (
                <span className="text-[10px] text-muted-foreground">{t(variant.description)}</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Comp {...variant.props} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/** Main showcase page component */
export const ComponentShowcase: React.FC = () => {
  const [selected, setSelected] = useState(ALL_STORIES[0].name);
  const [darkMode, setDarkMode] = useState(true);
  const { t } = useTranslation();

  const activeStory = useMemo(
    () => ALL_STORIES.find((s) => s.name === selected) ?? ALL_STORIES[0],
    [selected],
  );

  return (
    <div className={`flex h-full ${darkMode ? 'dark' : ''}`}>
      <StorySidebar stories={ALL_STORIES} selected={selected} onSelect={setSelected} />
      <main className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t('showcase.preview.title')}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDarkMode((d) => !d)}
            aria-label={t('showcase.preview.toggleThemeAria')}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
        <div className="p-6">
          <StoryPreview story={activeStory} />
        </div>
      </main>
    </div>
  );
};

ComponentShowcase.displayName = 'ComponentShowcase';

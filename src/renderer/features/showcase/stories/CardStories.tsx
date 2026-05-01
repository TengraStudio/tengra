/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Story definitions for Card and AnimatedCard components.
 * Showcases basic cards, headers, content, and animation effects.
 */
import React from 'react';

import { AnimatedCard } from '@/components/ui/AnimatedCard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/i18n';

import type { ComponentStory } from '../types';

const CardWrapper: React.FC<Record<string, RendererDataValue>> = (props) => {
  const { t } = useTranslation();
  const { title, content, withBadge, badgeText } = props as {
    title?: string
    content?: string
    withBadge?: boolean
    badgeText?: string
  };

  return (
    <Card className="w-72">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title ? t(title) : t('frontend.showcase.card.fallback.title')}</CardTitle>
          {withBadge && <Badge variant="secondary">{badgeText ? t(badgeText) : t('frontend.showcase.card.fallback.badge')}</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {content ? t(content) : t('frontend.showcase.card.fallback.content')}
        </p>
      </CardContent>
    </Card>
  );
};

const AnimatedCardWrapper: React.FC<Record<string, RendererDataValue>> = (props) => {
  const { t } = useTranslation();
  const { hoverEffect, title, content } = props as {
    hoverEffect?: 'lift' | 'glow' | 'scale' | '3d' | 'none'
    title?: string
    content?: string
  };

  return (
    <AnimatedCard hoverEffect={hoverEffect} className="w-72">
      <h3 className="font-semibold mb-2">{title ? t(title) : t('frontend.showcase.animatedCard.fallback.title')}</h3>
      <p className="text-sm text-muted-foreground">
        {content ? t(content) : t('frontend.showcase.animatedCard.fallback.content')}
      </p>
    </AnimatedCard>
  );
};

const BadgeWrapper: React.FC<Record<string, RendererDataValue>> = (props) => {
  const { t } = useTranslation();
  const { variant, children } = props as {
    variant?: 'default' | 'secondary' | 'destructive' | 'outline'
    children?: React.ReactNode
  };
  return (
    <Badge variant={variant}>
      {typeof children === 'string' ? t(children) : children ?? t('frontend.showcase.badge.fallback.label')}
    </Badge>
  );
};

export const cardStory: ComponentStory = {
  name: 'showcase.story.card',
  category: 'showcase.categories.layout',
  component: CardWrapper as React.ComponentType<Record<string, RendererDataValue>>,
  variants: [
    {
      name: 'showcase.variants.basic',
      props: { title: 'showcase.card.titles.basic', content: 'showcase.card.contents.simple' },
    },
    {
      name: 'showcase.variants.withBadge',
      props: { title: 'showcase.card.titles.feature', withBadge: true, badgeText: 'showcase.card.badges.beta' },
    },
    {
      name: 'showcase.variants.longContent',
      props: { title: 'showcase.card.titles.details', content: 'showcase.card.contents.long' },
    },
  ],
};

export const animatedCardStory: ComponentStory = {
  name: 'showcase.story.animatedCard',
  category: 'showcase.categories.layout',
  component: AnimatedCardWrapper as React.ComponentType<Record<string, RendererDataValue>>,
  variants: [
    { name: 'showcase.variants.lift', props: { hoverEffect: 'lift', title: 'showcase.animatedCard.titles.lift' } },
    { name: 'showcase.variants.glow', props: { hoverEffect: 'glow', title: 'showcase.animatedCard.titles.glow' } },
    { name: 'showcase.variants.scale', props: { hoverEffect: 'scale', title: 'showcase.animatedCard.titles.scale' } },
    { name: 'showcase.variants.perspective3d', props: { hoverEffect: '3d', title: 'showcase.animatedCard.titles.perspective3d' } },
    { name: 'showcase.variants.none', props: { hoverEffect: 'none', title: 'showcase.animatedCard.titles.none' } },
  ],
};

export const badgeStory: ComponentStory = {
  name: 'showcase.story.badge',
  category: 'showcase.categories.ui',
  component: BadgeWrapper as React.ComponentType<Record<string, RendererDataValue>>,
  variants: [
    { name: 'showcase.variants.default', props: { children: 'showcase.badge.text.default' } },
    { name: 'showcase.variants.secondary', props: { variant: 'secondary', children: 'showcase.badge.text.secondary' } },
    { name: 'showcase.variants.destructive', props: { variant: 'destructive', children: 'showcase.badge.text.error' } },
    { name: 'showcase.variants.outline', props: { variant: 'outline', children: 'showcase.badge.text.outline' } },
  ],
};

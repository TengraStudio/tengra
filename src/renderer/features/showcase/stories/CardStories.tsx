/**
 * Story definitions for Card and AnimatedCard components.
 * Showcases basic cards, headers, content, and animation effects.
 */
import React from 'react';

import { AnimatedCard } from '@/components/ui/AnimatedCard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { ComponentStory } from '../types';

const CardWrapper: React.FC<Record<string, unknown>> = (props) => {
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
          <CardTitle>{title ?? 'Card Title'}</CardTitle>
          {withBadge && <Badge variant="secondary">{badgeText ?? 'New'}</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {content ?? 'This is the card content area. It supports any React children.'}
        </p>
      </CardContent>
    </Card>
  );
};

const AnimatedCardWrapper: React.FC<Record<string, unknown>> = (props) => {
  const { hoverEffect, title, content } = props as {
    hoverEffect?: 'lift' | 'glow' | 'scale' | '3d' | 'none'
    title?: string
    content?: string
  };

  return (
    <AnimatedCard hoverEffect={hoverEffect} className="w-72">
      <h3 className="font-semibold mb-2">{title ?? 'Animated Card'}</h3>
      <p className="text-sm text-muted-foreground">
        {content ?? 'Hover to see the animation effect.'}
      </p>
    </AnimatedCard>
  );
};

const BadgeWrapper: React.FC<Record<string, unknown>> = (props) => {
  const { variant, children } = props as {
    variant?: 'default' | 'secondary' | 'destructive' | 'outline'
    children?: React.ReactNode
  };
  return <Badge variant={variant}>{children ?? 'Badge'}</Badge>;
};

export const cardStory: ComponentStory = {
  name: 'Card',
  category: 'Layout',
  component: CardWrapper as React.ComponentType<Record<string, unknown>>,
  variants: [
    { name: 'Basic', props: { title: 'Basic Card', content: 'Simple card with content.' } },
    { name: 'With Badge', props: { title: 'Feature', withBadge: true, badgeText: 'Beta' } },
    { name: 'Long Content', props: { title: 'Details', content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.' } },
  ],
};

export const animatedCardStory: ComponentStory = {
  name: 'AnimatedCard',
  category: 'Layout',
  component: AnimatedCardWrapper as React.ComponentType<Record<string, unknown>>,
  variants: [
    { name: 'Lift', props: { hoverEffect: 'lift', title: 'Lift Effect' } },
    { name: 'Glow', props: { hoverEffect: 'glow', title: 'Glow Effect' } },
    { name: 'Scale', props: { hoverEffect: 'scale', title: 'Scale Effect' } },
    { name: '3D', props: { hoverEffect: '3d', title: '3D Perspective' } },
    { name: 'None', props: { hoverEffect: 'none', title: 'No Effect' } },
  ],
};

export const badgeStory: ComponentStory = {
  name: 'Badge',
  category: 'UI',
  component: BadgeWrapper as React.ComponentType<Record<string, unknown>>,
  variants: [
    { name: 'Default', props: { children: 'Default' } },
    { name: 'Secondary', props: { variant: 'secondary', children: 'Secondary' } },
    { name: 'Destructive', props: { variant: 'destructive', children: 'Error' } },
    { name: 'Outline', props: { variant: 'outline', children: 'Outline' } },
  ],
};

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
 * Story definitions for Button and RippleButton components.
 * Showcases variants, sizes, and states.
 */
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { RippleButton } from '@/components/ui/RippleButton';
import { useTranslation } from '@/i18n';

import type { ComponentStory } from '../types';

const ButtonWrapper: React.FC<Record<string, RendererDataValue>> = (props) => {
  const { t } = useTranslation();
  const { variant, size, disabled, children, icon, loading } = props as {
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
    size?: 'default' | 'sm' | 'lg' | 'icon'
    disabled?: boolean
    children?: React.ReactNode
    icon?: string
    loading?: boolean
  };

  const iconMap: Record<string, React.ReactNode> = {
    plus: <Plus className="w-4 h-4 mr-2" />,
    save: <Save className="w-4 h-4 mr-2" />,
    trash: <Trash2 className="w-4 h-4 mr-2" />,
    loader: <Loader2 className="w-4 h-4 mr-2 animate-spin" />,
  };

  return (
    <Button variant={variant} size={size} disabled={disabled || loading}>
      {loading ? iconMap.loader : icon ? iconMap[icon] : null}
      {typeof children === 'string' ? t(children) : children}
    </Button>
  );
};

const RippleWrapper: React.FC<Record<string, RendererDataValue>> = (props) => {
  const { t } = useTranslation();
  const { variant, size, children } = props as {
    variant?: 'default' | 'primary' | 'secondary' | 'ghost' | 'destructive'
    size?: 'sm' | 'md' | 'lg'
    children?: React.ReactNode
  };
  return <RippleButton variant={variant} size={size}>{typeof children === 'string' ? t(children) : children}</RippleButton>;
};

export const buttonStory: ComponentStory = {
  name: 'showcase.story.button',
  category: 'showcase.categories.ui',
  component: ButtonWrapper as React.ComponentType<Record<string, RendererDataValue>>,
  variants: [
    { name: 'showcase.variants.primary', props: { variant: 'default', children: 'showcase.button.text.primaryButton' } },
    { name: 'showcase.variants.secondary', props: { variant: 'secondary', children: 'showcase.button.text.secondary' } },
    { name: 'showcase.variants.outline', props: { variant: 'outline', children: 'showcase.button.text.outline' } },
    { name: 'showcase.variants.ghost', props: { variant: 'ghost', children: 'showcase.button.text.ghost' } },
    { name: 'showcase.variants.destructive', props: { variant: 'destructive', children: 'showcase.button.text.delete' } },
    { name: 'showcase.variants.link', props: { variant: 'link', children: 'showcase.button.text.linkButton' } },
    { name: 'showcase.variants.small', props: { size: 'sm', children: 'showcase.button.text.small' }, description: 'showcase.button.descriptions.compact' },
    { name: 'showcase.variants.large', props: { size: 'lg', children: 'showcase.button.text.large' }, description: 'showcase.button.descriptions.large' },
    { name: 'showcase.variants.withIcon', props: { icon: 'plus', children: 'showcase.button.text.create' } },
    { name: 'showcase.variants.saveIcon', props: { icon: 'save', variant: 'secondary', children: 'showcase.button.text.save' } },
    { name: 'showcase.variants.loading', props: { loading: true, children: 'showcase.button.text.saving' } },
    { name: 'showcase.variants.disabled', props: { disabled: true, children: 'showcase.button.text.disabled' } },
  ],
};

export const rippleButtonStory: ComponentStory = {
  name: 'showcase.story.rippleButton',
  category: 'showcase.categories.ui',
  component: RippleWrapper as React.ComponentType<Record<string, RendererDataValue>>,
  variants: [
    { name: 'showcase.variants.default', props: { children: 'showcase.rippleButton.text.default' } },
    { name: 'showcase.variants.primary', props: { variant: 'primary', children: 'showcase.rippleButton.text.primary' } },
    { name: 'showcase.variants.secondary', props: { variant: 'secondary', children: 'showcase.rippleButton.text.secondary' } },
    { name: 'showcase.variants.ghost', props: { variant: 'ghost', children: 'showcase.rippleButton.text.ghost' } },
    { name: 'showcase.variants.destructive', props: { variant: 'destructive', children: 'showcase.rippleButton.text.danger' } },
    { name: 'showcase.variants.small', props: { size: 'sm', children: 'showcase.rippleButton.text.small' } },
    { name: 'showcase.variants.large', props: { size: 'lg', children: 'showcase.rippleButton.text.large' } },
  ],
};

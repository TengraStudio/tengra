/**
 * Story definitions for Button and RippleButton components.
 * Showcases variants, sizes, and states.
 */
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { RippleButton } from '@/components/ui/RippleButton';

import type { ComponentStory } from '../types';

const ButtonWrapper: React.FC<Record<string, unknown>> = (props) => {
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
      {children}
    </Button>
  );
};

const RippleWrapper: React.FC<Record<string, unknown>> = (props) => {
  const { variant, size, children } = props as {
    variant?: 'default' | 'primary' | 'secondary' | 'ghost' | 'destructive'
    size?: 'sm' | 'md' | 'lg'
    children?: React.ReactNode
  };
  return <RippleButton variant={variant} size={size}>{children}</RippleButton>;
};

export const buttonStory: ComponentStory = {
  name: 'Button',
  category: 'UI',
  component: ButtonWrapper as React.ComponentType<Record<string, unknown>>,
  variants: [
    { name: 'Primary', props: { variant: 'default', children: 'Primary Button' } },
    { name: 'Secondary', props: { variant: 'secondary', children: 'Secondary' } },
    { name: 'Outline', props: { variant: 'outline', children: 'Outline' } },
    { name: 'Ghost', props: { variant: 'ghost', children: 'Ghost' } },
    { name: 'Destructive', props: { variant: 'destructive', children: 'Delete' } },
    { name: 'Link', props: { variant: 'link', children: 'Link Button' } },
    { name: 'Small', props: { size: 'sm', children: 'Small' }, description: 'Compact size' },
    { name: 'Large', props: { size: 'lg', children: 'Large' }, description: 'Large size' },
    { name: 'With Icon', props: { icon: 'plus', children: 'Create' } },
    { name: 'Save Icon', props: { icon: 'save', variant: 'secondary', children: 'Save' } },
    { name: 'Loading', props: { loading: true, children: 'Saving...' } },
    { name: 'Disabled', props: { disabled: true, children: 'Disabled' } },
  ],
};

export const rippleButtonStory: ComponentStory = {
  name: 'RippleButton',
  category: 'UI',
  component: RippleWrapper as React.ComponentType<Record<string, unknown>>,
  variants: [
    { name: 'Default', props: { children: 'Ripple Default' } },
    { name: 'Primary', props: { variant: 'primary', children: 'Primary Ripple' } },
    { name: 'Secondary', props: { variant: 'secondary', children: 'Secondary' } },
    { name: 'Ghost', props: { variant: 'ghost', children: 'Ghost' } },
    { name: 'Destructive', props: { variant: 'destructive', children: 'Danger' } },
    { name: 'Small', props: { size: 'sm', children: 'Small' } },
    { name: 'Large', props: { size: 'lg', children: 'Large Ripple' } },
  ],
};

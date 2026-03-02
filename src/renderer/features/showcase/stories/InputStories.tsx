/**
 * Story definitions for Input, Textarea, and Label components.
 * Showcases variants, sizes, validation states, and composition.
 */
import React from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import type { ComponentStory } from '../types';

const InputWrapper: React.FC<Record<string, unknown>> = (props) => {
  const { variant, size, placeholder, disabled, type, withLabel, labelText } = props as {
    variant?: 'default' | 'error' | 'success'
    size?: 'sm' | 'default' | 'lg'
    placeholder?: string
    disabled?: boolean
    type?: string
    withLabel?: boolean
    labelText?: string
  };

  if (withLabel) {
    return (
      <div className="space-y-2 w-64">
        <Label htmlFor="showcase-input">{labelText ?? 'Label'}</Label>
        <Input
          id="showcase-input"
          variant={variant}
          size={size}
          placeholder={placeholder}
          disabled={disabled}
          type={type}
        />
        {variant === 'error' && (
          <p className="text-xs text-destructive">This field is required</p>
        )}
      </div>
    );
  }

  return (
    <Input
      className="w-64"
      variant={variant}
      size={size}
      placeholder={placeholder}
      disabled={disabled}
      type={type}
    />
  );
};

const TextareaWrapper: React.FC<Record<string, unknown>> = (props) => {
  const { placeholder, disabled, rows } = props as {
    placeholder?: string
    disabled?: boolean
    rows?: number
  };
  return (
    <Textarea
      className="w-72"
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
    />
  );
};

export const inputStory: ComponentStory = {
  name: 'Input',
  category: 'Forms',
  component: InputWrapper as React.ComponentType<Record<string, unknown>>,
  variants: [
    { name: 'Default', props: { placeholder: 'Enter text...' } },
    { name: 'Small', props: { size: 'sm', placeholder: 'Small input' } },
    { name: 'Large', props: { size: 'lg', placeholder: 'Large input' } },
    { name: 'Error', props: { variant: 'error', placeholder: 'Invalid value' } },
    { name: 'Success', props: { variant: 'success', placeholder: 'Valid' } },
    { name: 'Disabled', props: { disabled: true, placeholder: 'Disabled' } },
    { name: 'Password', props: { type: 'password', placeholder: 'Password' } },
    { name: 'With Label', props: { withLabel: true, labelText: 'Email', placeholder: 'user@example.com' } },
    {
      name: 'With Error Label',
      props: { withLabel: true, labelText: 'Username', variant: 'error', placeholder: 'Required' },
      description: 'Shows validation error below input',
    },
  ],
};

export const textareaStory: ComponentStory = {
  name: 'Textarea',
  category: 'Forms',
  component: TextareaWrapper as React.ComponentType<Record<string, unknown>>,
  variants: [
    { name: 'Default', props: { placeholder: 'Write something...' } },
    { name: 'Custom Rows', props: { placeholder: 'Tall textarea', rows: 6 } },
    { name: 'Disabled', props: { placeholder: 'Cannot edit', disabled: true } },
  ],
};

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
 * Story definitions for Input, Textarea, and Label components.
 * Showcases variants, sizes, validation states, and composition.
 */
import React from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n';

import type { ComponentStory } from '../types';

const InputWrapper: React.FC<Record<string, RendererDataValue>> = (props) => {
  const { t } = useTranslation();
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
        <Label htmlFor="showcase-input">{labelText ? t(labelText) : t('frontend.showcase.input.fallback.label')}</Label>
        <Input
          id="showcase-input"
          variant={variant}
          size={size}
          placeholder={placeholder ? t(placeholder) : undefined}
          disabled={disabled}
          type={type}
        />
        {variant === 'error' && (
          <p className="typo-caption text-destructive">{t('frontend.showcase.input.validation.required')}</p>
        )}
      </div>
    );
  }

  return (
    <Input
      className="w-64"
      variant={variant}
      size={size}
      placeholder={placeholder ? t(placeholder) : undefined}
      disabled={disabled}
      type={type}
    />
  );
};

const TextareaWrapper: React.FC<Record<string, RendererDataValue>> = (props) => {
  const { t } = useTranslation();
  const { placeholder, disabled, rows } = props as {
    placeholder?: string
    disabled?: boolean
    rows?: number
  };
  return (
    <Textarea
      className="w-72"
      placeholder={placeholder ? t(placeholder) : undefined}
      disabled={disabled}
      rows={rows}
    />
  );
};

export const inputStory: ComponentStory = {
  name: 'showcase.story.input',
  category: 'showcase.categories.forms',
  component: InputWrapper as React.ComponentType<Record<string, RendererDataValue>>,
  variants: [
    { name: 'showcase.variants.default', props: { placeholder: 'showcase.input.placeholders.enterText' } },
    { name: 'showcase.variants.small', props: { size: 'sm', placeholder: 'showcase.input.placeholders.smallInput' } },
    { name: 'showcase.variants.large', props: { size: 'lg', placeholder: 'showcase.input.placeholders.largeInput' } },
    { name: 'showcase.variants.error', props: { variant: 'error', placeholder: 'showcase.input.placeholders.invalidValue' } },
    { name: 'showcase.variants.success', props: { variant: 'success', placeholder: 'showcase.input.placeholders.valid' } },
    { name: 'showcase.variants.disabled', props: { disabled: true, placeholder: 'showcase.input.placeholders.disabled' } },
    { name: 'showcase.variants.password', props: { type: 'password', placeholder: 'showcase.input.placeholders.password' } },
    { name: 'showcase.variants.withLabel', props: { withLabel: true, labelText: 'showcase.input.labels.email', placeholder: 'showcase.input.placeholders.email' } },
    {
      name: 'showcase.variants.withErrorLabel',
      props: { withLabel: true, labelText: 'showcase.input.labels.username', variant: 'error', placeholder: 'showcase.input.placeholders.required' },
      description: 'showcase.input.descriptions.errorLabel',
    },
  ],
};

export const textareaStory: ComponentStory = {
  name: 'showcase.story.textarea',
  category: 'showcase.categories.forms',
  component: TextareaWrapper as React.ComponentType<Record<string, RendererDataValue>>,
  variants: [
    { name: 'showcase.variants.default', props: { placeholder: 'showcase.textarea.placeholders.writeSomething' } },
    { name: 'showcase.variants.customRows', props: { placeholder: 'showcase.textarea.placeholders.tallTextarea', rows: 6 } },
    { name: 'showcase.variants.disabled', props: { placeholder: 'showcase.textarea.placeholders.cannotEdit', disabled: true } },
  ],
};


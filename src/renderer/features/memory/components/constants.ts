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
 * Shared Constants for Memory Components
 */

import { MemoryCategory } from '@shared/types/advanced-memory';
import type { Icon } from '@tabler/icons-react';
import { IconArrowRight, IconBolt,IconBrain, IconBulb, IconGitMerge, IconHelpCircle, IconSettings, IconSparkles } from '@tabler/icons-react';

export const CATEGORY_CONFIG: Record<
  MemoryCategory,
  { labelKey: string; color: string; icon: Icon }
> = {
  preference: {
    labelKey: 'memory.categories.preference',
    color: 'bg-primary/10 text-primary',
    icon: IconSettings,
  },
  personal: { labelKey: 'memory.categories.personal', color: 'bg-accent/10 text-accent', icon: IconBrain },
  workspace: {
    labelKey: 'memory.categories.workspace',
    color: 'bg-success/10 text-success',
    icon: IconBulb,
  },
  technical: { labelKey: 'memory.categories.technical', color: 'bg-warning/10 text-warning', icon: IconBolt },
  workflow: {
    labelKey: 'memory.categories.workflow',
    color: 'bg-accent/10 text-accent',
    icon: IconArrowRight,
  },
  relationship: {
    labelKey: 'memory.categories.relationship',
    color: 'bg-info/10 text-info',
    icon: IconGitMerge,
  },
  fact: {
    labelKey: 'memory.categories.fact',
    color: 'bg-muted/10 text-muted-foreground',
    icon: IconHelpCircle,
  },
  instruction: {
    labelKey: 'memory.categories.instruction',
    color: 'bg-warning/10 text-warning',
    icon: IconSparkles,
  },
};

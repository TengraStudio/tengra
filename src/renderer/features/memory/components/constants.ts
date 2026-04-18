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
import { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  Brain,
  GitMerge,
  HelpCircle,
  Lightbulb,
  Settings,
  Sparkles,
  Zap,
} from 'lucide-react';

export const CATEGORY_CONFIG: Record<
  MemoryCategory,
  { labelKey: string; color: string; icon: LucideIcon }
> = {
  preference: {
    labelKey: 'memory.categories.preference',
    color: 'bg-primary/10 text-primary',
    icon: Settings,
  },
  personal: { labelKey: 'memory.categories.personal', color: 'bg-accent/10 text-accent', icon: Brain },
  workspace: {
    labelKey: 'memory.categories.workspace',
    color: 'bg-success/10 text-success',
    icon: Lightbulb,
  },
  technical: { labelKey: 'memory.categories.technical', color: 'bg-warning/10 text-warning', icon: Zap },
  workflow: {
    labelKey: 'memory.categories.workflow',
    color: 'bg-accent/10 text-accent',
    icon: ArrowRight,
  },
  relationship: {
    labelKey: 'memory.categories.relationship',
    color: 'bg-info/10 text-info',
    icon: GitMerge,
  },
  fact: {
    labelKey: 'memory.categories.fact',
    color: 'bg-muted/10 text-muted-foreground',
    icon: HelpCircle,
  },
  instruction: {
    labelKey: 'memory.categories.instruction',
    color: 'bg-warning/10 text-warning',
    icon: Sparkles,
  },
};

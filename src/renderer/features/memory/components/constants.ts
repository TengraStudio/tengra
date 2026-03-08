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
  personal: { labelKey: 'memory.categories.personal', color: 'bg-pink/10 text-pink', icon: Brain },
  workspace: {
    labelKey: 'memory.categories.workspace',
    color: 'bg-success/10 text-success',
    icon: Lightbulb,
  },
  technical: { labelKey: 'memory.categories.technical', color: 'bg-warning/10 text-orange', icon: Zap },
  workflow: {
    labelKey: 'memory.categories.workflow',
    color: 'bg-purple/10 text-purple',
    icon: ArrowRight,
  },
  relationship: {
    labelKey: 'memory.categories.relationship',
    color: 'bg-cyan/10 text-cyan',
    icon: GitMerge,
  },
  fact: {
    labelKey: 'memory.categories.fact',
    color: 'bg-muted/10 text-muted-foreground',
    icon: HelpCircle,
  },
  instruction: {
    labelKey: 'memory.categories.instruction',
    color: 'bg-yellow/10 text-warning',
    icon: Sparkles,
  },
};

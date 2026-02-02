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
  { label: string; color: string; icon: LucideIcon }
> = {
  preference: {
    label: 'Preference',
    color: 'bg-primary/10 text-primary',
    icon: Settings,
  },
  personal: { label: 'Personal', color: 'bg-pink/10 text-pink', icon: Brain },
  project: {
    label: 'Project',
    color: 'bg-success/10 text-success',
    icon: Lightbulb,
  },
  technical: { label: 'Technical', color: 'bg-orange/10 text-orange', icon: Zap },
  workflow: {
    label: 'Workflow',
    color: 'bg-purple/10 text-purple',
    icon: ArrowRight,
  },
  relationship: {
    label: 'Relationship',
    color: 'bg-cyan/10 text-cyan',
    icon: GitMerge,
  },
  fact: {
    label: 'Fact',
    color: 'bg-muted/10 text-muted-foreground',
    icon: HelpCircle,
  },
  instruction: {
    label: 'Instruction',
    color: 'bg-yellow/10 text-yellow',
    icon: Sparkles,
  },
};

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
 * Types for the component showcase system.
 * Defines the structure for story definitions and variant configurations.
 */

/** A single variant of a component story with specific props */
export interface StoryVariant {
  /** Display name for this variant */
  name: string
  /** Props to pass to the component */
  props: Record<string, RendererDataValue>
  /** Optional description of what this variant demonstrates */
  description?: string
}

/** A component story containing multiple variants */
export interface ComponentStory {
  /** Display name of the component */
  name: string
  /** The React component to render */
  component: React.ComponentType<Record<string, RendererDataValue>>
  /** List of variants to showcase */
  variants: StoryVariant[]
  /** Optional category for grouping in sidebar */
  category?: string
}

/** Props for the story renderer */
export interface StoryRendererProps {
  /** The story to render */
  story: ComponentStory
}


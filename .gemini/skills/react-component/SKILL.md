---
name: React Component
description: Create React components following project conventions
---

# React Component Skill

This skill guides you through creating React components that follow project standards.

## File Location

Components go in:
- `src/renderer/components/` - Reusable UI components
- `src/renderer/features/{feature}/components/` - Feature-specific components

## Component Template

```tsx
import React from 'react'
import { useTranslation } from 'react-i18next'
import './MyComponent.css'

interface MyComponentProps {
    title: string
    onAction?: () => void
}

export const MyComponent: React.FC<MyComponentProps> = ({ title, onAction }) => {
    const { t } = useTranslation()

    return (
        <div className="my-component">
            <h2>{title}</h2>
            <button onClick={onAction}>
                {t('common.action')}
            </button>
        </div>
    )
}
```

## CSS File

Create matching CSS file:

```css
.my-component {
    padding: var(--spacing-md);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
}

.my-component h2 {
    margin: 0 0 var(--spacing-sm);
    color: var(--text-primary);
}
```

## Key Rules

- Use functional components with hooks
- Props must have TypeScript interface
- All user-facing text uses `t()` for i18n
- Use CSS variables from design system
- Maximum 150 lines per component
- Extract logic to custom hooks

## Animation

For animated components, use Framer Motion:

```tsx
import { motion } from 'framer-motion'

<motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
>
    {children}
</motion.div>
```

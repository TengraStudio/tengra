---
name: React Component
description: Create React components following project conventions
---

# React Component Skill

## Locations

- `src/renderer/components/` - Reusable UI
- `src/renderer/features/{feature}/components/` - Feature-specific

## Template

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

## CSS Template

```css
.my-component {
    padding: var(--spacing-md);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
}
```

## Rules

- Functional components with hooks
- Props have TypeScript interface
- All text uses `t()` for i18n
- Use CSS variables
- Max 150 lines

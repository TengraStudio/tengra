---
name: React Component
description: Create React components following project conventions  
---

# React Component Skill

## Template

```tsx
import React from 'react'
import { useTranslation } from 'react-i18next'
import './MyComponent.css'

interface MyComponentProps {
    title: string
}

export const MyComponent: React.FC<MyComponentProps> = ({ title }) => {
    const { t } = useTranslation()
    
    return (
        <div className="my-component">
            <h2>{title}</h2>
        </div>
    )
}
```

## Rules

- Functional components with hooks
- TypeScript interfaces for props
- Use `t()` for all user-facing text
- Max 150 lines per component

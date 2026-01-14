---
paths:
  - "src/renderer/**/*.tsx"
  - "src/renderer/**/*.ts"
---

# React Component Guidelines

## i18n - Internationalization
NEVER hardcode user-facing strings:

```tsx
// BAD - Hardcoded string
<button>Save Changes</button>

// GOOD - Use translation
<button>{t('buttons.save')}</button>
```

When adding new strings:
1. Add to `src/renderer/i18n/en.ts`
2. Add to `src/renderer/i18n/tr.ts`
3. Use `t('section.key')` in component

## Component Structure
```tsx
import React from 'react'
import { useTranslation } from '@/i18n'
import { cn } from '@/lib/utils'

interface MyComponentProps {
    title: string
    onAction: () => void
}

export const MyComponent: React.FC<MyComponentProps> = ({
    title,
    onAction
}) => {
    const { t } = useTranslation()
    
    return (
        <div className={cn('base-class', 'conditional-class')}>
            <h2>{title}</h2>
            <button onClick={onAction}>
                {t('buttons.action')}
            </button>
        </div>
    )
}
```

## Hooks Usage
```tsx
// State
const [value, setValue] = useState<Type>(initial)

// Effects with cleanup
useEffect(() => {
    const handler = () => { /* ... */ }
    window.addEventListener('event', handler)
    return () => window.removeEventListener('event', handler)
}, [dependency])

// Memoization
const computed = useMemo(() => expensive(data), [data])
const callback = useCallback((arg) => action(arg), [action])
```

## No Emojis in Code
- Never use emojis in JSX or comments
- Use icons from lucide-react instead

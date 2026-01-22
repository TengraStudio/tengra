---
name: Translation (i18n)
description: Add new translation keys for internationalization
---

# Translation Skill

This skill guides you through adding new translation keys.

## File Locations

Translation files:
- `src/renderer/i18n/en.ts` - English
- `src/renderer/i18n/tr.ts` - Turkish

## Adding a Key

1. **Add to English file** (`en.ts`):

```typescript
export const en = {
    // ... existing keys
    myFeature: {
        title: 'My Feature',
        description: 'This is my feature description',
        button: {
            save: 'Save',
            cancel: 'Cancel'
        }
    }
}
```

2. **Add to Turkish file** (`tr.ts`):

```typescript
export const tr = {
    // ... existing keys
    myFeature: {
        title: 'Özelliğim',
        description: 'Bu benim özellik açıklamam',
        button: {
            save: 'Kaydet',
            cancel: 'İptal'
        }
    }
}
```

## Usage in React

```tsx
import { useTranslation } from 'react-i18next'

const MyComponent = () => {
    const { t } = useTranslation()
    
    return (
        <div>
            <h1>{t('myFeature.title')}</h1>
            <p>{t('myFeature.description')}</p>
            <button>{t('myFeature.button.save')}</button>
        </div>
    )
}
```

## Rules

- NEVER hardcode user-facing strings
- Always add keys to BOTH language files
- Use nested objects for organization
- Key names should be descriptive and hierarchical

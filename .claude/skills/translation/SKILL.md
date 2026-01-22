---
name: Translation
description: Add translation keys for internationalization
---

# Translation Skill

## Files

- `src/renderer/i18n/en.ts` - English
- `src/renderer/i18n/tr.ts` - Turkish

## Adding Keys

### English (en.ts)

```typescript
myFeature: {
    title: 'My Feature',
    description: 'Description here',
    button: {
        save: 'Save',
        cancel: 'Cancel'
    }
}
```

### Turkish (tr.ts)

```typescript
myFeature: {
    title: 'Özelliğim',
    description: 'Açıklama burada',
    button: {
        save: 'Kaydet',
        cancel: 'İptal'
    }
}
```

## Usage

```tsx
const { t } = useTranslation()
<span>{t('myFeature.title')}</span>
```

## Rules

- NEVER hardcode strings
- Add to BOTH files
- Use nested objects

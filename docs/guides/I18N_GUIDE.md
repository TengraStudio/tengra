# Internationalization (I18N) Guide

Tengra is designed to be accessible to a global audience. This guide explains how to manage translations and add support for new languages.

## Translation Workflow

We use a TypeScript-based translation system under `src/renderer/i18n/`.
Each language has its own folder and is split into section files for maintainability:

```text
src/renderer/i18n/
├── index.ts
├── en/
│   ├── index.ts
│   ├── common.ts
│   ├── settings.ts
│   └── ...
├── tr/
│   ├── index.ts
│   ├── common.ts
│   ├── settings.ts
│   └── ...
└── ...
```

### 1. Adding a New Key
- All user-facing strings must be externalized.
- Add the new key to the relevant section file in the canonical language folder.
- Keep keys grouped by top-level section (for example, `settings.ts`, `accounts.ts`, `workspace.ts`).
- Use hierarchical keys inside that section object (for example, `auth.title` inside `settings.ts`).

### 2. Translating Strings
- Once a key is added to the canonical section file, propagate it to the same section file in every other language folder.
- If a translation is missing, the system will fall back to English.

### 3. Using Translations in UI
- Use the local `useTranslation` hook from `src/renderer/i18n/index.ts`.
```tsx
const { t } = useTranslation();
return <h1>{t('settings.auth.title')}</h1>;
```

## Adding a New Language

To add support for a new language:
1. Create a new folder in `src/renderer/i18n/` (for example `it/`).
2. Copy the section file set from `src/renderer/i18n/en/` or `src/renderer/i18n/tr/`.
3. Translate each section file while preserving the same nested key structure.
4. Create `src/renderer/i18n/<lang>/index.ts` that re-exports the section files as one language object.
5. Register the language in `src/renderer/i18n/index.ts`.
6. Add the language to the selector in Settings.

## Best Practices

- **Avoid Concatenation**: Use interpolation for dynamic values to respect the word order of different languages.
  - Bad: `t('file') + ' ' + t('deleted')`
  - Good: `t('file_deleted', { fileName: 'test.ts' })`
- **Pluralization**: Keep plural variants as sibling keys using the existing suffix pattern (`_one`, `_other`, etc.).
- **Context**: Provide descriptions in comments for translators if a key's context is ambiguous.
- **Direction**: For Right-to-Left (RTL) languages like Arabic or Hebrew, ensure the layout adjusts accordingly using CSS logical properties.
- **Synchronization**: Keep the same section files and nested key paths across every language folder.

## Maintenance

Periodic audits should be performed to:
- Remove unused keys.
- Update outdated translations.
- Ensure consistency in terminology across all supported languages.


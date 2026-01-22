# Internationalization (I18N) Guide

Orbit is designed to be accessible to a global audience. This guide explains how to manage translations and add support for new languages.

## Translation Workflow

We use a structured JSON-based approach for translations, located in `src/renderer/i18n/locales/`.

### 1. Adding a New Key
- All user-facing strings must be externalized.
- Add the new key to `en.json` (our source of truth).
- Use hierarchical keys to group related strings (e.g., `"settings.auth.title": "Authentication"`).

### 2. Translating Strings
- Once a key is added to `en.json`, it should be propagated to other locale files (e.g., `tr.json`, `es.json`).
- If a translation is missing, the system will fall back to English.

### 3. Using Translations in UI
- Use the `useTranslation` hook from `react-i18next`.
```tsx
const { t } = useTranslation();
return <h1>{t('settings.auth.title')}</h1>;
```

## Adding a New Language

To add support for a new language:
1. Create a new JSON file in `src/renderer/i18n/locales/` (e.g., `de.json`).
2. Copy the structure from `en.json` and provide the translations.
3. Register the new locale in `src/renderer/i18n/config.ts`.
4. Add the language to the language selector in the `Settings` menu.

## Best Practices

- **Avoid Concatenation**: Use interpolation for dynamic values to respect the word order of different languages.
  - Bad: `t('file') + ' ' + t('deleted')`
  - Good: `t('file_deleted', { fileName: 'test.ts' })`
- **Pluralization**: Utilize the built-in pluralization support in `i18next`.
- **Context**: Provide descriptions in comments for translators if a key's context is ambiguous.
- **Direction**: For Right-to-Left (RTL) languages like Arabic or Hebrew, ensure the layout adjusts accordingly using CSS logical properties.

## Maintenance

Periodic audits should be performed to:
- Remove unused keys.
- Update outdated translations.
- Ensure consistency in terminology across all supported languages.

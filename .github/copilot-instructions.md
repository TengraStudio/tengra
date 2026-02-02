# GitHub Copilot Instructions for Tandem

This file provides custom instructions for GitHub Copilot when working on this project.

## Project Overview

Tandem is an Electron + React + TypeScript application for AI-powered development assistance. It uses a multi-process architecture with a Node.js main process and React renderer.

## Code Style Requirements

### TypeScript

- **NEVER use `any` type** - Use specific types, generics, or discriminated unions
- Use path aliases: `@main/`, `@shared/`, `@/`
- Prefer `interface` for object shapes
- All public methods need JSDoc comments
- Maximum 60 lines per function

### Naming Conventions

- Files: `kebab-case` with suffixes (e.g., `user-profile.service.ts`)
- Classes/Interfaces: `PascalCase`
- Variables/Functions: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`

### Logging

- **NEVER use `console.log`** - Use `appLogger` instead:
```typescript
import { appLogger } from '@main/logging/logger'
appLogger.info('ServiceName', 'Message')
appLogger.error('ServiceName', 'Error message', error)
```

## Service Pattern

All backend services must extend `BaseService`:

```typescript
import { BaseService } from '@main/services/base.service'
import { appLogger } from '@main/logging/logger'

export class MyService extends BaseService {
    constructor(private dep: Dependency) {
        super('MyService')
    }

    async initialize(): Promise<void> {
        appLogger.info(this.serviceName, 'Initializing...')
    }

    async cleanup(): Promise<void> {
        appLogger.info(this.serviceName, 'Cleaning up...')
    }
}
```

## React Components

- Use functional components with hooks
- Always use `useTranslation()` for user-facing text
- Use CSS variables from design system
- Maximum 150 lines per component

```tsx
import { useTranslation } from 'react-i18next'

const MyComponent: React.FC<Props> = ({ prop }) => {
    const { t } = useTranslation()
    return <div>{t('key.path')}</div>
}
```

## Internationalization

- Never hardcode user-facing strings
- Add keys to both `en.ts` and `tr.ts`
- Use nested objects for organization

## Security Rules

- Never log tokens, API keys, or passwords
- Never hardcode secrets
- Validate all user input
- Use `SecurityService.encryptSync()` for sensitive data

## Forbidden Actions

- Using `any` type
- Using `console.log`
- Using `@ts-ignore` or `eslint-disable`
- Modifying `.git/`, `node_modules/`, `.env` files

## Build Commands

Always run before committing:
```bash
npm run build && npm run lint && npm run type-check
```

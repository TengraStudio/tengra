---
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
---

# TypeScript Code Style

## Type Safety
- NEVER use `any` type
- NEVER use `unknown` unless immediately type-guarded
- Always define explicit interface/type definitions
- Use generics for flexible typing

## Imports
Use path aliases:
```typescript
import { Something } from '@main/services/something.service'
import { Type } from '@shared/types'
import { Component } from '@/components/ui'
```

## Functions
- Max 60 lines per function
- Single responsibility
- JSDoc for public methods
- Check all return values

## Logging
```typescript
// Good
appLogger.info('ServiceName', 'Message')

// Bad - NEVER use
console.log('message')
```

## Error Handling
```typescript
try {
    await riskyOperation()
} catch (error) {
    appLogger.error('ServiceName', 'Failed:', getErrorMessage(error))
    throw error // Re-throw or handle appropriately
}
```

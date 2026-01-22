# Testing Rules for Gemini

## Test Location

ALL tests MUST be placed in `src/tests/`.
- `src/tests/unit/` - Isolated unit tests.
- `src/tests/integration/` - Tests involving multiple services.
- `src/tests/e2e/` - Full application flows.

## Unit Tests

### Framework
- Use Vitest for unit tests.
- Use `vi.mock()` for mocking dependencies.

### Structure
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('MyService', () => {
    let service: MyService

    beforeEach(() => {
        service = new MyService(mockDep)
    })

    it('should do X when Y', async () => {
        // Arrange
        // Act
        // Assert
    })
})
```

## Coverage

- Target: 60% coverage minimum.
- Focus on business logic over framework code.

## E2E Tests

- Use Playwright for end-to-end tests.
- Run with `npm run test:e2e`.

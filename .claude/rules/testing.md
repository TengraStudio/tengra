---
paths:
  - "src/**/*.test.ts"
  - "src/tests/**/*"
---

# Testing Conventions

## Test File Location
Tests mirror source structure:
```
src/main/services/auth/token.service.ts
→ src/tests/unit/main/services/auth/token.service.test.ts
```

## Test Structure
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('ServiceName', () => {
    let service: ServiceName

    beforeEach(() => {
        service = new ServiceName()
    })

    describe('methodName', () => {
        it('should do expected behavior', async () => {
            // Arrange
            const input = 'test'
            
            // Act
            const result = await service.methodName(input)
            
            // Assert
            expect(result).toBeDefined()
        })

        it('should handle edge case', () => {
            // test edge case
        })
    })
})
```

## Mocking
```typescript
vi.mock('@main/services/dependency.service', () => ({
    DependencyService: vi.fn().mockImplementation(() => ({
        method: vi.fn().mockResolvedValue('mocked')
    }))
}))
```

## Commands
```bash
npm run test           # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage
```

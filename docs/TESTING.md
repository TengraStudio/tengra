# Testing Guide for Orbit

## Overview
Orbit uses **Vitest** as its testing framework. Vitest is a fast, Vite-native testing framework that provides a great developer experience.

## Quick Start

```bash
# Run all tests once
npm test

# Run tests in watch mode (recommended during development)
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Structure

Tests are co-located with source files using the `.test.ts` or `.spec.ts` suffix:

```
src/
├── main/
│   ├── services/
│   │   ├── database.service.ts
│   │   ├── database.service.test.ts  <- Test file
│   │   ├── quota.service.ts
│   │   └── quota.service.test.ts     <- Test file
│   └── utils/
│       ├── retry.util.ts
│       └── retry.util.test.ts        <- Test file
└── test/
    └── setup.ts                       <- Global test setup
```

## Writing Tests

### Basic Example

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { YourService } from './your.service'

describe('YourService', () => {
    let service: YourService

    beforeEach(() => {
        service = new YourService()
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('should do something', () => {
        const result = service.doSomething()
        expect(result).toBe('expected value')
    })

    it('should handle errors', async () => {
        await expect(service.failingMethod()).rejects.toThrow('Error message')
    })
})
```

### Mocking Electron APIs

The `src/test/setup.ts` file provides global mocks for Electron APIs. If you need to customize mocks for specific tests:

```typescript
import { vi } from 'vitest'

// Override a specific mock
vi.mock('electron', () => ({
    app: {
        getPath: vi.fn(() => '/custom/path'),
        // ... other mocks
    }
}))
```

### Testing Async Code

```typescript
it('should fetch data correctly', async () => {
    const data = await service.fetchData()
    expect(data).toEqual({ id: 1, name: 'Test' })
})
```

## Best Practices

1. **Keep tests focused**: Each test should verify one specific behavior.
2. **Use descriptive names**: Test names should clearly describe what is being tested.
3. **Avoid testing implementation details**: Focus on behavior, not internal workings.
4. **Mock external dependencies**: Always mock file system, network, and Electron APIs.
5. **Clean up after tests**: Use `beforeEach` and `afterEach` to reset state.

## Coverage

Coverage reports are generated in the `coverage/` directory after running `npm run test:coverage`.

Target coverage goals:
- Main process services: > 70%
- Utility functions: > 90%

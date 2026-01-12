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

## Test Examples

### Example 1: Testing a Service with Dependencies

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DatabaseService } from './database.service'
import { SettingsService } from './settings.service'

describe('DatabaseService', () => {
    let dbService: DatabaseService
    let mockSettingsService: SettingsService

    beforeEach(() => {
        // Create mock dependencies
        mockSettingsService = {
            getSettings: vi.fn(() => ({ general: { language: 'en' } })),
            saveSettings: vi.fn()
        } as unknown as SettingsService

        dbService = new DatabaseService(mockSettingsService)
    })

    it('should initialize database correctly', async () => {
        await dbService.initialize()
        expect(mockSettingsService.getSettings).toHaveBeenCalled()
    })
})
```

### Example 2: Testing IPC Handlers

```typescript
import { describe, it, expect, vi } from 'vitest'
import { registerDbIpc } from '../ipc/db'
import { DatabaseService } from '../services/database.service'

describe('DB IPC Handlers', () => {
    it('should handle getChats request', async () => {
        const mockDbService = {
            getChats: vi.fn(() => Promise.resolve([{ id: '1', title: 'Test' }]))
        } as unknown as DatabaseService

        // Register handlers
        registerDbIpc(mockDbService)

        // Simulate IPC call (in real tests, use Electron's IPC testing utilities)
        const result = await mockDbService.getChats()
        expect(result).toHaveLength(1)
        expect(result[0].title).toBe('Test')
    })
})
```

### Example 3: Testing React Components

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatInput } from './ChatInput'

describe('ChatInput', () => {
    it('should render input field', () => {
        render(<ChatInput onSend={() => {}} />)
        const input = screen.getByPlaceholderText(/type a message/i)
        expect(input).toBeInTheDocument()
    })

    it('should call onSend when Enter is pressed', () => {
        const handleSend = vi.fn()
        render(<ChatInput onSend={handleSend} />)
        const input = screen.getByPlaceholderText(/type a message/i)
        
        // Simulate typing and pressing Enter
        fireEvent.change(input, { target: { value: 'Hello' } })
        fireEvent.keyDown(input, { key: 'Enter' })
        
        expect(handleSend).toHaveBeenCalledWith('Hello')
    })
})
```

### Example 4: Testing Async Operations with Retries

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { retryWithBackoff } from '../utils/retry.util'

describe('retryWithBackoff', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    it('should retry failed operations', async () => {
        let attempts = 0
        const failingOperation = async () => {
            attempts++
            if (attempts < 3) throw new Error('Failed')
            return 'Success'
        }

        const result = await retryWithBackoff(failingOperation, { maxRetries: 3 })
        expect(result).toBe('Success')
        expect(attempts).toBe(3)
    })
})
```

### Example 5: Testing Error Handling

```typescript
import { describe, it, expect } from 'vitest'
import { createIpcHandler } from '../utils/ipc-wrapper.util'

describe('IPC Error Handling', () => {
    it('should handle errors gracefully', async () => {
        const handler = createIpcHandler(async () => {
            throw new Error('Test error')
        })

        const result = await handler({} as any, 'test')
        expect(result.success).toBe(false)
        expect(result.error).toContain('Test error')
    })

    it('should log errors with context', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        
        const handler = createIpcHandler(async () => {
            throw new Error('Test error')
        })

        await handler({} as any, 'test')
        expect(consoleSpy).toHaveBeenCalled()
        
        consoleSpy.mockRestore()
    })
})
```

## Integration Tests

Integration tests verify that multiple components work together correctly:

```typescript
import { describe, it, expect } from 'vitest'
import { DatabaseService } from '../services/database.service'
import { SettingsService } from '../services/settings.service'

describe('Database and Settings Integration', () => {
    it('should save and retrieve chat data', async () => {
        const settingsService = new SettingsService()
        const dbService = new DatabaseService(settingsService)
        
        await dbService.initialize()
        
        const chatId = await dbService.createChat({ title: 'Test Chat' })
        const chat = await dbService.getChat(chatId)
        
        expect(chat).toBeDefined()
        expect(chat?.title).toBe('Test Chat')
    })
})
```

## E2E Tests

E2E tests use Playwright to test the full application:

```typescript
import { test, expect } from '@playwright/test'

test('should create a new chat', async ({ page }) => {
    await page.goto('http://localhost:5173')
    
    // Wait for app to load
    await page.waitForSelector('[data-testid="chat-input"]')
    
    // Type a message
    await page.fill('[data-testid="chat-input"]', 'Hello, Orbit!')
    await page.press('[data-testid="chat-input"]', 'Enter')
    
    // Verify message appears
    await expect(page.locator('[data-testid="message"]')).toContainText('Hello, Orbit!')
})
```

## Running Specific Tests

```bash
# Run tests matching a pattern
npm test -- --grep "DatabaseService"

# Run tests in a specific file
npm test -- src/main/services/database.service.test.ts

# Run tests with verbose output
npm test -- --reporter=verbose
```

## Debugging Tests

```bash
# Run tests in debug mode
npm test -- --inspect-brk

# Run a single test file in watch mode
npm run test:watch -- src/main/services/database.service.test.ts
```

## Common Issues

1. **Tests timing out**: Increase timeout in test configuration or use `vi.setTimeout()`
2. **Mock not working**: Ensure mocks are set up before imports
3. **Async issues**: Always await async operations and use `vi.waitFor()`
4. **Electron API mocks**: Check `src/test/setup.ts` for available mocks

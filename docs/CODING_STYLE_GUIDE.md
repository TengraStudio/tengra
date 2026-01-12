# Coding Style Guide

This document outlines the coding standards and best practices for the Orbit project.

## Table of Contents

1. [General Principles](#general-principles)
2. [TypeScript](#typescript)
3. [React Components](#react-components)
4. [File Organization](#file-organization)
5. [Naming Conventions](#naming-conventions)
6. [Code Formatting](#code-formatting)
7. [Error Handling](#error-handling)
8. [Performance](#performance)
9. [Accessibility](#accessibility)
10. [Testing](#testing)

## General Principles

- **Clarity over cleverness**: Write code that is easy to understand and maintain
- **Consistency**: Follow existing patterns in the codebase
- **DRY (Don't Repeat Yourself)**: Extract common logic into reusable utilities
- **Single Responsibility**: Each function/component should do one thing well
- **Fail fast**: Validate inputs early and provide clear error messages

## TypeScript

### Type Safety

- **Avoid `any`**: Use `unknown` when the type is truly unknown, then narrow it
- **Use explicit return types**: For public functions and exported functions
- **Prefer `interface` over `type`**: For object shapes that might be extended
- **Use type guards**: For runtime type checking

```typescript
// ✅ Good
interface User {
  id: string
  name: string
}

function getUser(id: string): User | null {
  // ...
}

// ❌ Bad
function getUser(id: any): any {
  // ...
}
```

### Type Definitions

- Place types/interfaces near where they're used, or in `shared/types/` for shared types
- Use descriptive names that indicate the purpose
- Group related types together

```typescript
// ✅ Good
export interface ChatMessage {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: number
}

// ❌ Bad
export interface CM {
  i: string
  c: string
  r: string
  t: number
}
```

## React Components

### Component Structure

1. Imports (external, then internal)
2. Types/Interfaces
3. Component definition
4. Hooks
5. Event handlers
6. Render logic

```typescript
// ✅ Good
import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useChat } from '@/context/ChatContext'

interface ChatInputProps {
  onSubmit: (message: string) => void
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSubmit }) => {
  const [input, setInput] = useState('')
  const { isLoading } = useChat()

  const handleSubmit = () => {
    if (input.trim()) {
      onSubmit(input)
      setInput('')
    }
  }

  return (
    <div>
      <input value={input} onChange={(e) => setInput(e.target.value)} />
      <Button onClick={handleSubmit} disabled={isLoading}>
        Send
      </Button>
    </div>
  )
}
```

### Hooks

- Use custom hooks to extract reusable logic
- Keep hooks at the top of the component
- Use `useMemo` and `useCallback` judiciously (only when needed for performance)

```typescript
// ✅ Good
const filteredItems = useMemo(() => {
  return items.filter(item => item.active)
}, [items])

// ❌ Bad - unnecessary memoization
const filteredItems = useMemo(() => {
  return items.filter(item => item.active)
}, [items]) // items is already a stable reference
```

### Props

- Use destructuring for props
- Provide default values when appropriate
- Document complex props with JSDoc

```typescript
// ✅ Good
interface ButtonProps {
  /** Button label text */
  label: string
  /** Click handler */
  onClick: () => void
  /** Visual variant */
  variant?: 'primary' | 'secondary'
}

export const Button: React.FC<ButtonProps> = ({ 
  label, 
  onClick, 
  variant = 'primary' 
}) => {
  // ...
}
```

## File Organization

### Directory Structure

```
src/
  main/           # Electron main process
  renderer/       # React renderer process
    components/   # Reusable UI components
    features/     # Feature-specific components
    context/      # React contexts
    hooks/        # Custom hooks
    utils/        # Utility functions
  shared/         # Shared code between main and renderer
    types/        # TypeScript types
    utils/        # Shared utilities
```

### File Naming

- **Components**: PascalCase (e.g., `ChatInput.tsx`)
- **Utilities**: camelCase (e.g., `formatDate.ts`)
- **Types**: camelCase with `.types.ts` suffix (e.g., `chat.types.ts`)
- **Hooks**: camelCase with `use` prefix (e.g., `useChatManager.ts`)

## Naming Conventions

### Variables and Functions

- Use camelCase for variables and functions
- Use descriptive names that indicate purpose
- Boolean variables should start with `is`, `has`, `should`, etc.

```typescript
// ✅ Good
const isVisible = true
const hasPermission = false
const shouldRender = condition

function getUserById(id: string) {
  // ...
}

// ❌ Bad
const v = true
const p = false
function get(id: string) {
  // ...
}
```

### Constants

- Use UPPER_SNAKE_CASE for constants
- Group related constants together

```typescript
// ✅ Good
const MAX_RETRY_ATTEMPTS = 3
const DEFAULT_TIMEOUT_MS = 5000

// ❌ Bad
const maxRetry = 3
const timeout = 5000
```

### Components

- Use PascalCase for component names
- Match component name to file name

```typescript
// ✅ Good - File: ChatInput.tsx
export const ChatInput: React.FC<ChatInputProps> = () => {
  // ...
}

// ❌ Bad - File: chat-input.tsx
export const ChatInput: React.FC<ChatInputProps> = () => {
  // ...
}
```

## Code Formatting

- Use Prettier for automatic formatting
- Run `npm run format` before committing
- Follow existing indentation (2 spaces)
- Use single quotes for strings (unless escaping)
- Add trailing commas in multi-line structures

```typescript
// ✅ Good
const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
}

// ❌ Bad
const config = {
  apiUrl: "https://api.example.com",
  timeout: 5000
}
```

## Error Handling

- Always handle errors explicitly
- Provide meaningful error messages
- Use try-catch for async operations
- Log errors appropriately

```typescript
// ✅ Good
async function fetchUser(id: string): Promise<User> {
  try {
    const response = await api.getUser(id)
    return response.data
  } catch (error) {
    console.error('Failed to fetch user:', error)
    throw new Error(`Unable to fetch user ${id}`)
  }
}

// ❌ Bad
async function fetchUser(id: string) {
  const response = await api.getUser(id)
  return response.data
}
```

## Performance

### React Optimization

- Use `React.memo` for expensive components
- Use `useMemo` for expensive calculations
- Use `useCallback` for functions passed as props
- Avoid creating objects/functions in render

```typescript
// ✅ Good
const handleClick = useCallback(() => {
  onClick(id)
}, [id, onClick])

// ❌ Bad
const handleClick = () => {
  onClick(id)
}
```

### Code Splitting

- Use lazy loading for route components
- Split large bundles into smaller chunks
- Load resources on demand

```typescript
// ✅ Good
const SettingsPage = React.lazy(() => import('./SettingsPage'))

// ❌ Bad
import SettingsPage from './SettingsPage'
```

## Accessibility

- Always provide ARIA labels for interactive elements
- Use semantic HTML elements
- Ensure keyboard navigation works
- Test with screen readers

```typescript
// ✅ Good
<button
  onClick={handleClick}
  aria-label="Close dialog"
  aria-pressed={isOpen}
>
  <XIcon aria-hidden="true" />
</button>

// ❌ Bad
<div onClick={handleClick}>
  <XIcon />
</div>
```

## Testing

- Write tests for complex logic
- Test edge cases and error conditions
- Keep tests simple and focused
- Use descriptive test names

```typescript
// ✅ Good
describe('formatDate', () => {
  it('should format valid date correctly', () => {
    expect(formatDate(new Date('2024-01-01'))).toBe('Jan 1, 2024')
  })

  it('should handle invalid date gracefully', () => {
    expect(() => formatDate(null)).toThrow('Invalid date')
  })
})
```

## Additional Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [React Best Practices](https://react.dev/learn)
- [ESLint Rules](https://eslint.org/docs/rules/)
- [Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

*Last updated: 2026-01-11*

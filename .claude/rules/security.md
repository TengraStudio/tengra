# Security Rules

## Forbidden Paths
NEVER access or modify:
- `.git/` - Git internals
- `node_modules/` - Dependencies
- `vendor/` - Third-party code
- `.env`, `.env.local` - Secrets
- `*.key`, `*.pem` - Keys

## Secrets
- NEVER hardcode API keys, tokens, or secrets
- NEVER log tokens or sensitive data
- Use `securityService.encrypt()` for sensitive storage

## Safe File Operations
```typescript
// Always validate paths before access
const safePath = path.resolve(basePath, userInput)
if (!safePath.startsWith(basePath)) {
    throw new Error('Path traversal detected')
}
```

## Shell Commands
- Avoid `shell: true` in spawn/exec
- Sanitize all user input before commands
- Use parameterized commands

## XSS Prevention
- Sanitize HTML with DOMPurify before using `dangerouslySetInnerHTML`
- Never render user content as raw HTML

## Encryption
```typescript
// Use Electron safeStorage
const encrypted = securityService.encryptSync(sensitive)
const decrypted = securityService.decryptSync(encrypted)
```

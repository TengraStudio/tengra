# Security Rules for Gemini

## Absolute Prohibitions

### Protected Paths
Never read, write, or modify files in these locations:
- `.git/` - Git version control internals.
- `node_modules/` - Installed dependencies.
- `vendor/` - Third-party source trees.
- `.env`, `.env.local` - Environment secrets.
- Any file with `.key` or `.pem` extension.

### Credential Handling
- NEVER log tokens, API keys, or passwords. Use `[REDACTED]` as a placeholder if needed for debugging context.
- NEVER hardcode secrets in source code.
- Always use `SecurityService.encryptSync()` for storing sensitive data.

## Safe Practices

### Input Sanitization
- All user-provided paths must be validated with `FileSystemService.validatePath()`.
- All shell commands must use `shell: false` and pass arguments as an array to prevent injection.

### Error Messages
- Error messages returned to the UI must not leak internal paths, stack traces, or database schemas.

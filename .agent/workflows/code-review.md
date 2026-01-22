---
description: Review code changes for quality and correctness
---

# Code Review Workflow

This workflow ensures code changes meet project standards.

## Checklist

### Type Safety
- [ ] No `any` types used
- [ ] No `@ts-ignore` comments
- [ ] All functions have proper return types
- [ ] Null/undefined handled properly

### Code Style
- [ ] Files use correct naming convention (kebab-case.suffix.ts)
- [ ] Functions are under 60 lines
- [ ] Uses path aliases (@main/, @shared/, @/)
- [ ] No console.log (use appLogger)

### Architecture
- [ ] Services extend BaseService
- [ ] Dependencies injected via constructor
- [ ] No circular dependencies
- [ ] Proper domain folder placement

### Security
- [ ] No hardcoded secrets
- [ ] Input validation present
- [ ] Error messages don't leak internals
- [ ] Protected paths not accessed

### Testing
- [ ] New code has tests
- [ ] Existing tests still pass
- [ ] Edge cases covered

### Documentation
- [ ] Public methods have JSDoc
- [ ] Complex logic commented
- [ ] CHANGELOG updated

## Review Commands

// turbo
```bash
npm run lint
npm run type-check
npm run test
```

## Approval Criteria

All checklist items must be satisfied before marking code as reviewed.

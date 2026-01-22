---
description: Debug and fix failing tests or runtime errors
---

# Debug Workflow

This workflow provides a systematic approach to debugging.

## Identify the Problem

1. **Reproduce the error**
   - Get the exact error message
   - Identify the file and line number
   - Note any stack trace

2. **Check logs**
   ```bash
   cat logs/main.log | tail -100
   ```
   Or check the specific log file mentioned in the error.

## Analyze

3. **Trace the code path**
   - Find the function throwing the error
   - Trace back to the caller
   - Identify the root cause

4. **Check recent changes**
   ```bash
   git log -5 --oneline
   git diff HEAD~1
   ```

## Fix

5. **Make minimal changes**
   - Fix only what's necessary
   - Don't refactor while debugging

6. **Add defensive checks**
   ```typescript
   if (!value) {
       throw new Error('Expected value to be defined')
   }
   ```

## Verify

7. **Test the fix**
   // turbo
   ```bash
   npm run test
   ```

8. **Run full verification**
   // turbo
   ```bash
   npm run build && npm run lint
   ```

## Document

9. **Add to troubleshooting**
   If this is a common issue, add it to `docs/TROUBLESHOOTING.md`.

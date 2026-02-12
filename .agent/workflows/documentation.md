---
description: Create or update documentation from code
---

# Documentation Workflow

This workflow ensures documentation stays in sync with code.

## When to Update Docs

- New service or feature added
- Public API changed
- Architecture modified
- Configuration options added

## Steps

1. **Identify affected docs**
   - `docs/ARCHITECTURE.md` - System structure
   - `docs/SERVICES.md` - Service patterns
   - `docs/API_REFERENCE.md` - API endpoints
   - `docs/DEVELOPMENT.md` - Dev setup
   - `docs/changelog/data/changelog.entries.json` - Change history source
   - `docs/changelog/generated/CHANGELOG.en.md` - Generated English changelog
   - `docs/changelog/generated/CHANGELOG.tr.md` - Generated Turkish changelog

2. **Update relevant sections**
   - Keep existing structure
   - Use consistent formatting
   - No emojis in documentation
   - Link to related docs

3. **Add JSDoc to code**
   ```typescript
   /**
    * Brief description of the method.
    * @param paramName - Description of parameter
    * @returns Description of return value
    */
   ```

4. **Update README if needed**
   For user-facing changes, update the main `README.md`.

5. **Verify links**
   Check that all internal links work.

## Documentation Style

- Professional, human-written tone
- No emojis
- Use code blocks for examples
- Keep sections concise
- Use tables for structured data


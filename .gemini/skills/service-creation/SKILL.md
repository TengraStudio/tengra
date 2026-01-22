---
name: Service Creation
description: Create a new service following project patterns
---

# Service Creation Skill

This skill guides you through creating a new service that follows project conventions.

## Required Information

Before starting, you need:
- Service name (e.g., `MyFeature`)
- Domain folder (security, data, llm, system, project, ui)
- Dependencies (other services it needs)

## File Template

Create `src/main/services/{domain}/{kebab-name}.service.ts`:

```typescript
import { BaseService } from '@main/services/base.service'
import { appLogger } from '@main/logging/logger'

export class {ServiceName}Service extends BaseService {
    constructor() {
        super('{ServiceName}Service')
    }

    async initialize(): Promise<void> {
        appLogger.info(this.serviceName, 'Initializing...')
    }

    async cleanup(): Promise<void> {
        appLogger.info(this.serviceName, 'Cleaning up...')
    }

    // Add your methods here
}
```

## Registration

Add to `src/main/startup/services.ts`:

```typescript
container.register(
    '{camelName}Service',
    () => new {ServiceName}Service(),
    [] // dependencies
)
```

## Post-Creation Checklist

- [ ] Service extends BaseService
- [ ] Logging uses appLogger (not console.log)
- [ ] initialize() and cleanup() implemented
- [ ] Registered in services.ts
- [ ] Added to docs/SERVICES.md

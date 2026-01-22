---
name: Service Creation
description: Create a new service following project patterns
---

# Service Creation Skill

## Domains

- `services/security/` - Auth, tokens, encryption
- `services/data/` - Database, files, backup
- `services/llm/` - AI models, orchestration
- `services/system/` - OS utilities, commands
- `services/project/` - Git, Docker, workspace
- `services/ui/` - Notifications, clipboard

## Template

```typescript
import { BaseService } from '@main/services/base.service'
import { appLogger } from '@main/logging/logger'

export class {Name}Service extends BaseService {
    constructor(private dep: Dependency) {
        super('{Name}Service')
    }

    async initialize(): Promise<void> {
        appLogger.info(this.serviceName, 'Initializing...')
    }

    async cleanup(): Promise<void> {
        appLogger.info(this.serviceName, 'Cleaning up...')
    }
}
```

## Registration

Add to `src/main/startup/services.ts`:

```typescript
container.register(
    '{camelName}Service',
    (dep) => new {Name}Service(dep),
    ['dependencyName']
)
```

## Checklist

- [ ] Extends BaseService
- [ ] Uses appLogger (not console.log)
- [ ] Has initialize() and cleanup()
- [ ] Registered in services.ts
- [ ] Added to docs/SERVICES.md

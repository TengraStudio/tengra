---
name: Service Creation  
description: Create a new service following project patterns
---

# Service Creation Skill

## Template

Create `src/main/services/{domain}/{name}.service.ts`:

```typescript
import { BaseService } from '@main/services/base.service'
import { appLogger } from '@main/logging/logger'

export class MyService extends BaseService {
    constructor() {
        super('MyService')
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

Add to `src/main/startup/services.ts`.

## Checklist

- [ ] Extends BaseService
- [ ] Uses appLogger
- [ ] Registered in services.ts

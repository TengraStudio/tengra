# Service Layer Rules for Gemini

## BaseService Pattern

All backend services MUST extend `BaseService`. This ensures consistent lifecycle management and logging.

```typescript
import { BaseService } from '@main/services/base.service'
import { appLogger } from '@main/logging/logger'

export class ExampleService extends BaseService {
    constructor(private dependency: SomeDependency) {
        super('ExampleService')
    }

    async initialize(): Promise<void> {
        appLogger.info(this.serviceName, 'Initializing...')
        // Async setup here
    }

    async cleanup(): Promise<void> {
        appLogger.info(this.serviceName, 'Cleaning up...')
        // Resource release here
    }
}
```

## Domain Organization

Services are organized into domain folders:
- `services/security/` - Auth, tokens, encryption
- `services/data/` - Database, persistence, backup
- `services/llm/` - AI models, orchestration
- `services/system/` - OS-level utilities, commands

## Dependency Injection

Services are registered in `src/main/startup/services.ts`. Dependencies must be explicitly declared. Circular dependencies are FORBIDDEN.

---
paths:
  - "src/main/services/**/*.ts"
---

# Service Architecture

## Service Template
All services MUST extend BaseService:

```typescript
import { BaseService } from '@main/services/base.service'
import { appLogger } from '@main/logging/logger'
import { getErrorMessage } from '@shared/utils/error.util'

export class MyService extends BaseService {
    constructor(
        private dependency1: Dependency1,
        private dependency2: Dependency2
    ) {
        super('MyService')
    }

    async initialize(): Promise<void> {
        appLogger.info('MyService', 'Initializing...')
    }

    async doWork(input: Input): Promise<Result> {
        if (!input) {
            throw new Error('Input is required')
        }
        
        try {
            const result = await this.dependency1.process(input)
            return result
        } catch (error) {
            appLogger.error('MyService', 'Failed:', getErrorMessage(error))
            throw error
        }
    }
}
```

## Domain Folders
Place services in correct domain:
- `services/ai/` - LLM, models, tokens
- `services/auth/` - Authentication, tokens
- `services/data/` - Database, settings
- `services/project/` - Project management
- `services/proxy/` - Proxy services
- `services/system/` - System utilities

## Registration
Register in `src/main/startup/services.ts`:

```typescript
container.register('myService', () => 
    new MyService(
        container.resolve('dependency1'),
        container.resolve('dependency2')
    )
)
```

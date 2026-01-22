---
description: Create a new service following project patterns
---

# New Service Workflow

This workflow ensures new services follow project standards.

## Planning

1. **Determine domain**
   Choose the correct folder:
   - `services/security/` - Auth, tokens, encryption
   - `services/data/` - Database, files, backup
   - `services/llm/` - AI models, orchestration
   - `services/system/` - OS utilities, commands
   - `services/project/` - Git, Docker, workspace
   - `services/ui/` - Notifications, clipboard

2. **Identify dependencies**
   List services this new service will depend on.

## Implementation

3. **Create service file**
   File: `src/main/services/{domain}/{name}.service.ts`

   ```typescript
   import { BaseService } from '@main/services/base.service'
   import { appLogger } from '@main/logging/logger'

   export class MyNewService extends BaseService {
       constructor(private dep: Dependency) {
           super('MyNewService')
       }

       async initialize(): Promise<void> {
           appLogger.info(this.serviceName, 'Initializing...')
       }

       async cleanup(): Promise<void> {
           appLogger.info(this.serviceName, 'Cleaning up...')
       }
   }
   ```

4. **Register service**
   Add to `src/main/startup/services.ts`:
   ```typescript
   container.register(
       'myNewService',
       (dep) => new MyNewService(dep as Dependency),
       ['dependencyName']
   )
   ```

5. **Add IPC handlers** (if needed)
   Create handlers in `src/main/ipc/` if service needs UI access.

## Verification

// turbo-all
6. **Build and test**
   ```bash
   npm run build
   npm run lint
   npm run type-check
   ```

7. **Add tests**
   Create `src/tests/unit/services/{name}.service.test.ts`

8. **Update documentation**
   Add service to `docs/SERVICES.md`

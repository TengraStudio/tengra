# IPC Channel Reference

> **Auto-generated** by `scripts/generate-ipc-docs.ts`
> Run `npx tsx scripts/generate-ipc-docs.ts` to regenerate.

## Summary

- **Total Channels**: 630
- **Domains**: 42
- **Source**: `src/main/ipc/`

## Direction Legend

| Symbol | Meaning |
|--------|---------|
| Renderer ↔ Main | Request/response (invoke/handle) |
| Renderer → Main | One-way event (send/on) |

## Channels by Domain

### AdvancedMemory (35 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `advancedMemory:archive` | Renderer ↔ Main | AdvancedMemory: archive | advanced-memory.ts |
| `advancedMemory:archiveMany` | Renderer ↔ Main | AdvancedMemory: archiveMany | advanced-memory.ts |
| `advancedMemory:confirm` | Renderer ↔ Main | AdvancedMemory: confirm | advanced-memory.ts |
| `advancedMemory:confirmAll` | Renderer ↔ Main | AdvancedMemory: confirmAll | advanced-memory.ts |
| `advancedMemory:createSharedNamespace` | Renderer ↔ Main | AdvancedMemory: createSharedNamespace | advanced-memory.ts |
| `advancedMemory:delete` | Renderer ↔ Main | AdvancedMemory: delete | advanced-memory.ts |
| `advancedMemory:deleteMany` | Renderer ↔ Main | AdvancedMemory: deleteMany | advanced-memory.ts |
| `advancedMemory:edit` | Renderer ↔ Main | AdvancedMemory: edit | advanced-memory.ts |
| `advancedMemory:export` | Renderer ↔ Main | AdvancedMemory: export | advanced-memory.ts |
| `advancedMemory:extractFromMessage` | Renderer ↔ Main | AdvancedMemory: extractFromMessage | advanced-memory.ts |
| `advancedMemory:get` | Renderer ↔ Main | AdvancedMemory: get | advanced-memory.ts |
| `advancedMemory:getAllAdvancedMemories` | Renderer ↔ Main | AdvancedMemory: getAllAdvancedMemories | advanced-memory.ts |
| `advancedMemory:getAllEntityKnowledge` | Renderer ↔ Main | AdvancedMemory: getAllEntityKnowledge | advanced-memory.ts |
| `advancedMemory:getAllEpisodes` | Renderer ↔ Main | AdvancedMemory: getAllEpisodes | advanced-memory.ts |
| `advancedMemory:getHistory` | Renderer ↔ Main | AdvancedMemory: getHistory | advanced-memory.ts |
| `advancedMemory:getPending` | Renderer ↔ Main | AdvancedMemory: getPending | advanced-memory.ts |
| `advancedMemory:getSearchAnalytics` | Renderer ↔ Main | AdvancedMemory: getSearchAnalytics | advanced-memory.ts |
| `advancedMemory:getSearchHistory` | Renderer ↔ Main | AdvancedMemory: getSearchHistory | advanced-memory.ts |
| `advancedMemory:getSearchSuggestions` | Renderer ↔ Main | AdvancedMemory: getSearchSuggestions | advanced-memory.ts |
| `advancedMemory:getSharedNamespaceAnalytics` | Renderer ↔ Main | AdvancedMemory: getSharedNamespaceAnalytics | advanced-memory.ts |
| `advancedMemory:getStats` | Renderer ↔ Main | AdvancedMemory: getStats | advanced-memory.ts |
| `advancedMemory:health` | Renderer ↔ Main | AdvancedMemory: health | advanced-memory.ts |
| `advancedMemory:import` | Renderer ↔ Main | AdvancedMemory: import | advanced-memory.ts |
| `advancedMemory:recall` | Renderer ↔ Main | AdvancedMemory: recall | advanced-memory.ts |
| `advancedMemory:recategorize` | Renderer ↔ Main | AdvancedMemory: recategorize | advanced-memory.ts |
| `advancedMemory:reject` | Renderer ↔ Main | AdvancedMemory: reject | advanced-memory.ts |
| `advancedMemory:rejectAll` | Renderer ↔ Main | AdvancedMemory: rejectAll | advanced-memory.ts |
| `advancedMemory:remember` | Renderer ↔ Main | AdvancedMemory: remember | advanced-memory.ts |
| `advancedMemory:restore` | Renderer ↔ Main | AdvancedMemory: restore | advanced-memory.ts |
| `advancedMemory:rollback` | Renderer ↔ Main | AdvancedMemory: rollback | advanced-memory.ts |
| `advancedMemory:runDecay` | Renderer ↔ Main | AdvancedMemory: runDecay | advanced-memory.ts |
| `advancedMemory:search` | Renderer ↔ Main | AdvancedMemory: search | advanced-memory.ts |
| `advancedMemory:searchAcrossProjects` | Renderer ↔ Main | AdvancedMemory: searchAcrossProjects | advanced-memory.ts |
| `advancedMemory:shareWithProject` | Renderer ↔ Main | AdvancedMemory: shareWithProject | advanced-memory.ts |
| `advancedMemory:syncSharedNamespace` | Renderer ↔ Main | AdvancedMemory: syncSharedNamespace | advanced-memory.ts |

### Agent (10 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `agent:clone` | Renderer ↔ Main | Agent: clone | agent.ts |
| `agent:create` | Renderer ↔ Main | Agent: create | agent.ts |
| `agent:delete` | Renderer ↔ Main | Agent: delete | agent.ts |
| `agent:export` | Renderer ↔ Main | Agent: export | agent.ts |
| `agent:get` | Renderer ↔ Main | Get a specific agent by ID Returns null on failure | agent.ts |
| `agent:get-all` | Renderer ↔ Main | Get all agents Returns an empty array on failure | agent.ts |
| `agent:get-templates-library` | Renderer ↔ Main | Agent: get templates library | agent.ts |
| `agent:import` | Renderer ↔ Main | Agent: import | agent.ts |
| `agent:recover` | Renderer ↔ Main | Agent: recover | agent.ts |
| `agent:validate-template` | Renderer ↔ Main | Agent: validate template | agent.ts |

### App (1 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `app:getUserDataPath` | Renderer ↔ Main | App: getUserDataPath | files.ts |

### Audit (2 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `audit:clearLogs` | Renderer ↔ Main | Clears all audit logs. */ | audit.ts |
| `audit:getLogs` | Renderer ↔ Main | Retrieves audit logs with optional filtering. @param opti... | audit.ts |

### Auth (26 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `auth:create-master-key-backup` | Renderer ↔ Main | Auth: create master key backup | auth.ts |
| `auth:detect-provider` | Renderer ↔ Main | Auth: detect provider | auth.ts |
| `auth:end-session` | Renderer ↔ Main | Auth: end session | auth.ts |
| `auth:export-credentials` | Renderer ↔ Main | Auth: export credentials | auth.ts |
| `auth:get-active-linked-account` | Renderer ↔ Main | Auth: get active linked account | auth.ts |
| `auth:get-linked-accounts` | Renderer ↔ Main | Auth: get linked accounts | auth.ts |
| `auth:get-provider-analytics` | Renderer ↔ Main | Auth: get provider analytics | auth.ts |
| `auth:get-provider-health` | Renderer ↔ Main | Auth: get provider health | auth.ts |
| `auth:get-session-analytics` | Renderer ↔ Main | Auth: get session analytics | auth.ts |
| `auth:get-session-timeout` | Renderer ↔ Main | Auth: get session timeout | auth.ts |
| `auth:get-token-analytics` | Renderer ↔ Main | Auth: get token analytics | auth.ts |
| `auth:github-login` | Renderer ↔ Main | Auth: github login | auth.ts |
| `auth:has-linked-account` | Renderer ↔ Main | Auth: has linked account | auth.ts |
| `auth:import-credentials` | Renderer ↔ Main | Auth: import credentials | auth.ts |
| `auth:link-account` | Renderer ↔ Main | Auth: link account | auth.ts |
| `auth:poll-token` | Renderer ↔ Main | Auth: poll token | auth.ts |
| `auth:restore-master-key-backup` | Renderer ↔ Main | Auth: restore master key backup | auth.ts |
| `auth:revoke-account-token` | Renderer ↔ Main | Auth: revoke account token | auth.ts |
| `auth:rotate-token-encryption` | Renderer ↔ Main | Auth: rotate token encryption | auth.ts |
| `auth:set-active-linked-account` | Renderer ↔ Main | Auth: set active linked account | auth.ts |
| `auth:set-session-limit` | Renderer ↔ Main | Auth: set session limit | auth.ts |
| `auth:set-session-timeout` | Renderer ↔ Main | Auth: set session timeout | auth.ts |
| `auth:start-session` | Renderer ↔ Main | Auth: start session | auth.ts |
| `auth:touch-session` | Renderer ↔ Main | Auth: touch session | auth.ts |
| `auth:unlink-account` | Renderer ↔ Main | Auth: unlink account | auth.ts |
| `auth:unlink-provider` | Renderer ↔ Main | Auth: unlink provider | auth.ts |

### Backup (15 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `backup:cleanup` | Renderer ↔ Main | Backup: cleanup | backup.ts |
| `backup:configureAutoBackup` | Renderer ↔ Main | Backup: configureAutoBackup | backup.ts |
| `backup:create` | Renderer ↔ Main | Backup: create | backup.ts |
| `backup:createDisasterRecoveryBundle` | Renderer ↔ Main | Backup: createDisasterRecoveryBundle | backup.ts |
| `backup:delete` | Renderer ↔ Main | Backup: delete | backup.ts |
| `backup:getAutoBackupStatus` | Renderer ↔ Main | Backup: getAutoBackupStatus | backup.ts |
| `backup:getDir` | Renderer ↔ Main | Backup: getDir | backup.ts |
| `backup:list` | Renderer ↔ Main | Backup: list | backup.ts |
| `backup:restore` | Renderer ↔ Main | Backup: restore | backup.ts |
| `backup:restoreDisasterRecoveryBundle` | Renderer ↔ Main | Backup: restoreDisasterRecoveryBundle | backup.ts |
| `backup:schedule-config` | Renderer ↔ Main | Backup: schedule config | backup-scheduler.ts |
| `backup:schedule-trigger` | Renderer ↔ Main | Backup: schedule trigger | backup-scheduler.ts |
| `backup:schedule-update` | Renderer ↔ Main | Backup: schedule update | backup-scheduler.ts |
| `backup:syncToCloudDir` | Renderer ↔ Main | Backup: syncToCloudDir | backup.ts |
| `backup:verify` | Renderer ↔ Main | Backup: verify | backup.ts |

### Brain (8 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `brain:extractFromMessage` | Renderer ↔ Main | Brain: extractFromMessage | brain.ts |
| `brain:forget` | Renderer ↔ Main | Brain: forget | brain.ts |
| `brain:getByCategory` | Renderer ↔ Main | Brain: getByCategory | brain.ts |
| `brain:getContext` | Renderer ↔ Main | Brain: getContext | brain.ts |
| `brain:getStats` | Renderer ↔ Main | Brain: getStats | brain.ts |
| `brain:learn` | Renderer ↔ Main | Brain: learn | brain.ts |
| `brain:recall` | Renderer ↔ Main | Brain: recall | brain.ts |
| `brain:updateConfidence` | Renderer ↔ Main | Brain: updateConfidence | brain.ts |

### Chat (12 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `chat:cancel` | Renderer → Main (one-way) | Chat: cancel | chat.ts |
| `chat:copilot` | Renderer ↔ Main | Chat: copilot | chat.ts |
| `chat:export` | Renderer ↔ Main | Chat: export | chat-export.ts |
| `chat:export-to-file` | Renderer ↔ Main | Chat: export to file | chat-export.ts |
| `chat:import` | Renderer ↔ Main | Chat: import | chat-import.ts |
| `chat:openai` | Renderer ↔ Main | Chat: openai | chat.ts |
| `chat:retry-with-model` | Renderer ↔ Main | Chat: retry with model | chat.ts |
| `chat:share-create` | Renderer ↔ Main | Chat: share create | chat-share.ts |
| `chat:share-delete` | Renderer ↔ Main | Chat: share delete | chat-share.ts |
| `chat:share-get` | Renderer ↔ Main | Chat: share get | chat-share.ts |
| `chat:share-list` | Renderer ↔ Main | Chat: share list | chat-share.ts |
| `chat:stream` | Renderer ↔ Main | Chat: stream | chat.ts |

### Code (18 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `code:analyzeQuality` | Renderer ↔ Main | Get code quality analysis | code-intelligence.ts |
| `code:applyRenameSymbol` | Renderer ↔ Main | Apply symbol rename | code-intelligence.ts |
| `code:findDefinition` | Renderer ↔ Main | Find definition for a symbol | code-intelligence.ts |
| `code:findImplementations` | Renderer ↔ Main | Find implementations for a symbol | code-intelligence.ts |
| `code:findReferences` | Renderer ↔ Main | Find references for a symbol | code-intelligence.ts |
| `code:findSymbols` | Renderer ↔ Main | Find symbols by name/query | code-intelligence.ts |
| `code:findUsage` | Renderer ↔ Main | Find usage for a symbol | code-intelligence.ts |
| `code:generateFileDocumentation` | Renderer ↔ Main | Generate file documentation | code-intelligence.ts |
| `code:generateProjectDocumentation` | Renderer ↔ Main | Generate project documentation | code-intelligence.ts |
| `code:getFileOutline` | Renderer ↔ Main | Get outline for a file | code-intelligence.ts |
| `code:getSymbolAnalytics` | Renderer ↔ Main | Get symbol analytics for a project | code-intelligence.ts |
| `code:getSymbolRelationships` | Renderer ↔ Main | Get related files/symbols for a given symbol | code-intelligence.ts |
| `code:indexProject` | Renderer ↔ Main | Index a project | code-intelligence.ts |
| `code:previewRenameSymbol` | Renderer ↔ Main | Preview symbol rename | code-intelligence.ts |
| `code:queryIndexedSymbols` | Renderer ↔ Main | Query indexed symbols semantically | code-intelligence.ts |
| `code:querySymbols` | Renderer ↔ Main | Query indexed symbols semantically | code-intelligence.ts |
| `code:scanTodos` | Renderer ↔ Main | Scan for TODOs in a project | code-intelligence.ts |
| `code:searchFiles` | Renderer ↔ Main | Search files in project | code-intelligence.ts |

### Collaboration (7 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `collaboration:getActiveTaskCount` | Renderer ↔ Main | Get active task count for a provider | collaboration.ts |
| `collaboration:getProviderStats` | Renderer ↔ Main | Get provider statistics | collaboration.ts |
| `collaboration:run` | Renderer ↔ Main | Run multiple models in collaboration | collaboration.ts |
| `collaboration:setProviderConfig` | Renderer ↔ Main | Configure provider settings | collaboration.ts |
| `collaboration:sync:join` | Renderer ↔ Main | Join a collaborative room. | user-collaboration.ts |
| `collaboration:sync:leave` | Renderer ↔ Main | Leave a collaborative room. | user-collaboration.ts |
| `collaboration:sync:send` | Renderer ↔ Main | Send a synchronization update. | user-collaboration.ts |

### Context-window (4 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `context-window:getInfo` | Renderer ↔ Main | Get context window information | token-estimation.ts |
| `context-window:getRecommendedSettings` | Renderer ↔ Main | Get recommended truncation settings | token-estimation.ts |
| `context-window:needsTruncation` | Renderer ↔ Main | Check if truncation is needed | token-estimation.ts |
| `context-window:truncate` | Renderer ↔ Main | Truncate messages to fit context window | token-estimation.ts |

### Db (35 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `db:addMessage` | Renderer ↔ Main | Db: addMessage | db.ts |
| `db:archiveChat` | Renderer ↔ Main | Db: archiveChat | db.ts |
| `db:clearHistory` | Renderer ↔ Main | Db: clearHistory | db.ts |
| `db:createChat` | Renderer ↔ Main | Db: createChat | db.ts |
| `db:createFolder` | Renderer ↔ Main | Db: createFolder | db.ts |
| `db:createProject` | Renderer ↔ Main | Db: createProject | db.ts |
| `db:createPrompt` | Renderer ↔ Main | Db: createPrompt | db.ts |
| `db:deleteChat` | Renderer ↔ Main | Db: deleteChat | db.ts |
| `db:deleteFolder` | Renderer ↔ Main | Db: deleteFolder | db.ts |
| `db:deleteMessages` | Renderer ↔ Main | Db: deleteMessages | db.ts |
| `db:deleteProject` | Renderer ↔ Main | Db: deleteProject | db.ts |
| `db:deletePrompt` | Renderer ↔ Main | Db: deletePrompt | db.ts |
| `db:favoriteChat` | Renderer ↔ Main | Db: favoriteChat | db.ts |
| `db:getAllChats` | Renderer ↔ Main | Db: getAllChats | db.ts |
| `db:getChatById` | Renderer ↔ Main | Db: getChatById | db.ts |
| `db:getDetailedStats` | Renderer ↔ Main | Db: getDetailedStats | db.ts |
| `db:getFolders` | Renderer ↔ Main | Db: getFolders | db.ts |
| `db:getMessages` | Renderer ↔ Main | Db: getMessages | db.ts |
| `db:getProjectById` | Renderer ↔ Main | Db: getProjectById | db.ts |
| `db:getProjects` | Renderer ↔ Main | Db: getProjects | db.ts |
| `db:getPrompts` | Renderer ↔ Main | Db: getPrompts | db.ts |
| `db:getProviderStats` | Renderer ↔ Main | Db: getProviderStats | db.ts |
| `db:getUsageStats` | Renderer ↔ Main | Db: getUsageStats | db.ts |
| `db:moveChatToFolder` | Renderer ↔ Main | Db: moveChatToFolder | db.ts |
| `db:pinChat` | Renderer ↔ Main | Db: pinChat | db.ts |
| `db:recordUsage` | Renderer ↔ Main | Db: recordUsage | db.ts |
| `db:searchChats` | Renderer ↔ Main | Db: searchChats | db.ts |
| `db:searchSimilarMessages` | Renderer ↔ Main | Db: searchSimilarMessages | db.ts |
| `db:size-stats` | Renderer ↔ Main | Db: size stats | db-stats.ts |
| `db:updateChat` | Renderer ↔ Main | Db: updateChat | db.ts |
| `db:updateChatTitle` | Renderer ↔ Main | Db: updateChatTitle | db.ts |
| `db:updateFolder` | Renderer ↔ Main | Db: updateFolder | db.ts |
| `db:updateMessageVector` | Renderer ↔ Main | Db: updateMessageVector | db.ts |
| `db:updateProject` | Renderer ↔ Main | Db: updateProject | db.ts |
| `db:updatePrompt` | Renderer ↔ Main | Db: updatePrompt | db.ts |

### Debug (1 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `debug:dependency-graph` | Renderer ↔ Main | Debug: dependency graph | debug.ts |

### Files (14 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `files:createDirectory` | Renderer ↔ Main | Files: createDirectory | files.ts |
| `files:deleteDirectory` | Renderer ↔ Main | Files: deleteDirectory | files.ts |
| `files:deleteFile` | Renderer ↔ Main | Files: deleteFile | files.ts |
| `files:exists` | Renderer ↔ Main | Files: exists | files.ts |
| `files:health` | Renderer ↔ Main | Files: health | files.ts |
| `files:listDirectory` | Renderer ↔ Main | Files: listDirectory | files.ts |
| `files:readFile` | Renderer ↔ Main | Files: readFile | files.ts |
| `files:readImage` | Renderer ↔ Main | Files: readImage | files.ts |
| `files:renamePath` | Renderer ↔ Main | Files: renamePath | files.ts |
| `files:searchFiles` | Renderer ↔ Main | Files: searchFiles | files.ts |
| `files:searchFilesStream` | Renderer ↔ Main | Files: searchFilesStream | files.ts |
| `files:selectDirectory` | Renderer ↔ Main | Files: selectDirectory | files.ts |
| `files:selectFile` | Renderer ↔ Main | Files: selectFile | files.ts |
| `files:writeFile` | Renderer ↔ Main | Files: writeFile | files.ts |

### Gallery (5 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `gallery:batch-download` | Renderer ↔ Main | Gallery: batch download | gallery.ts |
| `gallery:delete` | Renderer ↔ Main | Gallery: delete | gallery.ts |
| `gallery:list` | Renderer ↔ Main | Gallery: list | gallery.ts |
| `gallery:open` | Renderer ↔ Main | Gallery: open | gallery.ts |
| `gallery:reveal` | Renderer ↔ Main | Gallery: reveal | gallery.ts |

### Git (54 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `git:abortRebase` | Renderer ↔ Main | Git: abortRebase | git-advanced.ts |
| `git:addSubmodule` | Renderer ↔ Main | Git: addSubmodule | git-advanced.ts |
| `git:applyStash` | Renderer ↔ Main | Git: applyStash | git-advanced.ts |
| `git:cancelOperation` | Renderer ↔ Main | Git: cancelOperation | git-advanced.ts |
| `git:checkout` | Renderer ↔ Main | Git: checkout | git.ts |
| `git:commit` | Renderer ↔ Main | Git: commit | git.ts |
| `git:continueRebase` | Renderer ↔ Main | Git: continueRebase | git-advanced.ts |
| `git:createStash` | Renderer ↔ Main | Git: createStash | git-advanced.ts |
| `git:dropStash` | Renderer ↔ Main | Git: dropStash | git-advanced.ts |
| `git:exportHooks` | Renderer ↔ Main | Git: exportHooks | git-advanced.ts |
| `git:exportRepositoryStats` | Renderer ↔ Main | Git: exportRepositoryStats | git-advanced.ts |
| `git:exportStash` | Renderer ↔ Main | Git: exportStash | git-advanced.ts |
| `git:finishFlowBranch` | Renderer ↔ Main | Git: finishFlowBranch | git-advanced.ts |
| `git:getBlame` | Renderer ↔ Main | Git: getBlame | git-advanced.ts |
| `git:getBranch` | Renderer ↔ Main | Git: getBranch | git.ts |
| `git:getBranches` | Renderer ↔ Main | Git: getBranches | git.ts |
| `git:getCommitDetails` | Renderer ↔ Main | Git: getCommitDetails | git-advanced.ts |
| `git:getCommitDiff` | Renderer ↔ Main | Git: getCommitDiff | git.ts |
| `git:getCommitStats` | Renderer ↔ Main | Git: getCommitStats | git.ts |
| `git:getConflicts` | Renderer ↔ Main | Git: getConflicts | git-advanced.ts |
| `git:getDetailedStatus` | Renderer ↔ Main | Git: getDetailedStatus | git.ts |
| `git:getDiffStats` | Renderer ↔ Main | Git: getDiffStats | git.ts |
| `git:getFileDiff` | Renderer ↔ Main | Git: getFileDiff | git.ts |
| `git:getFlowStatus` | Renderer ↔ Main | Git: getFlowStatus | git-advanced.ts |
| `git:getHooks` | Renderer ↔ Main | Git: getHooks | git-advanced.ts |
| `git:getLastCommit` | Renderer ↔ Main | Git: getLastCommit | git.ts |
| `git:getRebasePlan` | Renderer ↔ Main | Git: getRebasePlan | git-advanced.ts |
| `git:getRebaseStatus` | Renderer ↔ Main | Git: getRebaseStatus | git-advanced.ts |
| `git:getRecentCommits` | Renderer ↔ Main | Git: getRecentCommits | git.ts |
| `git:getRemotes` | Renderer ↔ Main | Git: getRemotes | git.ts |
| `git:getRepositoryStats` | Renderer ↔ Main | Git: getRepositoryStats | git-advanced.ts |
| `git:getStashes` | Renderer ↔ Main | Git: getStashes | git-advanced.ts |
| `git:getStatus` | Renderer ↔ Main | Git: getStatus | git.ts |
| `git:getSubmodules` | Renderer ↔ Main | Git: getSubmodules | git-advanced.ts |
| `git:getTrackingInfo` | Renderer ↔ Main | Git: getTrackingInfo | git.ts |
| `git:getTreeStatus` | Renderer ↔ Main | Git: getTreeStatus | git.ts |
| `git:getUnifiedDiff` | Renderer ↔ Main | Git: getUnifiedDiff | git.ts |
| `git:initSubmodules` | Renderer ↔ Main | Git: initSubmodules | git-advanced.ts |
| `git:installHook` | Renderer ↔ Main | Git: installHook | git-advanced.ts |
| `git:isRepository` | Renderer ↔ Main | Git: isRepository | git.ts |
| `git:openMergeTool` | Renderer ↔ Main | Git: openMergeTool | git-advanced.ts |
| `git:pull` | Renderer ↔ Main | Git: pull | git.ts |
| `git:push` | Renderer ↔ Main | Git: push | git.ts |
| `git:removeSubmodule` | Renderer ↔ Main | Git: removeSubmodule | git-advanced.ts |
| `git:resolveConflict` | Renderer ↔ Main | Git: resolveConflict | git-advanced.ts |
| `git:runControlledOperation` | Renderer ↔ Main | Git: runControlledOperation | git-advanced.ts |
| `git:stageFile` | Renderer ↔ Main | Git: stageFile | git.ts |
| `git:startFlowBranch` | Renderer ↔ Main | Git: startFlowBranch | git-advanced.ts |
| `git:startRebase` | Renderer ↔ Main | Git: startRebase | git-advanced.ts |
| `git:syncSubmodules` | Renderer ↔ Main | Git: syncSubmodules | git-advanced.ts |
| `git:testHook` | Renderer ↔ Main | Git: testHook | git-advanced.ts |
| `git:unstageFile` | Renderer ↔ Main | Git: unstageFile | git.ts |
| `git:updateSubmodules` | Renderer ↔ Main | Git: updateSubmodules | git-advanced.ts |
| `git:validateHook` | Renderer ↔ Main | Git: validateHook | git-advanced.ts |

### Health (4 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `health:check` | Renderer ↔ Main | Check a specific service immediately | health.ts |
| `health:getService` | Renderer ↔ Main | Get health status for a specific service | health.ts |
| `health:listServices` | Renderer ↔ Main | List all registered service names | health.ts |
| `health:status` | Renderer ↔ Main | Get overall health status of all registered services | health.ts |

### Hf (31 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `hf:cache-clear` | Renderer ↔ Main | Hf: cache clear | huggingface.ts |
| `hf:cache-stats` | Renderer ↔ Main | Hf: cache stats | huggingface.ts |
| `hf:cancel-download` | Renderer ↔ Main | Hf: cancel download | huggingface.ts |
| `hf:compare-models` | Renderer ↔ Main | Hf: compare models | huggingface.ts |
| `hf:convert-model` | Renderer ↔ Main | Hf: convert model | huggingface.ts |
| `hf:download-file` | Renderer ↔ Main | Hf: download file | huggingface.ts |
| `hf:finetune:cancel` | Renderer ↔ Main | Hf: finetune cancel | huggingface.ts |
| `hf:finetune:evaluate` | Renderer ↔ Main | Hf: finetune evaluate | huggingface.ts |
| `hf:finetune:export` | Renderer ↔ Main | Hf: finetune export | huggingface.ts |
| `hf:finetune:get` | Renderer ↔ Main | Hf: finetune get | huggingface.ts |
| `hf:finetune:list` | Renderer ↔ Main | Hf: finetune list | huggingface.ts |
| `hf:finetune:prepare-dataset` | Renderer ↔ Main | Hf: finetune prepare dataset | huggingface.ts |
| `hf:finetune:start` | Renderer ↔ Main | Hf: finetune start | huggingface.ts |
| `hf:get-conversion-presets` | Renderer ↔ Main | Hf: get conversion presets | huggingface.ts |
| `hf:get-files` | Renderer ↔ Main | Hf: get files | huggingface.ts |
| `hf:get-model-preview` | Renderer ↔ Main | Hf: get model preview | huggingface.ts |
| `hf:get-optimization-suggestions` | Renderer ↔ Main | Hf: get optimization suggestions | huggingface.ts |
| `hf:get-recommendations` | Renderer ↔ Main | Hf: get recommendations | huggingface.ts |
| `hf:search-models` | Renderer ↔ Main | Hf: search models | huggingface.ts |
| `hf:test-downloaded-model` | Renderer ↔ Main | Hf: test downloaded model | huggingface.ts |
| `hf:validate-compatibility` | Renderer ↔ Main | Hf: validate compatibility | huggingface.ts |
| `hf:validate-conversion` | Renderer ↔ Main | Hf: validate conversion | huggingface.ts |
| `hf:versions:compare` | Renderer ↔ Main | Hf: versions compare | huggingface.ts |
| `hf:versions:list` | Renderer ↔ Main | Hf: versions list | huggingface.ts |
| `hf:versions:notifications` | Renderer ↔ Main | Hf: versions notifications | huggingface.ts |
| `hf:versions:pin` | Renderer ↔ Main | Hf: versions pin | huggingface.ts |
| `hf:versions:register` | Renderer ↔ Main | Hf: versions register | huggingface.ts |
| `hf:versions:rollback` | Renderer ↔ Main | Hf: versions rollback | huggingface.ts |
| `hf:watchlist:add` | Renderer ↔ Main | Hf: watchlist add | huggingface.ts |
| `hf:watchlist:get` | Renderer ↔ Main | Hf: watchlist get | huggingface.ts |
| `hf:watchlist:remove` | Renderer ↔ Main | Hf: watchlist remove | huggingface.ts |

### Ideas (5 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `ideas:cancelSession` | Renderer ↔ Main | Ideas: cancelSession | idea-generator.ts |
| `ideas:deleteIdea` | Renderer ↔ Main | Ideas: deleteIdea | idea-generator.ts |
| `ideas:enrichIdea` | Renderer ↔ Main | Ideas: enrichIdea | idea-generator.ts |
| `ideas:rejectIdea` | Renderer ↔ Main | Ideas: rejectIdea | idea-generator.ts |
| `ideas:scoreIdea` | Renderer ↔ Main | Ideas: scoreIdea | idea-generator.ts |

### Key-rotation (4 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `key-rotation:getCurrentKey` | Renderer ↔ Main | Get current key for a provider | key-rotation.ts |
| `key-rotation:getStatus` | Renderer ↔ Main | Get rotation status for a provider | key-rotation.ts |
| `key-rotation:initialize` | Renderer ↔ Main | Initialize provider keys (comma-separated) | key-rotation.ts |
| `key-rotation:rotate` | Renderer ↔ Main | Rotate to the next key for a provider | key-rotation.ts |

### Lazy (1 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `lazy:get-status` | Renderer ↔ Main | Lazy: get status | lazy-services.ts |

### Log (5 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `log:buffer:clear` | Renderer ↔ Main | Log: buffer clear | logging.ts |
| `log:buffer:get` | Renderer ↔ Main | Log: buffer get | logging.ts |
| `log:stream:start` | Renderer ↔ Main | Log: stream start | logging.ts |
| `log:stream:stop` | Renderer ↔ Main | Log: stream stop | logging.ts |
| `log:write` | Renderer → Main (one-way) | Log: write | logging.ts |

### Mcp (34 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `mcp:debug-metrics` | Renderer ↔ Main | Mcp: debug metrics | mcp.ts |
| `mcp:dispatch` | Renderer ↔ Main | Mcp: dispatch | mcp.ts |
| `mcp:install` | Renderer ↔ Main | Mcp: install | mcp.ts |
| `mcp:list` | Renderer ↔ Main | Mcp: list | mcp.ts |
| `mcp:marketplace:categories` | Renderer ↔ Main | Mcp: marketplace categories | mcp-marketplace.ts |
| `mcp:marketplace:debug` | Renderer ↔ Main | Mcp: marketplace debug | mcp-marketplace.ts |
| `mcp:marketplace:draft-extension` | Renderer ↔ Main | Mcp: marketplace draft extension | mcp-marketplace.ts |
| `mcp:marketplace:extension-templates` | Renderer ↔ Main | Mcp: marketplace extension templates | mcp-marketplace.ts |
| `mcp:marketplace:filter` | Renderer ↔ Main | Mcp: marketplace filter | mcp-marketplace.ts |
| `mcp:marketplace:health` | Renderer ↔ Main | Mcp: marketplace health | mcp-marketplace.ts |
| `mcp:marketplace:install` | Renderer ↔ Main | Mcp: marketplace install | mcp-marketplace.ts |
| `mcp:marketplace:installed` | Renderer ↔ Main | Mcp: marketplace installed | mcp-marketplace.ts |
| `mcp:marketplace:list` | Renderer ↔ Main | Mcp: marketplace list | mcp-marketplace.ts |
| `mcp:marketplace:refresh` | Renderer ↔ Main | Mcp: marketplace refresh | mcp-marketplace.ts |
| `mcp:marketplace:reviews:list` | Renderer ↔ Main | Mcp: marketplace reviews list | mcp-marketplace.ts |
| `mcp:marketplace:reviews:moderate` | Renderer ↔ Main | Mcp: marketplace reviews moderate | mcp-marketplace.ts |
| `mcp:marketplace:reviews:submit` | Renderer ↔ Main | Mcp: marketplace reviews submit | mcp-marketplace.ts |
| `mcp:marketplace:reviews:vote` | Renderer ↔ Main | Mcp: marketplace reviews vote | mcp-marketplace.ts |
| `mcp:marketplace:rollback-version` | Renderer ↔ Main | Mcp: marketplace rollback version | mcp-marketplace.ts |
| `mcp:marketplace:search` | Renderer ↔ Main | Mcp: marketplace search | mcp-marketplace.ts |
| `mcp:marketplace:security-scan` | Renderer ↔ Main | Mcp: marketplace security scan | mcp-marketplace.ts |
| `mcp:marketplace:telemetry:crash` | Renderer ↔ Main | Mcp: marketplace telemetry crash | mcp-marketplace.ts |
| `mcp:marketplace:telemetry:summary` | Renderer ↔ Main | Mcp: marketplace telemetry summary | mcp-marketplace.ts |
| `mcp:marketplace:telemetry:track` | Renderer ↔ Main | Mcp: marketplace telemetry track | mcp-marketplace.ts |
| `mcp:marketplace:toggle` | Renderer ↔ Main | Mcp: marketplace toggle | mcp-marketplace.ts |
| `mcp:marketplace:uninstall` | Renderer ↔ Main | Mcp: marketplace uninstall | mcp-marketplace.ts |
| `mcp:marketplace:update-config` | Renderer ↔ Main | Mcp: marketplace update config | mcp-marketplace.ts |
| `mcp:marketplace:version-history` | Renderer ↔ Main | Mcp: marketplace version history | mcp-marketplace.ts |
| `mcp:permissions:list-requests` | Renderer ↔ Main | Mcp: permissions list requests | mcp.ts |
| `mcp:permissions:resolve-request` | Renderer ↔ Main | Mcp: permissions resolve request | mcp.ts |
| `mcp:permissions:set` | Renderer ↔ Main | Mcp: permissions set | mcp.ts |
| `mcp:reload-plugin` | Renderer ↔ Main | Mcp: reload plugin | mcp.ts |
| `mcp:toggle` | Renderer ↔ Main | Mcp: toggle | mcp.ts |
| `mcp:uninstall` | Renderer ↔ Main | Mcp: uninstall | mcp.ts |

### Migration (1 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `migration:status` | Renderer ↔ Main | Get migration status | migration.ts |

### Model-registry (3 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `model-registry:getAllModels` | Renderer ↔ Main | Model-registry: getAllModels | model-registry.ts |
| `model-registry:getInstalledModels` | Renderer ↔ Main | Model-registry: getInstalledModels | model-registry.ts |
| `model-registry:getRemoteModels` | Renderer ↔ Main | Model-registry: getRemoteModels | model-registry.ts |

### Ollama (25 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `ollama:abort` | Renderer ↔ Main | Ollama: abort | ollama.ts |
| `ollama:abortPull` | Renderer ↔ Main | Ollama: abortPull | ollama.ts |
| `ollama:chat` | Renderer ↔ Main | Ollama: chat | ollama.ts |
| `ollama:chatStream` | Renderer ↔ Main | Ollama: chatStream | ollama.ts |
| `ollama:checkAllModelsHealth` | Renderer ↔ Main | Ollama: checkAllModelsHealth | ollama.ts |
| `ollama:checkCuda` | Renderer ↔ Main | Ollama: checkCuda | ollama.ts |
| `ollama:checkModelHealth` | Renderer ↔ Main | Ollama: checkModelHealth | ollama.ts |
| `ollama:forceHealthCheck` | Renderer ↔ Main | Ollama: forceHealthCheck | ollama.ts |
| `ollama:getConnectionStatus` | Renderer ↔ Main | Ollama: getConnectionStatus | ollama.ts |
| `ollama:getGPUAlertThresholds` | Renderer ↔ Main | Ollama: getGPUAlertThresholds | ollama.ts |
| `ollama:getGPUInfo` | Renderer ↔ Main | Ollama: getGPUInfo | ollama.ts |
| `ollama:getLibraryModels` | Renderer ↔ Main | Ollama: getLibraryModels | ollama.ts |
| `ollama:getModelRecommendations` | Renderer ↔ Main | Ollama: getModelRecommendations | ollama.ts |
| `ollama:getModels` | Renderer ↔ Main | Ollama: getModels | ollama.ts |
| `ollama:getRecommendedModelForTask` | Renderer ↔ Main | Ollama: getRecommendedModelForTask | ollama.ts |
| `ollama:healthStatus` | Renderer ↔ Main | Ollama: healthStatus | ollama.ts |
| `ollama:isRunning` | Renderer ↔ Main | Ollama: isRunning | ollama.ts |
| `ollama:pull` | Renderer ↔ Main | Ollama: pull | ollama.ts |
| `ollama:reconnect` | Renderer ↔ Main | Ollama: reconnect | ollama.ts |
| `ollama:setGPUAlertThresholds` | Renderer ↔ Main | Ollama: setGPUAlertThresholds | ollama.ts |
| `ollama:start` | Renderer ↔ Main | Ollama: start | ollama.ts |
| `ollama:startGPUMonitoring` | Renderer ↔ Main | Ollama: startGPUMonitoring | ollama.ts |
| `ollama:stopGPUMonitoring` | Renderer ↔ Main | Ollama: stopGPUMonitoring | ollama.ts |
| `ollama:tags` | Renderer ↔ Main | Ollama: tags | ollama.ts |
| `ollama:testConnection` | Renderer ↔ Main | Ollama: testConnection | ollama.ts |

### Process (6 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `process:kill` | Renderer ↔ Main | Process: kill | process.ts |
| `process:list` | Renderer ↔ Main | Process: list | process.ts |
| `process:resize` | Renderer ↔ Main | Process: resize | process.ts |
| `process:scan-scripts` | Renderer ↔ Main | Process: scan scripts | process.ts |
| `process:spawn` | Renderer ↔ Main | Process: spawn | process.ts |
| `process:write` | Renderer ↔ Main | Process: write | process.ts |

### Project (88 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `project:add-step-comment` | Renderer ↔ Main | Project: add step comment | project-agent.ts |
| `project:apply-template` | Renderer ↔ Main | Project: apply template | project-agent.ts |
| `project:approve` | Renderer ↔ Main | Project: approve | project-agent.ts |
| `project:approve-current-plan` | Renderer ↔ Main | Project: approve current plan | project-agent.ts |
| `project:approve-step` | Renderer ↔ Main | Project: approve step | project-agent.ts |
| `project:build-consensus` | Renderer ↔ Main | Project: build consensus | project-agent.ts |
| `project:council-approve-proposal` | Renderer ↔ Main | Project: council approve proposal | project-agent.ts |
| `project:council-cleanup-expired-messages` | Renderer ↔ Main | Project: council cleanup expired messages | project-agent.ts |
| `project:council-generate-helper-handoff` | Renderer ↔ Main | Project: council generate helper handoff | project-agent.ts |
| `project:council-generate-plan` | Renderer ↔ Main | Project: council generate plan | project-agent.ts |
| `project:council-get-messages` | Renderer ↔ Main | Project: council get messages | project-agent.ts |
| `project:council-get-proposal` | Renderer ↔ Main | Project: council get proposal | project-agent.ts |
| `project:council-get-timeline` | Renderer ↔ Main | Project: council get timeline | project-agent.ts |
| `project:council-handle-quota-interrupt` | Renderer ↔ Main | Project: council handle quota interrupt | project-agent.ts |
| `project:council-list-available-workers` | Renderer ↔ Main | Project: council list available workers | project-agent.ts |
| `project:council-pause-execution` | Renderer ↔ Main | Project: council pause execution | project-agent.ts |
| `project:council-register-worker-availability` | Renderer ↔ Main | Project: council register worker availability | project-agent.ts |
| `project:council-reject-proposal` | Renderer ↔ Main | Project: council reject proposal | project-agent.ts |
| `project:council-resume-execution` | Renderer ↔ Main | Project: council resume execution | project-agent.ts |
| `project:council-review-helper-merge` | Renderer ↔ Main | Project: council review helper merge | project-agent.ts |
| `project:council-score-helper-candidates` | Renderer ↔ Main | Project: council score helper candidates | project-agent.ts |
| `project:council-send-message` | Renderer ↔ Main | Project: council send message | project-agent.ts |
| `project:council-start-execution` | Renderer ↔ Main | Project: council start execution | project-agent.ts |
| `project:create-debate-session` | Renderer ↔ Main | Project: create debate session | project-agent.ts |
| `project:create-pr` | Renderer ↔ Main | Project: create pr | project-agent.ts |
| `project:create-voting-session` | Renderer ↔ Main | Project: create voting session | project-agent.ts |
| `project:delete-canvas-edge` | Renderer ↔ Main | Project: delete canvas edge | project-agent.ts |
| `project:delete-canvas-node` | Renderer ↔ Main | Project: delete canvas node | project-agent.ts |
| `project:delete-profile` | Renderer ↔ Main | Project: delete profile | project-agent.ts |
| `project:delete-task` | Renderer ↔ Main | Project: delete task | project-agent.ts |
| `project:delete-task-by-node` | Renderer ↔ Main | Project: delete task by node | project-agent.ts |
| `project:delete-template` | Renderer ↔ Main | Project: delete template | project-agent.ts |
| `project:edit-step` | Renderer ↔ Main | Project: edit step | project-agent.ts |
| `project:export-template` | Renderer ↔ Main | Project: export template | project-agent.ts |
| `project:generate-debate-summary` | Renderer ↔ Main | Project: generate debate summary | project-agent.ts |
| `project:get-available-models` | Renderer ↔ Main | Project: get available models | project-agent.ts |
| `project:get-canvas-edges` | Renderer ↔ Main | Project: get canvas edges | project-agent.ts |
| `project:get-canvas-nodes` | Renderer ↔ Main | Project: get canvas nodes | project-agent.ts |
| `project:get-checkpoints` | Renderer ↔ Main | Project: get checkpoints | project-agent.ts |
| `project:get-debate-replay` | Renderer ↔ Main | Project: get debate replay | project-agent.ts |
| `project:get-debate-session` | Renderer ↔ Main | Project: get debate session | project-agent.ts |
| `project:get-events` | Renderer ↔ Main | Project: get events | project-agent.ts |
| `project:get-messages` | Renderer ↔ Main | Project: get messages | project-agent.ts |
| `project:get-performance-metrics` | Renderer ↔ Main | Project: get performance metrics | project-agent.ts |
| `project:get-plan-versions` | Renderer ↔ Main | Project: get plan versions | project-agent.ts |
| `project:get-profiles` | Renderer ↔ Main | Project: get profiles | project-agent.ts |
| `project:get-routing-rules` | Renderer ↔ Main | Project: get routing rules | project-agent.ts |
| `project:get-status` | Renderer ↔ Main | Project: get status | project-agent.ts |
| `project:get-task-history` | Renderer ↔ Main | Project: get task history | project-agent.ts |
| `project:get-teamwork-analytics` | Renderer ↔ Main | Project: get teamwork analytics | project-agent.ts |
| `project:get-telemetry` | Renderer ↔ Main | Project: get telemetry | project-agent.ts |
| `project:get-template` | Renderer ↔ Main | Project: get template | project-agent.ts |
| `project:get-templates` | Renderer ↔ Main | Project: get templates | project-agent.ts |
| `project:get-voting-analytics` | Renderer ↔ Main | Project: get voting analytics | project-agent.ts |
| `project:get-voting-config` | Renderer ↔ Main | Project: get voting config | project-agent.ts |
| `project:get-voting-session` | Renderer ↔ Main | Project: get voting session | project-agent.ts |
| `project:health` | Renderer ↔ Main | Project: health | project-agent.ts |
| `project:import-template` | Renderer ↔ Main | Project: import template | project-agent.ts |
| `project:insert-intervention` | Renderer ↔ Main | Project: insert intervention | project-agent.ts |
| `project:list-debate-history` | Renderer ↔ Main | Project: list debate history | project-agent.ts |
| `project:list-voting-sessions` | Renderer ↔ Main | Project: list voting sessions | project-agent.ts |
| `project:list-voting-templates` | Renderer ↔ Main | Project: list voting templates | project-agent.ts |
| `project:override-debate-session` | Renderer ↔ Main | Project: override debate session | project-agent.ts |
| `project:override-voting` | Renderer ↔ Main | Project: override voting | project-agent.ts |
| `project:pause-task` | Renderer ↔ Main | Project: pause task | project-agent.ts |
| `project:plan` | Renderer ↔ Main | Project: plan | project-agent.ts |
| `project:register-profile` | Renderer ↔ Main | Project: register profile | project-agent.ts |
| `project:reject-current-plan` | Renderer ↔ Main | Project: reject current plan | project-agent.ts |
| `project:request-votes` | Renderer ↔ Main | Project: request votes | project-agent.ts |
| `project:reset-state` | Renderer ↔ Main | Project: reset state | project-agent.ts |
| `project:resolve-debate-session` | Renderer ↔ Main | Project: resolve debate session | project-agent.ts |
| `project:resolve-voting` | Renderer ↔ Main | Project: resolve voting | project-agent.ts |
| `project:resume-checkpoint` | Renderer ↔ Main | Project: resume checkpoint | project-agent.ts |
| `project:resume-task` | Renderer ↔ Main | Project: resume task | project-agent.ts |
| `project:retry-step` | Renderer ↔ Main | Project: retry step | project-agent.ts |
| `project:rollback-checkpoint` | Renderer ↔ Main | Project: rollback checkpoint | project-agent.ts |
| `project:save-canvas-edges` | Renderer ↔ Main | Project: save canvas edges | project-agent.ts |
| `project:save-canvas-nodes` | Renderer ↔ Main | Project: save canvas nodes | project-agent.ts |
| `project:save-snapshot` | Renderer ↔ Main | Project: save snapshot | project-agent.ts |
| `project:save-template` | Renderer ↔ Main | Project: save template | project-agent.ts |
| `project:select-model` | Renderer ↔ Main | Project: select model | project-agent.ts |
| `project:set-routing-rules` | Renderer ↔ Main | Project: set routing rules | project-agent.ts |
| `project:skip-step` | Renderer ↔ Main | Project: skip step | project-agent.ts |
| `project:start` | Renderer ↔ Main | Project: start | project-agent.ts |
| `project:stop` | Renderer ↔ Main | Project: stop | project-agent.ts |
| `project:submit-debate-argument` | Renderer ↔ Main | Project: submit debate argument | project-agent.ts |
| `project:submit-vote` | Renderer ↔ Main | Project: submit vote | project-agent.ts |
| `project:update-voting-config` | Renderer ↔ Main | Project: update voting config | project-agent.ts |

### Prompt-templates (11 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `prompt-templates:create` | Renderer ↔ Main | Create a new custom template | prompt-templates.ts |
| `prompt-templates:delete` | Renderer ↔ Main | Delete a custom template | prompt-templates.ts |
| `prompt-templates:get` | Renderer ↔ Main | Get a template by ID | prompt-templates.ts |
| `prompt-templates:getAll` | Renderer ↔ Main | Get all templates (builtin + custom) | prompt-templates.ts |
| `prompt-templates:getByCategory` | Renderer ↔ Main | Get templates by category | prompt-templates.ts |
| `prompt-templates:getByTag` | Renderer ↔ Main | Get templates by tag | prompt-templates.ts |
| `prompt-templates:getCategories` | Renderer ↔ Main | Get all categories | prompt-templates.ts |
| `prompt-templates:getTags` | Renderer ↔ Main | Get all tags | prompt-templates.ts |
| `prompt-templates:render` | Renderer ↔ Main | Render a template with variables | prompt-templates.ts |
| `prompt-templates:search` | Renderer ↔ Main | Search templates | prompt-templates.ts |
| `prompt-templates:update` | Renderer ↔ Main | Update an existing custom template | prompt-templates.ts |

### Prompts (6 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `prompts:shared-create` | Renderer ↔ Main | Prompts: shared create | shared-prompts.ts |
| `prompts:shared-delete` | Renderer ↔ Main | Prompts: shared delete | shared-prompts.ts |
| `prompts:shared-export` | Renderer ↔ Main | Prompts: shared export | shared-prompts.ts |
| `prompts:shared-import` | Renderer ↔ Main | Prompts: shared import | shared-prompts.ts |
| `prompts:shared-list` | Renderer ↔ Main | Prompts: shared list | shared-prompts.ts |
| `prompts:shared-update` | Renderer ↔ Main | Prompts: shared update | shared-prompts.ts |

### Proxy (18 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `proxy:anthropicLogin` | Renderer ↔ Main | Proxy: anthropicLogin | proxy.ts |
| `proxy:antigravityLogin` | Renderer ↔ Main | Proxy: antigravityLogin | proxy.ts |
| `proxy:claudeLogin` | Renderer ↔ Main | Proxy: claudeLogin | proxy.ts |
| `proxy:codexLogin` | Renderer ↔ Main | Proxy: codexLogin | proxy.ts |
| `proxy:deleteAuthFile` | Renderer ↔ Main | Proxy: deleteAuthFile | proxy.ts |
| `proxy:downloadAuthFile` | Renderer ↔ Main | Proxy: downloadAuthFile | proxy.ts |
| `proxy:get-rate-limit-config` | Renderer ↔ Main | Proxy: get rate limit config | proxy.ts |
| `proxy:get-rate-limit-metrics` | Renderer ↔ Main | Proxy: get rate limit metrics | proxy.ts |
| `proxy:getClaudeQuota` | Renderer ↔ Main | Proxy: getClaudeQuota | proxy.ts |
| `proxy:getCodexUsage` | Renderer ↔ Main | Proxy: getCodexUsage | proxy.ts |
| `proxy:getCopilotQuota` | Renderer ↔ Main | Proxy: getCopilotQuota | proxy.ts |
| `proxy:getModels` | Renderer ↔ Main | Proxy: getModels | proxy.ts |
| `proxy:getQuota` | Renderer ↔ Main | Proxy: getQuota | proxy.ts |
| `proxy:rotate-api-key` | Renderer ↔ Main | Proxy: rotate api key | proxy.ts |
| `proxy:rotate-management-secret` | Renderer ↔ Main | Proxy: rotate management secret | proxy.ts |
| `proxy:saveClaudeSession` | Renderer ↔ Main | Proxy: saveClaudeSession | proxy.ts |
| `proxy:set-rate-limit-config` | Renderer ↔ Main | Proxy: set rate limit config | proxy.ts |
| `proxy:syncAuthFiles` | Renderer ↔ Main | Proxy: syncAuthFiles | proxy.ts |

### Sd-cpp (28 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `sd-cpp:batchGenerate` | Renderer ↔ Main | Sd-cpp: batchGenerate | sd-cpp.ts |
| `sd-cpp:cancelSchedule` | Renderer ↔ Main | Sd-cpp: cancelSchedule | sd-cpp.ts |
| `sd-cpp:compare` | Renderer ↔ Main | Sd-cpp: compare | sd-cpp.ts |
| `sd-cpp:deletePreset` | Renderer ↔ Main | Sd-cpp: deletePreset | sd-cpp.ts |
| `sd-cpp:deleteWorkflowTemplate` | Renderer ↔ Main | Sd-cpp: deleteWorkflowTemplate | sd-cpp.ts |
| `sd-cpp:edit` | Renderer ↔ Main | Sd-cpp: edit | sd-cpp.ts |
| `sd-cpp:exportComparison` | Renderer ↔ Main | Sd-cpp: exportComparison | sd-cpp.ts |
| `sd-cpp:exportHistory` | Renderer ↔ Main | Sd-cpp: exportHistory | sd-cpp.ts |
| `sd-cpp:exportPresetShare` | Renderer ↔ Main | Sd-cpp: exportPresetShare | sd-cpp.ts |
| `sd-cpp:exportWorkflowTemplateShare` | Renderer ↔ Main | Sd-cpp: exportWorkflowTemplateShare | sd-cpp.ts |
| `sd-cpp:getAnalytics` | Renderer ↔ Main | Sd-cpp: getAnalytics | sd-cpp.ts |
| `sd-cpp:getHistory` | Renderer ↔ Main | Sd-cpp: getHistory | sd-cpp.ts |
| `sd-cpp:getPresetAnalytics` | Renderer ↔ Main | Sd-cpp: getPresetAnalytics | sd-cpp.ts |
| `sd-cpp:getQueueStats` | Renderer ↔ Main | Sd-cpp: getQueueStats | sd-cpp.ts |
| `sd-cpp:getScheduleAnalytics` | Renderer ↔ Main | Sd-cpp: getScheduleAnalytics | sd-cpp.ts |
| `sd-cpp:getStatus` | Renderer ↔ Main | Get the current status of the SD-CPP runtime | sd-cpp.ts |
| `sd-cpp:importPresetShare` | Renderer ↔ Main | Sd-cpp: importPresetShare | sd-cpp.ts |
| `sd-cpp:importWorkflowTemplateShare` | Renderer ↔ Main | Sd-cpp: importWorkflowTemplateShare | sd-cpp.ts |
| `sd-cpp:listPresets` | Renderer ↔ Main | Sd-cpp: listPresets | sd-cpp.ts |
| `sd-cpp:listSchedules` | Renderer ↔ Main | Sd-cpp: listSchedules | sd-cpp.ts |
| `sd-cpp:listWorkflowTemplates` | Renderer ↔ Main | Sd-cpp: listWorkflowTemplates | sd-cpp.ts |
| `sd-cpp:regenerate` | Renderer ↔ Main | Sd-cpp: regenerate | sd-cpp.ts |
| `sd-cpp:reinstall` | Renderer ↔ Main | Force a reinstallation / repair of the SD-CPP runtime | sd-cpp.ts |
| `sd-cpp:savePreset` | Renderer ↔ Main | Sd-cpp: savePreset | sd-cpp.ts |
| `sd-cpp:saveWorkflowTemplate` | Renderer ↔ Main | Sd-cpp: saveWorkflowTemplate | sd-cpp.ts |
| `sd-cpp:schedule` | Renderer ↔ Main | Sd-cpp: schedule | sd-cpp.ts |
| `sd-cpp:searchHistory` | Renderer ↔ Main | Sd-cpp: searchHistory | sd-cpp.ts |
| `sd-cpp:shareComparison` | Renderer ↔ Main | Sd-cpp: shareComparison | sd-cpp.ts |

### Settings (3 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `settings:get` | Renderer ↔ Main | Settings: get | settings.ts |
| `settings:health` | Renderer ↔ Main | Settings: health | settings.ts |
| `settings:save` | Renderer ↔ Main | Settings: save | settings.ts |

### Shell (3 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `shell:openExternal` | Renderer ↔ Main | Shell: openExternal | window.ts |
| `shell:openTerminal` | Renderer ↔ Main | Shell: openTerminal | window.ts |
| `shell:runCommand` | Renderer ↔ Main | Shell: runCommand | window.ts |

### Ssh (56 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `ssh:acquireConnection` | Renderer ↔ Main | Ssh: acquireConnection | ssh.ts |
| `ssh:backupManagedKey` | Renderer ↔ Main | Ssh: backupManagedKey | ssh.ts |
| `ssh:closeTunnel` | Renderer ↔ Main | Ssh: closeTunnel | ssh.ts |
| `ssh:connect` | Renderer ↔ Main | Ssh: connect | ssh.ts |
| `ssh:deleteDir` | Renderer ↔ Main | Ssh: deleteDir | ssh.ts |
| `ssh:deleteFile` | Renderer ↔ Main | Ssh: deleteFile | ssh.ts |
| `ssh:deleteManagedKey` | Renderer ↔ Main | Ssh: deleteManagedKey | ssh.ts |
| `ssh:deleteProfile` | Renderer ↔ Main | Ssh: deleteProfile | ssh.ts |
| `ssh:deleteProfileTemplate` | Renderer ↔ Main | Ssh: deleteProfileTemplate | ssh.ts |
| `ssh:deleteTunnelPreset` | Renderer ↔ Main | Ssh: deleteTunnelPreset | ssh.ts |
| `ssh:disconnect` | Renderer ↔ Main | Ssh: disconnect | ssh.ts |
| `ssh:download` | Renderer ↔ Main | Ssh: download | ssh.ts |
| `ssh:enqueueTransfer` | Renderer ↔ Main | Ssh: enqueueTransfer | ssh.ts |
| `ssh:execute` | Renderer ↔ Main | Ssh: execute | ssh.ts |
| `ssh:exportProfiles` | Renderer ↔ Main | Ssh: exportProfiles | ssh.ts |
| `ssh:exportSearchHistory` | Renderer ↔ Main | Ssh: exportSearchHistory | ssh.ts |
| `ssh:exportSessionRecording` | Renderer ↔ Main | Ssh: exportSessionRecording | ssh.ts |
| `ssh:getConnectionPoolStats` | Renderer ↔ Main | Ssh: getConnectionPoolStats | ssh.ts |
| `ssh:getConnections` | Renderer ↔ Main | Ssh: getConnections | ssh.ts |
| `ssh:getInstalledPackages` | Renderer ↔ Main | Ssh: getInstalledPackages | ssh.ts |
| `ssh:getLogFiles` | Renderer ↔ Main | Ssh: getLogFiles | ssh.ts |
| `ssh:getProfiles` | Renderer ↔ Main | Ssh: getProfiles | ssh.ts |
| `ssh:getSearchHistory` | Renderer ↔ Main | Ssh: getSearchHistory | ssh.ts |
| `ssh:getSessionRecording` | Renderer ↔ Main | Ssh: getSessionRecording | ssh.ts |
| `ssh:getSystemStats` | Renderer ↔ Main | Ssh: getSystemStats | ssh.ts |
| `ssh:getTransferQueue` | Renderer ↔ Main | Ssh: getTransferQueue | ssh.ts |
| `ssh:health` | Renderer ↔ Main | Ssh: health | ssh.ts |
| `ssh:importProfiles` | Renderer ↔ Main | Ssh: importProfiles | ssh.ts |
| `ssh:isConnected` | Renderer ↔ Main | Ssh: isConnected | ssh.ts |
| `ssh:listDir` | Renderer ↔ Main | Ssh: listDir | ssh.ts |
| `ssh:listKnownHosts` | Renderer ↔ Main | Ssh: listKnownHosts | ssh.ts |
| `ssh:listManagedKeys` | Renderer ↔ Main | Ssh: listManagedKeys | ssh.ts |
| `ssh:listProfileTemplates` | Renderer ↔ Main | Ssh: listProfileTemplates | ssh.ts |
| `ssh:listRemoteContainers` | Renderer ↔ Main | Ssh: listRemoteContainers | ssh.ts |
| `ssh:listSessionRecordings` | Renderer ↔ Main | Ssh: listSessionRecordings | ssh.ts |
| `ssh:listTunnelPresets` | Renderer ↔ Main | Ssh: listTunnelPresets | ssh.ts |
| `ssh:listTunnels` | Renderer ↔ Main | Ssh: listTunnels | ssh.ts |
| `ssh:mkdir` | Renderer ↔ Main | Ssh: mkdir | ssh.ts |
| `ssh:readFile` | Renderer ↔ Main | Ssh: readFile | ssh.ts |
| `ssh:readLogFile` | Renderer ↔ Main | Ssh: readLogFile | ssh.ts |
| `ssh:reconnect` | Renderer ↔ Main | Ssh: reconnect | ssh.ts |
| `ssh:releaseConnection` | Renderer ↔ Main | Ssh: releaseConnection | ssh.ts |
| `ssh:rename` | Renderer ↔ Main | Ssh: rename | ssh.ts |
| `ssh:runTransferBatch` | Renderer ↔ Main | Ssh: runTransferBatch | ssh.ts |
| `ssh:saveProfile` | Renderer ↔ Main | Ssh: saveProfile | ssh.ts |
| `ssh:saveProfileTemplate` | Renderer ↔ Main | Ssh: saveProfileTemplate | ssh.ts |
| `ssh:searchSessionRecording` | Renderer ↔ Main | Ssh: searchSessionRecording | ssh.ts |
| `ssh:shellStart` | Renderer ↔ Main | Ssh: shellStart | ssh.ts |
| `ssh:shellWrite` | Renderer ↔ Main | Ssh: shellWrite | ssh.ts |
| `ssh:startSessionRecording` | Renderer ↔ Main | Ssh: startSessionRecording | ssh.ts |
| `ssh:stopRemoteContainer` | Renderer ↔ Main | Ssh: stopRemoteContainer | ssh.ts |
| `ssh:stopSessionRecording` | Renderer ↔ Main | Ssh: stopSessionRecording | ssh.ts |
| `ssh:testProfile` | Renderer ↔ Main | Ssh: testProfile | ssh.ts |
| `ssh:upload` | Renderer ↔ Main | Ssh: upload | ssh.ts |
| `ssh:validateProfile` | Renderer ↔ Main | Ssh: validateProfile | ssh.ts |
| `ssh:writeFile` | Renderer ↔ Main | Ssh: writeFile | ssh.ts |

### Terminal (1 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `terminal:isAvailable` | Renderer ↔ Main | Terminal: isAvailable | terminal.ts |

### Theme (24 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `theme:addCustom` | Renderer ↔ Main | Theme: addCustom | theme.ts |
| `theme:applyPreset` | Renderer ↔ Main | Theme: applyPreset | theme.ts |
| `theme:clearHistory` | Renderer ↔ Main | Theme: clearHistory | theme.ts |
| `theme:clearPreset` | Renderer ↔ Main | Theme: clearPreset | theme.ts |
| `theme:deleteCustom` | Renderer ↔ Main | Theme: deleteCustom | theme.ts |
| `theme:duplicate` | Renderer ↔ Main | Theme: duplicate | theme.ts |
| `theme:export` | Renderer ↔ Main | Theme: export | theme.ts |
| `theme:getAll` | Renderer ↔ Main | Theme: getAll | theme.ts |
| `theme:getCurrent` | Renderer ↔ Main | Theme: getCurrent | theme.ts |
| `theme:getCurrentPreset` | Renderer ↔ Main | Theme: getCurrentPreset | theme.ts |
| `theme:getCustom` | Renderer ↔ Main | Theme: getCustom | theme.ts |
| `theme:getDetails` | Renderer ↔ Main | Theme: getDetails | theme.ts |
| `theme:getFavorites` | Renderer ↔ Main | Theme: getFavorites | theme.ts |
| `theme:getHistory` | Renderer ↔ Main | Theme: getHistory | theme.ts |
| `theme:getPresets` | Renderer ↔ Main | Theme: getPresets | theme.ts |
| `theme:import` | Renderer ↔ Main | Theme: import | theme.ts |
| `theme:isFavorite` | Renderer ↔ Main | Theme: isFavorite | theme.ts |
| `theme:runtime:getAll` | Renderer ↔ Main | Theme: runtime getAll | theme.ts |
| `theme:runtime:install` | Renderer ↔ Main | Theme: runtime install | theme.ts |
| `theme:runtime:openDirectory` | Renderer ↔ Main | Theme: runtime openDirectory | theme.ts |
| `theme:runtime:uninstall` | Renderer ↔ Main | Theme: runtime uninstall | theme.ts |
| `theme:set` | Renderer ↔ Main | Theme: set | theme.ts |
| `theme:toggleFavorite` | Renderer ↔ Main | Theme: toggleFavorite | theme.ts |
| `theme:updateCustom` | Renderer ↔ Main | Theme: updateCustom | theme.ts |

### Token-estimation (5 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `token-estimation:estimateMessage` | Renderer ↔ Main | Estimate tokens for a single message | token-estimation.ts |
| `token-estimation:estimateMessages` | Renderer ↔ Main | Estimate tokens for multiple messages | token-estimation.ts |
| `token-estimation:estimateString` | Renderer ↔ Main | Estimate tokens for a string | token-estimation.ts |
| `token-estimation:fitsInContextWindow` | Renderer ↔ Main | Check if messages fit in context window | token-estimation.ts |
| `token-estimation:getContextWindowSize` | Renderer ↔ Main | Get context window size for a model | token-estimation.ts |

### Tools (3 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `tools:execute` | Renderer ↔ Main | Tools: execute | tools.ts |
| `tools:getDefinitions` | Renderer ↔ Main | Tools: getDefinitions | tools.ts |
| `tools:kill` | Renderer ↔ Main | Tools: kill | tools.ts |

### Usage (3 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `usage:checkLimit` | Renderer ↔ Main | Usage: checkLimit | usage.ts |
| `usage:getUsageCount` | Renderer ↔ Main | Usage: getUsageCount | usage.ts |
| `usage:recordUsage` | Renderer ↔ Main | Usage: recordUsage | usage.ts |

### Window (8 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `window:captureCookies` | Renderer ↔ Main | Opens a hidden BrowserWindow to capture cookies from a UR... | window.ts |
| `window:close` | Renderer → Main (one-way) | Window: close | window.ts |
| `window:maximize` | Renderer → Main (one-way) | Window: maximize | window.ts |
| `window:minimize` | Renderer → Main (one-way) | Window: minimize | window.ts |
| `window:openDetachedTerminal` | Renderer ↔ Main | Window: openDetachedTerminal | window.ts |
| `window:resize` | Renderer → Main (one-way) | Window: resize | window.ts |
| `window:toggle-compact` | Renderer → Main (one-way) | Window: toggle compact | window.ts |
| `window:toggle-fullscreen` | Renderer → Main (one-way) | Window: toggle fullscreen | window.ts |

### Workflow (7 channels)

| Channel | Direction | Description | Source File |
|---------|-----------|-------------|-------------|
| `workflow:create` | Renderer ↔ Main | Workflow: create | workflow.ts |
| `workflow:delete` | Renderer ↔ Main | Workflow: delete | workflow.ts |
| `workflow:execute` | Renderer ↔ Main | Workflow: execute | workflow.ts |
| `workflow:get` | Renderer ↔ Main | Workflow: get | workflow.ts |
| `workflow:getAll` | Renderer ↔ Main | Workflow: getAll | workflow.ts |
| `workflow:triggerManual` | Renderer ↔ Main | Workflow: triggerManual | workflow.ts |
| `workflow:update` | Renderer ↔ Main | Workflow: update | workflow.ts |

---

*Generated on 2026-02-28*

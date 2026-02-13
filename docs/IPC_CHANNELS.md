# IPC Channels Reference

This document is auto-generated from `src/main/ipc/*.ts` handler registrations.

- Generated at: 2026-02-13T00:26:10.748Z
- Total channels: 441
- Namespaces: 50

## Usage Example

```ts
const chats = await window.electron.invoke('db:getChats');
const status = await window.electron.invoke('git:getStatus', '/repo/path');
```

## advancedMemory

Count: 18

- `advancedMemory:archive` (src/main/ipc/advanced-memory.ts)
- `advancedMemory:archiveMany` (src/main/ipc/advanced-memory.ts)
- `advancedMemory:confirm` (src/main/ipc/advanced-memory.ts)
- `advancedMemory:confirmAll` (src/main/ipc/advanced-memory.ts)
- `advancedMemory:delete` (src/main/ipc/advanced-memory.ts)
- `advancedMemory:deleteMany` (src/main/ipc/advanced-memory.ts)
- `advancedMemory:edit` (src/main/ipc/advanced-memory.ts)
- `advancedMemory:extractFromMessage` (src/main/ipc/advanced-memory.ts)
- `advancedMemory:get` (src/main/ipc/advanced-memory.ts)
- `advancedMemory:getPending` (src/main/ipc/advanced-memory.ts)
- `advancedMemory:getStats` (src/main/ipc/advanced-memory.ts)
- `advancedMemory:recall` (src/main/ipc/advanced-memory.ts)
- `advancedMemory:reject` (src/main/ipc/advanced-memory.ts)
- `advancedMemory:rejectAll` (src/main/ipc/advanced-memory.ts)
- `advancedMemory:remember` (src/main/ipc/advanced-memory.ts)
- `advancedMemory:restore` (src/main/ipc/advanced-memory.ts)
- `advancedMemory:runDecay` (src/main/ipc/advanced-memory.ts)
- `advancedMemory:search` (src/main/ipc/advanced-memory.ts)

## agent

Count: 2

- `agent:get` (src/main/ipc/agent.ts)
- `agent:get-all` (src/main/ipc/agent.ts)

## app

Count: 1

- `app:getUserDataPath` (src/main/ipc/files.ts)

## audit

Count: 2

- `audit:clearLogs` (src/main/ipc/audit.ts)
- `audit:getLogs` (src/main/ipc/audit.ts)

## auth

Count: 6

- `auth:github-login` (src/main/ipc/auth.ts)
- `auth:link-account` (src/main/ipc/auth.ts)
- `auth:poll-token` (src/main/ipc/auth.ts)
- `auth:set-active-linked-account` (src/main/ipc/auth.ts)
- `auth:unlink-account` (src/main/ipc/auth.ts)
- `auth:unlink-provider` (src/main/ipc/auth.ts)

## backup

Count: 8

- `backup:cleanup` (src/main/ipc/backup.ts)
- `backup:configureAutoBackup` (src/main/ipc/backup.ts)
- `backup:create` (src/main/ipc/backup.ts)
- `backup:delete` (src/main/ipc/backup.ts)
- `backup:getAutoBackupStatus` (src/main/ipc/backup.ts)
- `backup:getDir` (src/main/ipc/backup.ts)
- `backup:list` (src/main/ipc/backup.ts)
- `backup:restore` (src/main/ipc/backup.ts)

## brain

Count: 8

- `brain:extractFromMessage` (src/main/ipc/brain.ts)
- `brain:forget` (src/main/ipc/brain.ts)
- `brain:getByCategory` (src/main/ipc/brain.ts)
- `brain:getContext` (src/main/ipc/brain.ts)
- `brain:getStats` (src/main/ipc/brain.ts)
- `brain:learn` (src/main/ipc/brain.ts)
- `brain:recall` (src/main/ipc/brain.ts)
- `brain:updateConfidence` (src/main/ipc/brain.ts)

## chat

Count: 3

- `chat:copilot` (src/main/ipc/chat.ts)
- `chat:openai` (src/main/ipc/chat.ts)
- `chat:stream` (src/main/ipc/chat.ts)

## code

Count: 5

- `code:findSymbols` (src/main/ipc/code-intelligence.ts)
- `code:indexProject` (src/main/ipc/code-intelligence.ts)
- `code:queryIndexedSymbols` (src/main/ipc/code-intelligence.ts)
- `code:scanTodos` (src/main/ipc/code-intelligence.ts)
- `code:searchFiles` (src/main/ipc/code-intelligence.ts)

## collaboration

Count: 4

- `collaboration:getActiveTaskCount` (src/main/ipc/collaboration.ts)
- `collaboration:getProviderStats` (src/main/ipc/collaboration.ts)
- `collaboration:run` (src/main/ipc/collaboration.ts)
- `collaboration:setProviderConfig` (src/main/ipc/collaboration.ts)

## context-window

Count: 4

- `context-window:getInfo` (src/main/ipc/token-estimation.ts)
- `context-window:getRecommendedSettings` (src/main/ipc/token-estimation.ts)
- `context-window:needsTruncation` (src/main/ipc/token-estimation.ts)
- `context-window:truncate` (src/main/ipc/token-estimation.ts)

## db

Count: 33

- `db:addMessage` (src/main/ipc/db.ts)
- `db:addTokenUsage` (src/main/ipc/db.ts)
- `db:archiveChat` (src/main/ipc/db.ts)
- `db:archiveProject` (src/main/ipc/db.ts)
- `db:bulkArchiveChats` (src/main/ipc/db.ts)
- `db:bulkArchiveProjects` (src/main/ipc/db.ts)
- `db:bulkDeleteChats` (src/main/ipc/db.ts)
- `db:bulkDeleteProjects` (src/main/ipc/db.ts)
- `db:createChat` (src/main/ipc/db.ts)
- `db:createFolder` (src/main/ipc/db.ts)
- `db:createProject` (src/main/ipc/db.ts)
- `db:createPrompt` (src/main/ipc/db.ts)
- `db:deleteAllChats` (src/main/ipc/db.ts)
- `db:deleteChat` (src/main/ipc/db.ts)
- `db:deleteChatsByTitle` (src/main/ipc/db.ts)
- `db:deleteFolder` (src/main/ipc/db.ts)
- `db:deleteMessage` (src/main/ipc/db.ts)
- `db:deleteMessages` (src/main/ipc/db.ts)
- `db:deleteProject` (src/main/ipc/db.ts)
- `db:deletePrompt` (src/main/ipc/db.ts)
- `db:duplicateChat` (src/main/ipc/db.ts)
- `db:getBookmarkedMessages` (src/main/ipc/db.ts)
- `db:getDetailedStats` (src/main/ipc/db.ts)
- `db:getMessages` (src/main/ipc/db.ts)
- `db:getPrompts` (src/main/ipc/db.ts)
- `db:getTimeStats` (src/main/ipc/db.ts)
- `db:getTokenStats` (src/main/ipc/db.ts)
- `db:searchChats` (src/main/ipc/db.ts)
- `db:updateChat` (src/main/ipc/db.ts)
- `db:updateFolder` (src/main/ipc/db.ts)
- `db:updateMessage` (src/main/ipc/db.ts)
- `db:updateProject` (src/main/ipc/db.ts)
- `db:updatePrompt` (src/main/ipc/db.ts)

## dialog

Count: 2

- `dialog:saveFile` (src/main/ipc/dialog.ts)
- `dialog:selectDirectory` (src/main/ipc/dialog.ts)

## diff

Count: 8

- `diff:cleanup` (src/main/ipc/file-diff.ts)
- `diff:getChangesBySystem` (src/main/ipc/file-diff.ts)
- `diff:getDiffById` (src/main/ipc/file-diff.ts)
- `diff:getFileHistory` (src/main/ipc/file-diff.ts)
- `diff:getRecentChanges` (src/main/ipc/file-diff.ts)
- `diff:getSessionChanges` (src/main/ipc/file-diff.ts)
- `diff:getStats` (src/main/ipc/file-diff.ts)
- `diff:revertChange` (src/main/ipc/file-diff.ts)

## export

Count: 2

- `export:markdown` (src/main/ipc/export.ts)
- `export:pdf` (src/main/ipc/export.ts)

## extension

Count: 4

- `extension:dismissWarning` (src/main/ipc/extension.ts)
- `extension:getStatus` (src/main/ipc/extension.ts)
- `extension:setInstalled` (src/main/ipc/extension.ts)
- `extension:shouldShowWarning` (src/main/ipc/extension.ts)

## files

Count: 11

- `files:createDirectory` (src/main/ipc/files.ts)
- `files:deleteDirectory` (src/main/ipc/files.ts)
- `files:deleteFile` (src/main/ipc/files.ts)
- `files:listDirectory` (src/main/ipc/files.ts)
- `files:readFile` (src/main/ipc/files.ts)
- `files:readImage` (src/main/ipc/files.ts)
- `files:renamePath` (src/main/ipc/files.ts)
- `files:searchFiles` (src/main/ipc/files.ts)
- `files:searchFilesStream` (src/main/ipc/files.ts)
- `files:selectDirectory` (src/main/ipc/files.ts)
- `files:writeFile` (src/main/ipc/files.ts)

## gallery

Count: 4

- `gallery:delete` (src/main/ipc/gallery.ts)
- `gallery:list` (src/main/ipc/gallery.ts)
- `gallery:open` (src/main/ipc/gallery.ts)
- `gallery:reveal` (src/main/ipc/gallery.ts)

## git

Count: 18

- `git:checkout` (src/main/ipc/git.ts)
- `git:commit` (src/main/ipc/git.ts)
- `git:getCommitDiff` (src/main/ipc/git.ts)
- `git:getCommitStats` (src/main/ipc/git.ts)
- `git:getDetailedStatus` (src/main/ipc/git.ts)
- `git:getDiffStats` (src/main/ipc/git.ts)
- `git:getFileDiff` (src/main/ipc/git.ts)
- `git:getLastCommit` (src/main/ipc/git.ts)
- `git:getRecentCommits` (src/main/ipc/git.ts)
- `git:getRemotes` (src/main/ipc/git.ts)
- `git:getTrackingInfo` (src/main/ipc/git.ts)
- `git:getTreeStatus` (src/main/ipc/git.ts)
- `git:getUnifiedDiff` (src/main/ipc/git.ts)
- `git:isRepository` (src/main/ipc/git.ts)
- `git:pull` (src/main/ipc/git.ts)
- `git:push` (src/main/ipc/git.ts)
- `git:stageFile` (src/main/ipc/git.ts)
- `git:unstageFile` (src/main/ipc/git.ts)

## health

Count: 4

- `health:check` (src/main/ipc/health.ts)
- `health:getService` (src/main/ipc/health.ts)
- `health:listServices` (src/main/ipc/health.ts)
- `health:status` (src/main/ipc/health.ts)

## hf

Count: 4

- `hf:cancel-download` (src/main/ipc/huggingface.ts)
- `hf:download-file` (src/main/ipc/huggingface.ts)
- `hf:get-files` (src/main/ipc/huggingface.ts)
- `hf:search-models` (src/main/ipc/huggingface.ts)

## ideas

Count: 28

- `ideas:approveIdea` (src/main/ipc/idea-generator.ts)
- `ideas:archiveIdea` (src/main/ipc/idea-generator.ts)
- `ideas:cancelSession` (src/main/ipc/idea-generator.ts)
- `ideas:canGenerateLogo` (src/main/ipc/idea-generator.ts)
- `ideas:clearResearchCache` (src/main/ipc/idea-generator.ts)
- `ideas:compareIdeas` (src/main/ipc/idea-generator.ts)
- `ideas:createSession` (src/main/ipc/idea-generator.ts)
- `ideas:deepResearch` (src/main/ipc/idea-generator.ts)
- `ideas:deleteIdea` (src/main/ipc/idea-generator.ts)
- `ideas:deleteSession` (src/main/ipc/idea-generator.ts)
- `ideas:enrichIdea` (src/main/ipc/idea-generator.ts)
- `ideas:generateLogo` (src/main/ipc/idea-generator.ts)
- `ideas:generateMarketPreview` (src/main/ipc/idea-generator.ts)
- `ideas:getArchivedIdeas` (src/main/ipc/idea-generator.ts)
- `ideas:getIdea` (src/main/ipc/idea-generator.ts)
- `ideas:getIdeas` (src/main/ipc/idea-generator.ts)
- `ideas:getSession` (src/main/ipc/idea-generator.ts)
- `ideas:getSessions` (src/main/ipc/idea-generator.ts)
- `ideas:queryResearch` (src/main/ipc/idea-generator.ts)
- `ideas:quickScore` (src/main/ipc/idea-generator.ts)
- `ideas:rankIdeas` (src/main/ipc/idea-generator.ts)
- `ideas:regenerateIdea` (src/main/ipc/idea-generator.ts)
- `ideas:rejectIdea` (src/main/ipc/idea-generator.ts)
- `ideas:restoreIdea` (src/main/ipc/idea-generator.ts)
- `ideas:scoreIdea` (src/main/ipc/idea-generator.ts)
- `ideas:startGeneration` (src/main/ipc/idea-generator.ts)
- `ideas:startResearch` (src/main/ipc/idea-generator.ts)
- `ideas:validateIdea` (src/main/ipc/idea-generator.ts)

## key-rotation

Count: 4

- `key-rotation:getCurrentKey` (src/main/ipc/key-rotation.ts)
- `key-rotation:getStatus` (src/main/ipc/key-rotation.ts)
- `key-rotation:initialize` (src/main/ipc/key-rotation.ts)
- `key-rotation:rotate` (src/main/ipc/key-rotation.ts)

## llama

Count: 11

- `llama:chat` (src/main/ipc/llama.ts)
- `llama:deleteModel` (src/main/ipc/llama.ts)
- `llama:downloadModel` (src/main/ipc/llama.ts)
- `llama:getConfig` (src/main/ipc/llama.ts)
- `llama:getGpuInfo` (src/main/ipc/llama.ts)
- `llama:getModels` (src/main/ipc/llama.ts)
- `llama:getModelsDir` (src/main/ipc/llama.ts)
- `llama:loadModel` (src/main/ipc/llama.ts)
- `llama:resetSession` (src/main/ipc/llama.ts)
- `llama:setConfig` (src/main/ipc/llama.ts)
- `llama:unloadModel` (src/main/ipc/llama.ts)

## llm

Count: 1

- `llm:compare-models` (src/main/ipc/multi-model.ts)

## log

Count: 4

- `log:buffer:clear` (src/main/ipc/logging.ts)
- `log:buffer:get` (src/main/ipc/logging.ts)
- `log:stream:start` (src/main/ipc/logging.ts)
- `log:stream:stop` (src/main/ipc/logging.ts)

## marketplace

Count: 5

- `marketplace:getModelDetails` (src/main/ipc/marketplace.ts)
- `marketplace:getModels` (src/main/ipc/marketplace.ts)
- `marketplace:getStatus` (src/main/ipc/marketplace.ts)
- `marketplace:refresh` (src/main/ipc/marketplace.ts)
- `marketplace:searchModels` (src/main/ipc/marketplace.ts)

## mcp

Count: 14

- `mcp:dispatch` (src/main/ipc/mcp.ts)
- `mcp:install` (src/main/ipc/mcp.ts)
- `mcp:list` (src/main/ipc/mcp.ts)
- `mcp:marketplace:categories` (src/main/ipc/mcp-marketplace.ts)
- `mcp:marketplace:filter` (src/main/ipc/mcp-marketplace.ts)
- `mcp:marketplace:install` (src/main/ipc/mcp-marketplace.ts)
- `mcp:marketplace:installed` (src/main/ipc/mcp-marketplace.ts)
- `mcp:marketplace:list` (src/main/ipc/mcp-marketplace.ts)
- `mcp:marketplace:refresh` (src/main/ipc/mcp-marketplace.ts)
- `mcp:marketplace:search` (src/main/ipc/mcp-marketplace.ts)
- `mcp:marketplace:toggle` (src/main/ipc/mcp-marketplace.ts)
- `mcp:marketplace:uninstall` (src/main/ipc/mcp-marketplace.ts)
- `mcp:toggle` (src/main/ipc/mcp.ts)
- `mcp:uninstall` (src/main/ipc/mcp.ts)

## memory

Count: 6

- `memory:addFact` (src/main/ipc/memory.ts)
- `memory:deleteEntity` (src/main/ipc/memory.ts)
- `memory:deleteFact` (src/main/ipc/memory.ts)
- `memory:getAll` (src/main/ipc/memory.ts)
- `memory:search` (src/main/ipc/memory.ts)
- `memory:setEntityFact` (src/main/ipc/memory.ts)

## metrics

Count: 3

- `metrics:get-provider-stats` (src/main/ipc/metrics.ts)
- `metrics:get-summary` (src/main/ipc/metrics.ts)
- `metrics:reset` (src/main/ipc/metrics.ts)

## migration

Count: 1

- `migration:status` (src/main/ipc/migration.ts)

## model-registry

Count: 3

- `model-registry:getAllModels` (src/main/ipc/model-registry.ts)
- `model-registry:getInstalledModels` (src/main/ipc/model-registry.ts)
- `model-registry:getRemoteModels` (src/main/ipc/model-registry.ts)

## ollama

Count: 27

- `ollama:abortPull` (src/main/ipc/ollama.ts)
- `ollama:chat` (src/main/ipc/ollama.ts)
- `ollama:chatStream` (src/main/ipc/ollama.ts)
- `ollama:checkAllModelsHealth` (src/main/ipc/ollama.ts)
- `ollama:checkCuda` (src/main/ipc/ollama.ts)
- `ollama:checkModelHealth` (src/main/ipc/ollama.ts)
- `ollama:clearScraperCache` (src/main/ipc/ollama.ts)
- `ollama:forceHealthCheck` (src/main/ipc/ollama.ts)
- `ollama:getConnectionStatus` (src/main/ipc/ollama.ts)
- `ollama:getGPUAlertThresholds` (src/main/ipc/ollama.ts)
- `ollama:getGPUInfo` (src/main/ipc/ollama.ts)
- `ollama:getLibraryModels` (src/main/ipc/ollama.ts)
- `ollama:getModelRecommendations` (src/main/ipc/ollama.ts)
- `ollama:getModels` (src/main/ipc/ollama.ts)
- `ollama:getRecommendedModelForTask` (src/main/ipc/ollama.ts)
- `ollama:healthStatus` (src/main/ipc/ollama.ts)
- `ollama:isRunning` (src/main/ipc/ollama.ts)
- `ollama:pull` (src/main/ipc/ollama.ts)
- `ollama:reconnect` (src/main/ipc/ollama.ts)
- `ollama:scrapeLibrary` (src/main/ipc/ollama.ts)
- `ollama:scrapeModelDetails` (src/main/ipc/ollama.ts)
- `ollama:setGPUAlertThresholds` (src/main/ipc/ollama.ts)
- `ollama:start` (src/main/ipc/ollama.ts)
- `ollama:startGPUMonitoring` (src/main/ipc/ollama.ts)
- `ollama:stopGPUMonitoring` (src/main/ipc/ollama.ts)
- `ollama:tags` (src/main/ipc/ollama.ts)
- `ollama:testConnection` (src/main/ipc/ollama.ts)

## orchestrator

Count: 4

- `orchestrator:approve` (src/main/ipc/orchestrator.ts)
- `orchestrator:get-state` (src/main/ipc/orchestrator.ts)
- `orchestrator:start` (src/main/ipc/orchestrator.ts)
- `orchestrator:stop` (src/main/ipc/orchestrator.ts)

## performance

Count: 3

- `performance:detect-leak` (src/main/ipc/performance.ts)
- `performance:get-memory-stats` (src/main/ipc/performance.ts)
- `performance:trigger-gc` (src/main/ipc/performance.ts)

## process

Count: 6

- `process:kill` (src/main/ipc/process.ts)
- `process:list` (src/main/ipc/process.ts)
- `process:resize` (src/main/ipc/process.ts)
- `process:scan-scripts` (src/main/ipc/process.ts)
- `process:spawn` (src/main/ipc/process.ts)
- `process:write` (src/main/ipc/process.ts)

## project

Count: 55

- `project:add-step-comment` (src/main/ipc/project-agent.ts)
- `project:analyze` (src/main/ipc/project.ts)
- `project:analyzeDirectory` (src/main/ipc/project.ts)
- `project:analyzeIdentity` (src/main/ipc/project.ts)
- `project:apply-template` (src/main/ipc/project-agent.ts)
- `project:applyLogo` (src/main/ipc/project.ts)
- `project:approve` (src/main/ipc/project-agent.ts)
- `project:approve-step` (src/main/ipc/project-agent.ts)
- `project:build-consensus` (src/main/ipc/project-agent.ts)
- `project:create-pr` (src/main/ipc/project-agent.ts)
- `project:create-voting-session` (src/main/ipc/project-agent.ts)
- `project:delete-canvas-edge` (src/main/ipc/project-agent.ts)
- `project:delete-canvas-node` (src/main/ipc/project-agent.ts)
- `project:delete-profile` (src/main/ipc/project-agent.ts)
- `project:delete-task-by-node` (src/main/ipc/project-agent.ts)
- `project:delete-template` (src/main/ipc/project-agent.ts)
- `project:edit-step` (src/main/ipc/project-agent.ts)
- `project:export-template` (src/main/ipc/project-agent.ts)
- `project:generateLogo` (src/main/ipc/project.ts)
- `project:get-canvas-edges` (src/main/ipc/project-agent.ts)
- `project:get-canvas-nodes` (src/main/ipc/project-agent.ts)
- `project:get-checkpoints` (src/main/ipc/project-agent.ts)
- `project:get-plan-versions` (src/main/ipc/project-agent.ts)
- `project:get-profiles` (src/main/ipc/project-agent.ts)
- `project:get-routing-rules` (src/main/ipc/project-agent.ts)
- `project:get-status` (src/main/ipc/project-agent.ts)
- `project:get-task-history` (src/main/ipc/project-agent.ts)
- `project:get-template` (src/main/ipc/project-agent.ts)
- `project:get-templates` (src/main/ipc/project-agent.ts)
- `project:get-voting-session` (src/main/ipc/project-agent.ts)
- `project:getCompletion` (src/main/ipc/project.ts)
- `project:getEnv` (src/main/ipc/project.ts)
- `project:import-template` (src/main/ipc/project-agent.ts)
- `project:improveLogoPrompt` (src/main/ipc/project.ts)
- `project:insert-intervention` (src/main/ipc/project-agent.ts)
- `project:plan` (src/main/ipc/project-agent.ts)
- `project:register-profile` (src/main/ipc/project-agent.ts)
- `project:request-votes` (src/main/ipc/project-agent.ts)
- `project:reset-state` (src/main/ipc/project-agent.ts)
- `project:resolve-voting` (src/main/ipc/project-agent.ts)
- `project:resume-checkpoint` (src/main/ipc/project-agent.ts)
- `project:retry-step` (src/main/ipc/project-agent.ts)
- `project:rollback-checkpoint` (src/main/ipc/project-agent.ts)
- `project:save-canvas-edges` (src/main/ipc/project-agent.ts)
- `project:save-canvas-nodes` (src/main/ipc/project-agent.ts)
- `project:save-template` (src/main/ipc/project-agent.ts)
- `project:saveEnv` (src/main/ipc/project.ts)
- `project:set-routing-rules` (src/main/ipc/project-agent.ts)
- `project:skip-step` (src/main/ipc/project-agent.ts)
- `project:start` (src/main/ipc/project-agent.ts)
- `project:stop` (src/main/ipc/project-agent.ts)
- `project:submit-vote` (src/main/ipc/project-agent.ts)
- `project:unwatch` (src/main/ipc/project.ts)
- `project:uploadLogo` (src/main/ipc/project.ts)
- `project:watch` (src/main/ipc/project.ts)

## prompt-templates

Count: 11

- `prompt-templates:create` (src/main/ipc/prompt-templates.ts)
- `prompt-templates:delete` (src/main/ipc/prompt-templates.ts)
- `prompt-templates:get` (src/main/ipc/prompt-templates.ts)
- `prompt-templates:getAll` (src/main/ipc/prompt-templates.ts)
- `prompt-templates:getByCategory` (src/main/ipc/prompt-templates.ts)
- `prompt-templates:getByTag` (src/main/ipc/prompt-templates.ts)
- `prompt-templates:getCategories` (src/main/ipc/prompt-templates.ts)
- `prompt-templates:getTags` (src/main/ipc/prompt-templates.ts)
- `prompt-templates:render` (src/main/ipc/prompt-templates.ts)
- `prompt-templates:search` (src/main/ipc/prompt-templates.ts)
- `prompt-templates:update` (src/main/ipc/prompt-templates.ts)

## proxy

Count: 16

- `proxy:anthropicLogin` (src/main/ipc/proxy.ts)
- `proxy:antigravityLogin` (src/main/ipc/proxy.ts)
- `proxy:claudeLogin` (src/main/ipc/proxy.ts)
- `proxy:codexLogin` (src/main/ipc/proxy.ts)
- `proxy:deleteAuthFile` (src/main/ipc/proxy.ts)
- `proxy:downloadAuthFile` (src/main/ipc/proxy.ts)
- `proxy:embed:start` (src/main/ipc/proxy-embed.ts)
- `proxy:embed:status` (src/main/ipc/proxy-embed.ts)
- `proxy:embed:stop` (src/main/ipc/proxy-embed.ts)
- `proxy:getClaudeQuota` (src/main/ipc/proxy.ts)
- `proxy:getCodexUsage` (src/main/ipc/proxy.ts)
- `proxy:getCopilotQuota` (src/main/ipc/proxy.ts)
- `proxy:getModels` (src/main/ipc/proxy.ts)
- `proxy:getQuota` (src/main/ipc/proxy.ts)
- `proxy:saveClaudeSession` (src/main/ipc/proxy.ts)
- `proxy:syncAuthFiles` (src/main/ipc/proxy.ts)

## screenshot

Count: 1

- `screenshot:capture` (src/main/ipc/screenshot.ts)

## sd-cpp

Count: 2

- `sd-cpp:getStatus` (src/main/ipc/sd-cpp.ts)
- `sd-cpp:reinstall` (src/main/ipc/sd-cpp.ts)

## settings

Count: 2

- `settings:get` (src/main/ipc/settings.ts)
- `settings:save` (src/main/ipc/settings.ts)

## shell

Count: 3

- `shell:openExternal` (src/main/ipc/window.ts)
- `shell:openTerminal` (src/main/ipc/window.ts)
- `shell:runCommand` (src/main/ipc/window.ts)

## ssh

Count: 23

- `ssh:connect` (src/main/ipc/ssh.ts)
- `ssh:deleteDir` (src/main/ipc/ssh.ts)
- `ssh:deleteFile` (src/main/ipc/ssh.ts)
- `ssh:deleteProfile` (src/main/ipc/ssh.ts)
- `ssh:disconnect` (src/main/ipc/ssh.ts)
- `ssh:download` (src/main/ipc/ssh.ts)
- `ssh:execute` (src/main/ipc/ssh.ts)
- `ssh:getConnections` (src/main/ipc/ssh.ts)
- `ssh:getInstalledPackages` (src/main/ipc/ssh.ts)
- `ssh:getLogFiles` (src/main/ipc/ssh.ts)
- `ssh:getProfiles` (src/main/ipc/ssh.ts)
- `ssh:getSystemStats` (src/main/ipc/ssh.ts)
- `ssh:isConnected` (src/main/ipc/ssh.ts)
- `ssh:listDir` (src/main/ipc/ssh.ts)
- `ssh:mkdir` (src/main/ipc/ssh.ts)
- `ssh:readFile` (src/main/ipc/ssh.ts)
- `ssh:readLogFile` (src/main/ipc/ssh.ts)
- `ssh:rename` (src/main/ipc/ssh.ts)
- `ssh:saveProfile` (src/main/ipc/ssh.ts)
- `ssh:shellStart` (src/main/ipc/ssh.ts)
- `ssh:shellWrite` (src/main/ipc/ssh.ts)
- `ssh:upload` (src/main/ipc/ssh.ts)
- `ssh:writeFile` (src/main/ipc/ssh.ts)

## terminal

Count: 20

- `terminal:clearCommandHistory` (src/main/ipc/terminal.ts)
- `terminal:close` (src/main/ipc/terminal.ts)
- `terminal:create` (src/main/ipc/terminal.ts)
- `terminal:deleteProfile` (src/main/ipc/terminal.ts)
- `terminal:explainCommand` (src/main/ipc/terminal.ts)
- `terminal:explainError` (src/main/ipc/terminal.ts)
- `terminal:fixError` (src/main/ipc/terminal.ts)
- `terminal:getBackends` (src/main/ipc/terminal.ts)
- `terminal:getCommandHistory` (src/main/ipc/terminal.ts)
- `terminal:getDockerContainers` (src/main/ipc/terminal.ts)
- `terminal:getProfiles` (src/main/ipc/terminal.ts)
- `terminal:getSessions` (src/main/ipc/terminal.ts)
- `terminal:getShells` (src/main/ipc/terminal.ts)
- `terminal:getSuggestions` (src/main/ipc/terminal.ts)
- `terminal:isAvailable` (src/main/ipc/terminal.ts)
- `terminal:kill` (src/main/ipc/terminal.ts)
- `terminal:readBuffer` (src/main/ipc/terminal.ts)
- `terminal:resize` (src/main/ipc/terminal.ts)
- `terminal:saveProfile` (src/main/ipc/terminal.ts)
- `terminal:write` (src/main/ipc/terminal.ts)

## theme

Count: 24

- `theme:addCustom` (src/main/ipc/theme.ts)
- `theme:applyPreset` (src/main/ipc/theme.ts)
- `theme:clearHistory` (src/main/ipc/theme.ts)
- `theme:clearPreset` (src/main/ipc/theme.ts)
- `theme:deleteCustom` (src/main/ipc/theme.ts)
- `theme:duplicate` (src/main/ipc/theme.ts)
- `theme:export` (src/main/ipc/theme.ts)
- `theme:getAll` (src/main/ipc/theme.ts)
- `theme:getCurrent` (src/main/ipc/theme.ts)
- `theme:getCurrentPreset` (src/main/ipc/theme.ts)
- `theme:getCustom` (src/main/ipc/theme.ts)
- `theme:getDetails` (src/main/ipc/theme.ts)
- `theme:getFavorites` (src/main/ipc/theme.ts)
- `theme:getHistory` (src/main/ipc/theme.ts)
- `theme:getPresets` (src/main/ipc/theme.ts)
- `theme:import` (src/main/ipc/theme.ts)
- `theme:isFavorite` (src/main/ipc/theme.ts)
- `theme:runtime:getAll` (src/main/ipc/theme.ts)
- `theme:runtime:install` (src/main/ipc/theme.ts)
- `theme:runtime:openDirectory` (src/main/ipc/theme.ts)
- `theme:runtime:uninstall` (src/main/ipc/theme.ts)
- `theme:set` (src/main/ipc/theme.ts)
- `theme:toggleFavorite` (src/main/ipc/theme.ts)
- `theme:updateCustom` (src/main/ipc/theme.ts)

## token-estimation

Count: 5

- `token-estimation:estimateMessage` (src/main/ipc/token-estimation.ts)
- `token-estimation:estimateMessages` (src/main/ipc/token-estimation.ts)
- `token-estimation:estimateString` (src/main/ipc/token-estimation.ts)
- `token-estimation:fitsInContextWindow` (src/main/ipc/token-estimation.ts)
- `token-estimation:getContextWindowSize` (src/main/ipc/token-estimation.ts)

## tools

Count: 3

- `tools:execute` (src/main/ipc/tools.ts)
- `tools:getDefinitions` (src/main/ipc/tools.ts)
- `tools:kill` (src/main/ipc/tools.ts)

## usage

Count: 3

- `usage:checkLimit` (src/main/ipc/usage.ts)
- `usage:getUsageCount` (src/main/ipc/usage.ts)
- `usage:recordUsage` (src/main/ipc/usage.ts)

## window

Count: 2

- `window:captureCookies` (src/main/ipc/window.ts)
- `window:openDetachedTerminal` (src/main/ipc/window.ts)


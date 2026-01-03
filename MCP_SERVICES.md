# MCP Service Catalog

The following services under `src/main/services` are tracked as MCP-capable components. They are grouped by status to clarify which can be instantiated (creatable) and which should be upgraded/extended (advancable/upgradable).

## Creatable MCPs (ready to wrap)

- `anthropic.service.ts`
- `clipboard.service.ts`
- `command.service.ts`
- `content.service.ts`
- `database.service.ts`
- `docker.service.ts`
- `embedding.service.ts`
- `file.service.ts` (FileManagementService)
- `filesystem.service.ts`
- `gemini.service.ts`
- `git.service.ts`
- `groq.service.ts`
- `llama.service.ts`
- `monitoring.service.ts`
- `network.service.ts`
- `notification.service.ts`
- `ollama.service.ts`
- `openai.service.ts`
- `scanner.service.ts`
- `screenshot.service.ts`
- `security.service.ts`
- `settings.service.ts`
- `ssh.service.ts`
- `system.service.ts`
- `utility.service.ts`
- `web.service.ts`

Implemented MCP wrappers (see `src/main/mcp/registry.ts`) for: `web`, `utility`, `system`, `ssh`, `screenshot`, `scanner`, `notification`, `network`, `monitoring`, `git`, `filesystem`, `file`, `embedding`, `docker`, `database`, `content`, `command`, `clipboard`.

## Advancable/Upgradable MCPs (need enhancements before wrapping)

- `auth.service.ts` (device flow security and token storage hardening)
- `copilot.service.ts` (tool loop safeguards and quota awareness)
- `proxy.service.ts` (binary verification and secret management)

## Notes

- Each creatable service already exposes a clear contract and can be wrapped in an MCP shim without major refactors.
- Advancable services need security/usability improvements first; once hardened, wrap them as MCP endpoints.

## IPC Bridge

- `mcp:list` → lists available services/actions (wired in `src/main/main.ts`).
- `mcp:dispatch` → invoke a service action with args.
- Preload bindings exposed at `window.electron.mcp.list/dispatch` (see `src/main/preload.ts`, `src/renderer/electron.d.ts`).

# Supported External Applications (MCP)

Here is a list of 30 applications ready for immediate implementation via the Model Context Protocol.

## 🛠️ Developer Tools & DevOps (10)

1. **GitHub** - `@modelcontextprotocol/server-github` (Repos, Issues, PRs)
2. **GitLab** - `@modelcontextprotocol/server-gitlab` (CI/CD, Source Control)
3. **Docker** - `@modelcontextprotocol/server-docker` (Container Management)
4. **Kubernetes** - `@modelcontextprotocol/server-kubernetes` (Cluster Ops)
5. **Sentry** - `@modelcontextprotocol/server-sentry` (Error Tracking)
6. **Cloudflare** - `@modelcontextprotocol/server-cloudflare` (Workers, DNS)
7. **AWS** - Community AWS MCP (EC2, S3 Management)
8. **Postman** - VIA API/OpenAPI MCP (API Testing)
9. **Linear** - `@modelcontextprotocol/server-linear` (Issue Tracking)
10. **Jira** - `@modelcontextprotocol/server-jira` (Project Management)

## 🎨 Design & Media (3)

11. **Figma** - `@modelcontextprotocol/server-figma` (Design Inspection, Comments)
2. **Linear** (Design Tasks) - see above
3. **Brave Search** - `@modelcontextprotocol/server-brave-search` (Web Search)

## 🗄️ Databases & Data (7)

14. **PostgreSQL** - `@modelcontextprotocol/server-postgres` (SQL Queries, Schema)
2. **SQLite** - `@modelcontextprotocol/server-sqlite` (Local DB)
3. **MySQL** - `@modelcontextprotocol/server-mysql` (Relational DB)
4. **MongoDB** - Community MongoDB MCP (NoSQL)
5. **Redis** - Community Redis MCP (Cache/Key-Value)
6. **Snowflake** - `@modelcontextprotocol/server-snowflake` (Data Warehousing)
7. **Elasticsearch** - Community Elastic MCP (Search & Analytics)

## ⚡ Productivity & Communication (7)

21. **Slack** - `@modelcontextprotocol/server-slack` (Messaging, Channels)
2. **Discord** - Community Discord MCP (Server Mgmt, Messages)
3. **Notion** - `@modelcontextprotocol/server-notion` (Notes, Databases)
4. **Obsidian** - Local Markdown MCP (Personal Knowledge Base)
5. **Google Drive** - `@modelcontextprotocol/server-google-drive` (File Access)
6. **Google Calendar** - `@modelcontextprotocol/server-google-calendar` (Events)
7. **Gmail** - `@modelcontextprotocol/server-gmail` (Email Drafts/Reading)

## 🌐 Web & Utilities (3)

28. **Puppeteer/Browser** - `@modelcontextprotocol/server-puppeteer` (Automation/Scraping)
2. **Code Interpreter** - `@modelcontextprotocol/server-python` (Sandboxed Execution)
3. **Google Maps** - `@modelcontextprotocol/server-google-maps` (Location Services)

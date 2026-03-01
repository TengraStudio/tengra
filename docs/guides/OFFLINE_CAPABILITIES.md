# Offline Capabilities Guide

Tengra is designed to work fully offline with local LLMs and an embedded database.
Cloud features degrade gracefully when no network is available.

## Feature Matrix

| Feature | Offline | Online | Notes |
|---------|:-------:|:------:|-------|
| **Local LLM (Ollama)** | ✅ | — | Runs entirely on device |
| **Local LLM (Llama.cpp)** | ✅ | — | Native binary inference |
| **Cloud LLM (OpenAI)** | — | ✅ | Requires API key + internet |
| **Cloud LLM (Anthropic)** | — | ✅ | Requires API key + internet |
| **Cloud LLM (Groq)** | — | ✅ | Requires API key + internet |
| **Proxy/Copilot relay** | — | ✅ | Relays to cloud providers |
| **Database (PGlite)** | ✅ | — | Embedded, file-based PostgreSQL |
| **Chat history & data** | ✅ | — | Stored locally in PGlite |
| **Project management** | ✅ | — | Local file operations |
| **Git integration** | ✅ | ⚡ | Local ops offline; push/pull need network |
| **Terminal** | ✅ | — | Local shell access |
| **Settings & themes** | ✅ | — | Persisted locally |
| **Translations (i18n)** | ✅ | — | Bundled in app |
| **Deep Research** | — | ✅ | Requires web access |
| **HuggingFace downloads** | — | ✅ | Model fetching needs network |

## MCP Plugin Matrix

| MCP Server | Offline | Online | Notes |
|------------|:-------:|:------:|-------|
| `filesystem.server` | ✅ | — | Local file operations |
| `git.server` | ✅ | ⚡ | Local ops offline; remote ops need network |
| `data.server` | ✅ | — | PGlite database operations |
| `project.server` | ✅ | — | Project metadata |
| `core.server` | ✅ | — | Utilities, clipboard |
| `security.server` | ✅ | — | Local validation |
| `internet.server` | — | ✅ | Web fetching, Hacker News |
| `web.server` | — | ✅ | Web search, page reading |
| `cloud-storage.server` | — | ✅ | S3, GCS, Azure Blob, R2 |
| `cicd.server` | — | ✅ | GitHub Actions, releases |

## Recommended Offline Setup

1. **Install Ollama** and download models while online (`ollama pull llama3`)
2. All chat history, projects, and settings are stored locally in PGlite
3. Use filesystem, git, and project MCP plugins — they work fully offline
4. Cloud LLM tabs will show unavailable status; switch to a local model

## Network Detection

The health check service monitors connectivity. When offline:

- Cloud provider status indicators show disconnected
- Local services (Ollama, PGlite) continue operating normally
- Network diagnostic tools (ping, traceroute) remain available for local targets

> **Key takeaway**: Tengra with Ollama + PGlite provides a complete AI assistant
> experience with zero network dependency.

# Configuration Guide

This document describes all environment variables and configuration options for Tandem.

## Environment Variables

### OAuth & Authentication

#### Antigravity
Main cloud provider for AI model access and orchestration.

- `ANTIGRAVITY_CLIENT_ID` - OAuth client ID for Antigravity API
- `ANTIGRAVITY_CLIENT_SECRET` - OAuth client secret for Antigravity API
- `ANTIGRAVITY_SDK_CLIENT_ID` - SDK-specific client ID
- `ANTIGRAVITY_SDK_CLIENT_SECRET` - SDK-specific client secret

**Required for**: Cloud AI model access, provider rotation, quota management

#### Google Gemini
Google's AI model (Gemini Pro, etc.)

- `GEMINI_OAUTH_CLIENT_ID` - OAuth 2.0 client ID for Gemini API
- `GEMINI_OAUTH_CLIENT_SECRET` - OAuth 2.0 client secret
- `GEMINI_CLI_CLIENT_ID` - CLI-specific client ID
- `GEMINI_CLI_CLIENT_SECRET` - CLI-specific client secret

**Required for**: Gemini model access via OAuth

#### OpenAI
ChatGPT and GPT-4 model access.

- `OPENAI_OAUTH_CLIENT_ID` - OAuth client ID for OpenAI API

**Required for**: GPT-4, ChatGPT model access

#### Anthropic
Claude model access.

- `ANTHROPIC_OAUTH_CLIENT_ID` - OAuth client ID for Claude API

**Required for**: Claude 3.5, Claude Opus model access

#### Other Providers

- `QWEN_CLIENT_ID` - Alibaba Cloud Qwen (Chinese LLM) client ID
- `IFLOW_CLIENT_ID` - iFlow workflow automation client ID
- `IFLOW_CLIENT_SECRET` - iFlow workflow automation client secret

### External Services

#### Tavily API
Web search and research capabilities.

- `TAVILY_API_KEY` - API key for Tavily search service

**Required for**: Deep research, web search tools, fact-checking

## Configuration Precedence

Tandem uses the following configuration precedence (highest to lowest):

1. **Runtime cache** - `ConfigService.setConfig()` (highest priority)
2. **Environment variables** - `process.env.*`
3. **Settings file** - `settings.json` via SettingsService
4. **Default values** - Provided in `ConfigService.get()` calls

### Example

```typescript
// Priority example
ConfigService.setConfig('apiKey', 'runtime-key');     // Priority 1 (used)
process.env.API_KEY = 'env-key';                      // Priority 2
settingsService.set('apiKey', 'settings-key');        // Priority 3
ConfigService.get('apiKey', 'default-key');           // Priority 4

// Result: 'runtime-key'
```

## Settings File

Location: `~/.tandem/settings.json` (user data directory)

### Structure

```json
{
  "general": {
    "language": "en",
    "defaultModel": "gpt-4",
    "lastProvider": "openai",
    "theme": "dark-default"
  },
  "providers": {
    "openai": {
      "enabled": true,
      "apiKey": "encrypted-key"
    },
    "anthropic": {
      "enabled": true,
      "apiKey": "encrypted-key"
    }
  },
  "proxy": {
    "enabled": false,
    "host": "",
    "port": 0
  }
}
```

### Encryption

Sensitive values (API keys, tokens) are encrypted using `SecurityService.encryptSync()` before being written to `settings.json`.

## Database Configuration

Tandem uses SQLite for local data storage.

**Location**: `~/.tandem/data.db`

**Migrations**: Automatically applied on startup via `MigrationService`

### Tables

- `chats` - Chat conversations
- `messages` - Chat messages with embeddings
- `projects` - Project metadata
- `folders` - Organization folders
- `prompts` - Saved prompt templates
- `semantic_fragments` - Vector search knowledge base
- `entity_knowledge` - Structured entity knowledge
- `token_usage` - LLM token tracking
- `time_tracking` - Session time tracking

## API Server Configuration

REST API server for browser extension communication.

**Default Port**: `37240` (configurable)

**Endpoints**:
- `POST /api/tools/execute` - Execute tools
- `POST /api/chat/message` - Send chat messages
- `POST /api/chat/stream` - Stream chat responses

**Security**:
- CORS: Restricted origins (no wildcard)
- Request size limit: 2MB
- Rate limiting: Configurable via `RateLimitService`

## Logging Configuration

**Location**: `~/.tandem/logs/`

**Rotation**: Daily rotation, 7-day retention

**Levels**: `error`, `warn`, `info`, `debug`

**Usage**:
```typescript
import { appLogger } from '@main/logging/logger';

appLogger.info('ServiceName', 'Message');
appLogger.error('ServiceName', 'Error message', error);
```

## Development Configuration

### Debug Mode

Set `NODE_ENV=development` for:
- Extended logging
- Hot reload
- DevTools enabled
- Source maps

### Test Configuration

SQLite in-memory database for tests:
```typescript
const isTest = process.env.NODE_ENV === 'test';
```

## Security Notes

⚠️ **Never commit secrets to version control**

- Use `.env.example` as template
- Copy to `.env` and fill in values
- `.env` is in `.gitignore`
- Use environment variables in CI/CD
- Rotate credentials regularly

## Troubleshooting

### Missing Environment Variables

Tandem will start without environment variables but features requiring authentication will be disabled.

Check logs: `~/.tandem/logs/main.log`

### Database Migration Failures

1. Backup `~/.tandem/data.db`
2. Check migration logs
3. Manually roll back if needed (see `migrations.ts`)

### API Connection Issues

1. Check proxy settings
2. Verify OAuth credentials
3. Check rate limits in provider dashboards
4. Review CORS configuration for browser extension

## Additional Resources

- [README.md](../README.md) - Getting started guide
- [AI_RULES.md](AI_RULES.md) - Coding guidelines
- [API Documentation](API.md) - REST API reference (if exists)

# Model Fetching Architecture Documentation

Bu döküman, Orbit uygulamasının modelleri nasıl çektiğini, providerlara nasıl auth olduğunu ve API yollarını detaylı olarak açıklamaktadır.

---

## 1. ANTIGRAVITY (Google Cloud Code)

### Authentication

- **Yöntem**: Google OAuth 2.0 (Device/Browser Flow)
- **Client ID**: `1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com`
- **Client Secret**: `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`
- **Scopes**:
  - `https://www.googleapis.com/auth/cloud-platform`
  - `https://www.googleapis.com/auth/userinfo.email`
  - `https://www.googleapis.com/auth/userinfo.profile`
  - `https://www.googleapis.com/auth/cclog`
  - `https://www.googleapis.com/auth/experimentsandconfigs`
- **Redirect URI**: `http://localhost:51121/oauth-callback`
- **Auth URL**: `https://accounts.google.com/o/oauth2/v2/auth`
- **Token URL**: `https://oauth2.googleapis.com/token`

### Token Storage

- **Dosya Konumu**: `%APPDATA%/orbit-ai/cliproxy-auth-work/antigravity-{email}.json`
- **İçerik**: `{ access_token, refresh_token, expires_in, timestamp, email }`

### Model Fetching

- **Endpoint**: `https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels`
- **Method**: `POST` (empty body `{}`)
- **Headers**:
  - `Authorization: Bearer {access_token}`
  - `User-Agent: antigravity/1.104.0 darwin/arm64`
- **Response**: `{ models: { [modelId]: { displayName, quotaInfo } } }`

### Chat Endpoint

- **URL**: Cliproxy üzerinden yönlendirilir (`http://localhost:8317/v1/chat/completions`)
- **Cliproxy** backend olarak Google Cloud Code API'sine istek atar.

### Kod Referansları

- `src/main/services/proxy.service.ts` → `getAntigravityAuthUrl()`, `fetchAntigravityUpstream()`, `getAntigravityAvailableModels()`

---

## 2. GITHUB COPILOT

### Authentication

- **Yöntem**: GitHub OAuth Device Flow
- **Client ID (copilot)**: `01ab8ac9400c4e429b23`
- **Scope**: `read:user`
- **Device Code URL**: `https://github.com/login/device/code`
- **Access Token URL**: `https://github.com/login/oauth/access_token`

### Token Hierarchy

1. **GitHub Personal Access Token (PAT)**: Settings'de `github.token` veya `copilot.token` olarak saklanır.
2. **Copilot Session Token**: GitHub token ile `https://api.github.com/copilot_internal/v2/token` endpoint'inden alınır. 20 dakika geçerli.

### Token Storage

- **Settings Dosyası**: `%APPDATA%/orbit-ai/settings.json` → `copilot.token` veya `github.token`

### Model Fetching

- **Endpoint**: `{baseUrl}/models`
  - `baseUrl`:
    - Individual: `https://api.githubcopilot.com`
    - Business: `https://api.business.githubcopilot.com`
    - Enterprise: `https://api.enterprise.githubcopilot.com`
- **Headers**:
  - `Authorization: Bearer {copilotSessionToken}`
  - `Editor-Version: vscode/{version}`
  - `Editor-Plugin-Version: copilot/1.250.0`
  - `User-Agent: GithubCopilot/1.250.0`

### Chat Endpoint

- **URL**: `{baseUrl}/chat/completions`
- **Fallback Endpoints** (for Codex models):
  - `/responses`
  - `/v1/completions`
  - `/completions`

### Quota Fetching

- **Endpoint**: `https://api.github.com/copilot_internal/user`
- **Response**: `{ copilot_plan, quota_snapshots: { premium_interactions: { entitlement, remaining } } }`

### Kod Referansları

- `src/main/services/copilot.service.ts` → `ensureCopilotToken()`, `getModels()`, `chat()`, `streamChat()`
- `src/main/services/proxy.service.ts` → `requestGitHubDeviceCode()`, `pollForGitHubToken()`, `getCopilotQuota()`

---

## 3. CODEX (OpenAI via ChatGPT.com)

### Authentication

- **Yöntem**: Browser Cookie / Session Token
- **Session URL**: `https://chatgpt.com/api/auth/session`
- **Cookies Domain**: `chatgpt.com`

### Token Storage

- **Dosya Konumu**: `%APPDATA%/orbit-ai/cliproxy-auth-work/codex-{email}.json`
- **veya** Electron session cookies

### Usage Fetching

- **Endpoint**: `https://chatgpt.com/backend-api/wham/usage`
- **Fallback**: `https://chat.openai.com/backend-api/wham/usage`
- **Headers**: `Authorization: Bearer {accessToken}`
- **Response**: `{ rate_limit: { primary_window, secondary_window }, plan_type }`

### Chat Endpoint

- Codex modelleri Copilot üzerinden yönlendirilir (`copilotService.chat()`).
- Fallback olarak Cliproxy da kullanılabilir.

### Kod Referansları

- `src/main/services/proxy.service.ts` → `fetchCodexUsage()`, `getCodexUsage()`, `fetchCodexUsageFromWham()`

---

## 4. OPENAI (Direct API)

### Authentication

- **Yöntem**: API Key
- **Settings Path**: `settings.json` → `openai.apiKey`

### Model Fetching

- Modeller statik olarak `KNOWN_DEFINITIONS` içinde tanımlıdır.
- Alternatif: `https://api.openai.com/v1/models` (API key ile)

### Chat Endpoint

- **Default URL**: `https://api.openai.com/v1/chat/completions`
- **Custom**: Cliproxy üzerinden (`http://localhost:8317/v1/chat/completions`)

### Kod Referansları

- `src/main/services/llm.service.ts` → `openaiChat()`, `openaiStreamChat()`

---

## 5. ANTHROPIC

### Authentication

- **Yöntem**: API Key
- **Settings Path**: `settings.json` → `anthropic.apiKey`
- **Alternatif**: Cliproxy web-based auth → `proxy.service.ts` → `getAnthropicAuthUrl()`

### Model Fetching

- Modeller statik olarak `KNOWN_DEFINITIONS` içinde tanımlıdır.

### Chat Endpoint

- **Direct**: `https://api.anthropic.com/v1/messages`
- **Cliproxy**: `http://localhost:8317/v1/chat/completions` (OpenAI format'a çevrilir)

### Kod Referansları

- `src/main/services/llm.service.ts` → `anthropicChat()`

---

## 6. GEMINI (Google AI Studio)

### Authentication

- **Yöntem**: API Key
- **Settings Path**: `settings.json` → `gemini.apiKey`
- **Alternatif**: Cliproxy web-based auth → `proxy.service.ts` → `getGeminiAuthUrl()`

### Model Fetching

- Modeller statik olarak `KNOWN_DEFINITIONS` içinde tanımlıdır.

### Chat Endpoint

- **Direct**: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- **Cliproxy**: `http://localhost:8317/v1/chat/completions`

### Kod Referansları

- `src/main/services/llm.service.ts` → `geminiChat()`

---

## 7. CLIPROXY (Embedded Proxy)

### Binary

- **Path**: `external/cliproxyapi/cliproxy-embed.exe`
- **Config**: `%APPDATA%/orbit-ai/proxy-config.yaml`
- **Default Port**: `8317`

### API Key

- **Settings Path**: `settings.json` → `proxy.key`
- **Auto-Generated**: `proxy.service.ts` → `ensureProxyKey()`

### Main Endpoints

- `/v1/models` → Tüm modelleri listeler (Antigravity + Proxy)
- `/v1/chat/completions` → OpenAI format chat
- `/v1/quota` → Quota bilgisi
- `/v0/management/*` → Auth URL'leri

### Auth Store

- **Path**: `%APPDATA%/orbit-ai/cliproxy-auth-work/`
- **Files**: `antigravity-{email}.json`, `codex-{email}.json`, etc.

---

## Özet: Model Listeleme Akışı

```
ollama:getModels (IPC Handler)
    ├─→ localAIService.getAllModels()       → Ollama local models
    ├─→ proxyService.getModels()            → Cliproxy /v1/models + Antigravity upstream
    └─→ copilotService.getModels()          → GitHub Copilot /models

ModelSelector.tsx
    └─→ categorizeModel(id, providerHint)   → Provider ve label atama
```

## Özet: Chat Routing Akışı

```
App.tsx → window.electron.chatStream()
    ↓
chat.ts (IPC Handler)
    ├─ if provider === 'copilot' → copilotService.streamChat()
    ├─ if provider === 'ollama'  → Ollama local API
    └─ else                      → llmService.openaiStreamChat() via Cliproxy
```

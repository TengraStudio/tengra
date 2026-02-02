# REST API Documentation

Tandem exposes a REST API for browser extension integration. The API server runs on port `37240` by default.

## Base URL

```
http://localhost:37240
```

## Authentication

All endpoints require an API token passed via the `Authorization` header:

```http
Authorization: Bearer <token>
```

The token is generated at application startup and logged to the console.

## Rate Limiting

Default rate limits apply per client:
- **chat:stream**: Configurable via RateLimitService
- **tool:execute**: Configurable via RateLimitService

## CORS

CORS is enabled for specific origins (no wildcard). Browser extension origins must be configured.

## Request/Response Format

- **Content-Type**: `application/json`
- **Max Body Size**: 2MB
- **Error Format**:
  ```json
  {
    "success": false,
    "error": "Error message"
  }
  ```

---

## Endpoints

### GET /api/tools/list

List all available tools.

**Response**:
```json
{
  "success": true,
  "tools": [
    {
      "name": "web_search",
      "description": "Search the web using Tavily API",
      "parameters": {...}
    }
  ]
}
```

**Status Codes**:
- `200` - Success
- `500` - Internal error

---

### GET /api/models

List available AI models.

**Response**:
```json
{
  "success": true,
  "models": [
    {
      "id": "gpt-4",
      "name": "GPT-4",
      "provider": "openai",
      "contextWindow": 8192
    }
  ]
}
```

**Status Codes**:
- `200` - Success
- `500` - Internal error

---

### POST /api/tools/execute

Execute a tool with parameters.

**Request**:
```json
{
  "toolName": "web_search",
  "parameters": {
    "query": "latest AI news",
    "maxResults": 5
  }
}
```

**Response**:
```json
{
  "success": true,
  "result": {
    "results": [...]
  }
}
```

**Status Codes**:
- `200` - Success
- `400` - Invalid tool name or parameters
- `401` - Missing or invalid authorization
- `500` - Execution error

**Notes**:
- Tool name must be a valid registered tool
- Parameters must match tool schema
- Timeout: Configurable per tool

---

### POST /api/chat/message

Send a single chat message and receive a complete response.

**Request**:
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Explain quantum computing"
    }
  ],
  "model": "gpt-4",
  "provider": "openai"
}
```

**Response**:
```json
{
  "success": true,
  "response": {
    "role": "assistant",
    "content": "Quantum computing uses quantum mechanics principles..."
  },
  "usage": {
    "promptTokens": 10,
    "completionTokens": 150,
    "totalTokens": 160
  }
}
```

**Status Codes**:
- `200` - Success
- `400` - Invalid request format
- `401` - Missing or invalid authorization
- `429` - Rate limit exceeded
- `500` - LLM service error

**Notes**:
- Messages array must have at least one message
- Model and provider must be valid
- Response is complete (non-streaming)

---

### POST /api/chat/stream

Stream chat responses via Server-Sent Events (SSE).

**Request**:
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Write a poem about coding"
    }
  ],
  "model": "claude-3.5-sonnet",
  "provider": "anthropic",
  "tools": [
    {
      "name": "web_search",
      "description": "Search the web"
    }
  ]
}
```

**Response** (SSE stream):
```
data: {"type":"start","model":"claude-3.5-sonnet"}

data: {"type":"content","delta":"In"}

data: {"type":"content","delta":" the"}

data: {"type":"tool_use","toolName":"web_search","arguments":{...}}

data: {"type":"done","usage":{"totalTokens":200}}
```

**Event Types**:
- `start` - Stream started
- `content` - Text delta
- `tool_use` - Tool invocation
- `done` - Stream complete
- `error` - Error occurred

**Status Codes**:
- `200` - Stream started
- `400` - Invalid request
- `401` - Authentication failed
- `429` - Rate limit exceeded

**Notes**:
- Connection stays open until completion
- Client must handle reconnection
- Tools are optional
- No timeout on streaming responses

---

### POST /api/vision/analyze

Analyze an image using vision models.

**Request**:
```json
{
  "image": "data:image/png;base64,iVBOR...",
  "prompt": "What is in this image?",
  "model": "gpt-4-vision"
}
```

**Response**:
```json
{
  "success": true,
  "description": "The image shows a cat sitting on a keyboard..."
}
```

**Status Codes**:
- `200` - Success
- `400` - Invalid image format or missing model
- `401` - Authentication failed
- `500` - Vision service error

**Notes**:
- Image must be base64-encoded data URI
- Supported formats: PNG, JPEG, GIF, WebP
- Max image size: 20MB (after decoding)
- Vision models must support image input

---

## WebSocket API

### Connection

```javascript
const ws = new WebSocket('ws://localhost:37240');
```

### Messages

**Ping/Pong**:
```json
{
  "type": "ping"
}
// Response:
{
  "type": "pong"
}
```

**Stream Chat**:
```json
{
  "type": "chat",
  "data": {
    "messages": [...],
    "model": "gpt-4"
  }
}
// Response: Multiple messages with deltas
{
  "type": "delta",
  "content": "Hello"
}
```

---

## Error Handling

### Error Response Format

All errors follow this format:

```json
{
  "success": false,
  "error": "Detailed error message"
}
```

### Common Errors

| Code | Message | Resolution |
|------|---------|------------|
| 401 | Unauthorized | Check Authorization header |
| 400 | Invalid request | Validate request body format |
| 429 | Rate limit exceeded | Wait and retry with backoff |
| 500 | Internal server error | Check server logs |

### Rate Limit Headers

Rate limit responses include:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 5
X-RateLimit-Reset: 1640000000
```

---

## Security Considerations

⚠️ **Important Security Notes**:

1. **Local Access Only**: API server binds to `localhost` only
2. **Token Required**: All endpoints require valid bearer token
3. **CORS Restrictions**: Limited to configured origins
4. **Request Size Limits**: 2MB maximum to prevent DoS
5. **Rate Limiting**: Enforced on all endpoints
6. **No Persistence**: Tokens regenerated on restart

### Recommended Practices

- ✅ Regenerate tokens periodically
- ✅ Use HTTPS in production (via reverse proxy)
- ✅ Validate all inputs client-side
- ✅ Handle rate limits gracefully
- ✅ Implement exponential backoff
- ❌ Never expose API publicly
- ❌ Never hardcode tokens

---

## Usage Examples

### cURL

```bash
# List tools
curl -H "Authorization: Bearer <token>" \
     http://localhost:37240/api/tools/list

# Execute tool
curl -X POST \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"toolName":"web_search","parameters":{"query":"AI"}}' \
     http://localhost:37240/api/tools/execute

# Chat message
curl -X POST \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"Hello"}],"model":"gpt-4","provider":"openai"}' \
     http://localhost:37240/api/chat/message
```

### JavaScript (Browser Extension)

```javascript
async function callAPI(endpoint, data) {
  const token = await getApiToken(); // Implement token retrieval
  
  const response = await fetch(`http://localhost:37240${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }
  
  return response.json();
}

// Usage
const result = await callAPI('/api/tools/execute', {
  toolName: 'web_search',
  parameters: { query: 'AI news' }
});
```

### Streaming Example

```javascript
async function streamChat(messages, model) {
  const token = await getApiToken();
  
  const response = await fetch('http://localhost:37240/api/chat/stream', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ messages, model, provider: 'openai' })
  });
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        if (data.type === 'content') {
          console.log(data.delta);
        }
      }
    }
  }
}
```

---

## Changelog

### v1.0.0 (Current)
- Initial API release
- Tool execution endpoints
- Chat message & streaming
- Vision analysis
- WebSocket support
- Rate limiting
- CORS protection

---

## Support

For issues or questions:
- Check logs: `~/.tandem/logs/main.log`
- Report bugs: GitHub Issues
- Documentation: [CONFIG.md](CONFIG.md)

# Tandem Browser Extension

AI-powered browser control extension for Tandem. Enables the AI assistant to interact with web pages, extract content, fill forms, and perform automated actions.

## 🌐 Browser Compatibility

| Browser | Support | Installation Method |
|---------|---------|---------------------|
| ✅ Chrome | Full Support | Load Unpacked (Dev Mode) |
| ✅ Edge | Full Support | Load Unpacked (Dev Mode) |
| ✅ Brave | Full Support | Load Unpacked (Dev Mode) |
| ✅ Opera | Full Support | Load Unpacked (Dev Mode) |
| ✅ Vivaldi | Full Support | Load Unpacked (Dev Mode) |
| ⚠️ Firefox | Coming Soon | Requires Manifest V2/V3 changes |
| ❌ Safari | Not Planned | Different extension API |

**Note:** All Chromium-based browsers (Chrome, Edge, Brave, Opera, Vivaldi, etc.) are fully supported using the same extension files.

## ✨ Features

### Core Features
- 🤖 **AI Chat Integration** - Chat with AI directly from browser popup
- 🌐 **DOM Manipulation** - Click buttons, fill forms, extract text
- 🔍 **Page Analysis** - Get page info, find elements, extract content
- 🔒 **Secure Connection** - Token-based authentication with local Tandem app
- ⚡ **Real-time Streaming** - Stream AI responses in real-time
- 🛠️ **Tool Execution** - Execute Tandem tools from browser

### Advanced Features (Phase 7-11)
- 💡 **Smart Suggestions** - Context-aware quick actions based on page analysis
- 📝 **Form Intelligence** - Auto-fill forms with 20+ field type detection
- 📸 **Screenshot + Vision** - Full-page capture, vision AI analysis, coordinate-based clicking
- 🔧 **Enhanced DOM** - XPath, Shadow DOM, fuzzy matching, drag-drop, keyboard shortcuts
- 🗂️ **Multi-tab Orchestration** - Parallel execution, cross-tab workflows, data aggregation

## 📦 Installation

### Chrome / Edge / Brave / Opera (Chromium-based browsers)

1. **Make sure Tandem app is running** on your computer

2. **Load extension:**

   **For Chrome:**
   - Open `chrome://extensions/`
   - Enable **Developer mode** (toggle in top-right)
   - Click **Load unpacked**
   - Select the `extension` folder from your Tandem project directory
   
   **For Edge:**
   - Open `edge://extensions/`
   - Enable **Developer mode** (toggle in left sidebar)
   - Click **Load unpacked**
   - Select the `extension` folder
   
   **For Brave:**
   - Open `brave://extensions/`
   - Enable **Developer mode**
   - Click **Load unpacked**
   - Select the `extension` folder
   
   **For Opera:**
   - Open `opera://extensions/`
   - Enable **Developer mode**
   - Click **Load unpacked**
   - Select the `extension` folder

3. **Pin the extension** (optional):
   - Click the puzzle icon in your browser toolbar
   - Find "Tandem Browser Extension"
   - Click the pin icon to keep it visible

### Firefox (Coming Soon)

Firefox support requires minor manifest changes. We're working on a separate build for Firefox.

### Production (Not yet available)

The extension will be published to Chrome Web Store and Edge Add-ons once stable.

## 🚀 Usage

### Initial Setup

1. Click the Tandem extension icon in your browser
2. Make sure the Tandem desktop app is running
3. The extension will automatically connect to `http://localhost:42069`

### Chatting with AI

1. Click the extension icon to open the popup
2. **Select a model** from the dropdown (grouped by provider):
   - ⚡ GitHub Copilot
   - ✨ OpenAI (GPT-4o, GPT-3.5, etc.)
   - 🧠 Anthropic (Claude models)
   - 🌐 Antigravity
   - 💻 OpenCode
   - 🖥️ Ollama (local models)
3. Type your question or command
4. AI will respond with context about the current page
5. You can ask AI to:
   - "Summarize this page"
   - "Extract the main content"
   - "Fill this form with..."
   - "Click the login button"

**Note:** Models are dynamically loaded from Tandem's Rust model-service. Available models depend on:
- Which providers are authenticated in Tandem desktop app
- Which local model services (Ollama) are running
- Your API access and quotas

### Browser Actions

- **📄 Extract** - Extract page content and add to context
- **ℹ️ Info** - Get page information (title, URL, forms, images)
- **🗑️ Clear** - Clear chat history
- **🗂️ Tabs** - Multi-tab orchestration tools

## ⚙️ Configuration

### API Endpoint

By default, the extension connects to `http://localhost:42069`. This is the Tandem API server that runs when you start the desktop app.

### Model Selection

You can change the AI model in the popup footer:
- GPT-4o (default)
- Claude 3.5 Sonnet
- GPT-3.5 Turbo

## 🔒 Security

- ✅ Token-based authentication (auto-generated on each app start)
- ✅ CORS protection (only localhost and extension origins)
- ✅ Minimal permissions (activeTab only)
- ✅ No data collection or external API calls

## ⚠️ Proxy Warning

The extension requires the **Tandem proxy server** to be running for AI features. If you see a proxy warning:

1. Open Tandem desktop app
2. Go to Settings → Proxy
3. Click "Start Proxy"
4. Return to the extension - warning should disappear

## 🛠️ Development

### File Structure

```
extension/
├── manifest.json           # Extension manifest (Manifest V3)
├── background/
│   └── service-worker.js  # Background service worker
├── content/
│   └── content-script.js  # Injected into web pages
├── popup/
│   ├── popup.html         # Popup UI
│   ├── popup.css          # Styles
│   └── popup.js           # Popup logic
├── features/              # Advanced feature modules
│   ├── page-analyzer.js   # Smart page analysis
│   ├── form-intelligence.js # Form detection & auto-fill
│   ├── screenshot-vision.js # Screenshot & vision AI
│   ├── enhanced-dom.js    # Advanced DOM manipulation
│   └── multi-tab.js       # Multi-tab orchestration
└── assets/
    └── icon*.png          # Extension icons
```

### Making Changes

1. Edit the files in `extension/` folder
2. Go to `chrome://extensions/`
3. Click the refresh icon on the Tandem extension
4. Test your changes

### Adding Icons

Place icon files in `extension/assets/`:
- `icon16.png` (16x16)
- `icon32.png` (32x32)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

You can use the Tandem logo from `resources/` folder.

## 📚 API Reference

### Background Messages

```javascript
// Check connection
chrome.runtime.sendMessage({ type: 'CHECK_CONNECTION' }, (response) => {
    console.log('Connected:', response.connected);
});

// Execute tool
chrome.runtime.sendMessage({
    type: 'EXECUTE_TOOL',
    toolName: 'read_file',
    args: { path: '/path/to/file' }
}, (response) => {
    console.log('Result:', response.result);
});

// Send chat message
chrome.runtime.sendMessage({
    type: 'SEND_CHAT',
    messages: [{ role: 'user', content: 'Hello' }],
    model: 'gpt-4o',
    provider: 'openai'
}, (response) => {
    console.log('AI response:', response.result);
});
```

### Content Script Actions

```javascript
// Extract page content
chrome.runtime.sendMessage({
    type: 'PAGE_ACTION',
    action: 'extract',
    params: { selector: 'body' }
});

// Click element
chrome.runtime.sendMessage({
    type: 'PAGE_ACTION',
    action: 'click',
    params: { selector: '#login-button' }
});

// Fill form field
chrome.runtime.sendMessage({
    type: 'PAGE_ACTION',
    action: 'fill',
    params: { selector: '#username', value: 'user@example.com' }
});
```

## 🐛 Troubleshooting

### Extension shows "Disconnected"

- Make sure Tandem desktop app is running
- Check if API server is listening on port 42069
- Try clicking "Retry Connection"

### Proxy warning appears

- Open Tandem app → Settings → Proxy
- Enable and start the proxy server
- Return to extension

### Chat not working

- Check browser console for errors (F12)
- Make sure you have an active internet connection
- Verify API keys are configured in Tandem app

### Content script not working

- Refresh the page you're on
- Check if the extension has activeTab permission
- Some pages (chrome://, about:) cannot be accessed

## 🚀 Multi-Tab Features (Phase 11)

The extension now supports advanced multi-tab orchestration:

### Basic Operations
```javascript
// Create a new tab
chrome.runtime.sendMessage({ 
    type: 'CREATE_TAB', 
    options: { url: 'https://example.com', active: false }
});

// Close multiple tabs
chrome.runtime.sendMessage({ 
    type: 'CLOSE_TABS', 
    tabIds: [123, 456] 
});

// Duplicate a tab
chrome.runtime.sendMessage({ 
    type: 'DUPLICATE_TAB', 
    tabId: 123 
});
```

### Tab Groups
```javascript
// Add tab to a group
chrome.runtime.sendMessage({ 
    type: 'ADD_TO_GROUP', 
    groupId: 'my-group', 
    tabId: 123 
});

// Execute action in all tabs of a group
chrome.runtime.sendMessage({ 
    type: 'EXECUTE_IN_GROUP', 
    groupId: 'my-group',
    action: 'extractText'
});

// Close entire group
chrome.runtime.sendMessage({ 
    type: 'CLOSE_GROUP', 
    groupId: 'my-group' 
});
```

### Parallel Execution
```javascript
// Open multiple URLs and execute actions
chrome.runtime.sendMessage({ 
    type: 'OPEN_AND_EXECUTE', 
    tasks: [
        { url: 'https://site1.com', action: 'extractText', waitForLoad: true },
        { url: 'https://site2.com', action: 'extractText', waitForLoad: true }
    ]
});
```

### Sequential Workflows
```javascript
// Execute workflow across multiple tabs
chrome.runtime.sendMessage({ 
    type: 'EXECUTE_WORKFLOW', 
    workflow: {
        shareContext: true,
        steps: [
            { url: 'https://login.example.com', action: 'fillForm', params: {...} },
            { url: 'https://dashboard.example.com', action: 'extractData', useNewTab: false },
            { action: 'click', params: { selector: '.download-btn' }, closeAfter: true }
        ]
    }
});
```

### Cross-Tab Data Sharing
```javascript
// Set shared context (broadcasts to all tabs)
chrome.runtime.sendMessage({ 
    type: 'SET_SHARED_CONTEXT', 
    key: 'userId', 
    value: '12345' 
});

// Get shared context
chrome.runtime.sendMessage({ 
    type: 'GET_SHARED_CONTEXT', 
    key: 'userId' 
});

// In content script, access shared context
chrome.runtime.sendMessage({ 
    type: 'PAGE_ACTION', 
    action: 'getSharedContext' 
});
```

### Data Aggregation
```javascript
// Aggregate results from multiple tabs
chrome.runtime.sendMessage({ 
    type: 'AGGREGATE_FROM_TABS',
    tabIds: [123, 456, 789],
    action: 'extractText',
    aggregator: 'concat' // or 'merge', 'sum', 'collect'
});
```

## 📝 License

GPL-3.0 - Same as Tandem desktop app

## 🤝 Contributing

Contributions welcome! Please see the main Tandem repository for contribution guidelines.

## 📮 Support

- 🐛 Report issues: [GitHub Issues](https://github.com/TengraStudio/tandem/issues)
- 💬 Discuss: [GitHub Discussions](https://github.com/TengraStudio/tandem/discussions)
- 📧 Email: support@tandem.dev (placeholder)

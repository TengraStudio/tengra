// Popup Script - Handles UI interactions and communication

let connected = false;
let proxyRunning = false;
let conversationHistory = [];

// DOM elements
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const proxyWarning = document.getElementById('proxy-warning');
const connectionError = document.getElementById('connection-error');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const modelSelector = document.getElementById('model-selector');
const retryButton = document.getElementById('retry-connection');
const extractPageButton = document.getElementById('extract-page');
const getPageInfoButton = document.getElementById('get-page-info');
const clearChatButton = document.getElementById('clear-chat');
const suggestionsPanel = document.getElementById('suggestions-panel');
const suggestionsList = document.getElementById('suggestions-list');
const closeSuggestionsButton = document.getElementById('close-suggestions');
const suggestionsTeaser = document.getElementById('suggestions-teaser');
const multiTabMenuButton = document.getElementById('multi-tab-menu');
const multitabPanel = document.getElementById('multitab-panel');
const closeMultitabButton = document.getElementById('close-multitab');
const tabStatsDiv = document.getElementById('tab-stats');

// Initialize on popup open
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Tandem Popup] Initializing...');
    loadConversationHistory();
    setupEventListeners();
    checkConnection(); // This will load models after connection
    updateTabStats();
});

/**
 * Setup event listeners
 */
function setupEventListeners() {
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    retryButton.addEventListener('click', checkConnection);
    extractPageButton.addEventListener('click', extractPageContent);
    getPageInfoButton.addEventListener('click', getPageInfo);
    clearChatButton.addEventListener('click', clearChat);

    // Multi-tab controls
    multiTabMenuButton.addEventListener('click', toggleMultitabPanel);
    closeMultitabButton.addEventListener('click', () => {
        multitabPanel.classList.add('hidden');
    });

    if (suggestionsTeaser) {
        suggestionsTeaser.addEventListener('click', () => {
            suggestionsPanel.classList.remove('hidden');
        });
    }

    if (closeSuggestionsButton) {
        closeSuggestionsButton.addEventListener('click', () => {
            suggestionsPanel.classList.add('hidden');
        });
    }

    document.getElementById('get-all-tabs').addEventListener('click', showAllTabs);
    document.getElementById('close-all-inactive').addEventListener('click', closeInactiveTabs);
    document.getElementById('duplicate-current').addEventListener('click', duplicateCurrentTab);
    document.getElementById('extract-from-all').addEventListener('click', extractFromMultiple);
    document.getElementById('compare-tabs').addEventListener('click', compareTabs);

    // Listen for connection status updates
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'CONNECTION_STATUS') {
            updateConnectionStatus(message.connected, message.proxyStatus, message.error);
        }
    });
}

/**
 * Check connection to Tandem API
 */
async function checkConnection() {
    console.log('[Tandem Popup] Checking connection...');
    statusText.textContent = 'Connecting...';

    try {
        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ type: 'CHECK_CONNECTION' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('[Tandem Popup] Runtime error:', chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                } else {
                    console.log('[Tandem Popup] Connection response:', response);
                    resolve(response);
                }
            });
        });

        updateConnectionStatus(response.connected, response.proxyStatus);

        // Load models and suggestions after connection is established
        if (response.connected) {
            console.log('[Tandem Popup] Connected! Loading models...');
            await loadAvailableModels();
            loadSmartSuggestions();
        } else {
            console.warn('[Tandem Popup] Not connected');
        }
    } catch (error) {
        console.error('[Tandem Popup] Connection check failed:', error);
        updateConnectionStatus(false, null, 'Extension error');
    }
}

/**
 * Update UI based on connection status
 */
function updateConnectionStatus(isConnected, proxyStatus, error) {
    connected = isConnected;
    proxyRunning = proxyStatus?.running ?? false;

    if (isConnected) {
        statusIndicator.className = 'status-dot connected';
        statusText.textContent = 'Connected';
        connectionError.classList.add('hidden');
        sendButton.disabled = false;

        // Check proxy status
        if (!proxyRunning) {
            proxyWarning.classList.remove('hidden');
            statusText.textContent = 'Proxy offline';
        } else {
            proxyWarning.classList.add('hidden');
        }
    } else {
        statusIndicator.className = 'status-dot disconnected';
        statusText.textContent = error || 'Disconnected';
        connectionError.classList.remove('hidden');
        proxyWarning.classList.add('hidden');
        sendButton.disabled = true;
    }
}

/**
 * Send message to AI
 */
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !connected) return;

    // Remove greeting if present
    const greeting = messagesContainer.querySelector('.greeting');
    if (greeting) {
        greeting.remove();
    }

    // Add user message to UI
    addMessage('user', message);
    conversationHistory.push({ role: 'user', content: message });

    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';

    // Disable send button while processing
    sendButton.disabled = true;

    try {
        // Get current tab context
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];

        // Add context about current page
        const contextMessage = {
            role: 'system',
            content: `User is currently on: ${currentTab.title} (${currentTab.url})`
        };

        const messages = [contextMessage, ...conversationHistory];
        const model = modelSelector.value;

        // Get provider from selected option's data attribute
        const selectedOption = modelSelector.options[modelSelector.selectedIndex];
        const provider = selectedOption?.dataset?.provider;

        if (!provider) {
            addMessage('error', 'Model provider not found. Please reload the extension.');
            sendButton.disabled = false;
            return;
        }

        // Send to background script
        chrome.runtime.sendMessage({
            type: 'SEND_CHAT',
            messages,
            model,
            provider
        }, (response) => {
            sendButton.disabled = false;

            if (response.success) {
                const aiMessage = response.result.response.content;
                addMessage('assistant', aiMessage);
                conversationHistory.push({ role: 'assistant', content: aiMessage });
                saveConversationHistory();

                // Check if AI wants to perform any page actions
                checkForPageActions(aiMessage);
            } else {
                addMessage('error', `Error: ${response.error}`);
            }
        });
    } catch (error) {
        sendButton.disabled = false;
        addMessage('error', `Error: ${error.message}`);
    }
}

/**
 * Add message to chat UI
 */
function addMessage(type, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = content;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Extract page content
 */
function extractPageContent() {
    chrome.runtime.sendMessage({
        type: 'PAGE_ACTION',
        action: 'extract',
        params: { selector: 'body' }
    }, (response) => {
        if (response && response.success) {
            const text = response.text.substring(0, 500);
            addMessage('system', `Extracted page content (${text.length} chars)`);

            // Add to context
            conversationHistory.push({
                role: 'system',
                content: `Page content: ${text}...`
            });
        } else {
            addMessage('error', `Failed to extract: ${response?.error || 'Unknown error'}`);
        }
    });
}

/**
 * Get page information
 */
function getPageInfo() {
    chrome.runtime.sendMessage({
        type: 'PAGE_ACTION',
        action: 'getPageInfo',
        params: {}
    }, (response) => {
        if (response && response.success) {
            const info = `Page: ${response.title}\nURL: ${response.url}\nForms: ${response.forms}, Images: ${response.images}`;
            addMessage('system', info);
        } else {
            addMessage('error', `Failed to get page info: ${response?.error || 'Unknown error'}`);
        }
    });
}

/**
 * Check if AI message contains page action requests
 */
function checkForPageActions(message) {
    // Simple pattern matching for common actions
    // In production, this would use structured tool calls

    if (message.includes('click') && message.includes('button')) {
        const selector = inferButtonSelectorFromMessage(message);
        chrome.runtime.sendMessage(
            {
                type: 'PAGE_ACTION',
                action: 'click',
                params: { selector },
            },
            (response) => {
                if (response?.success) {
                    addMessage('system', `Clicked button via selector: ${selector}`);
                } else {
                    addMessage(
                        'system',
                        `AI suggested clicking a button, but it failed (${response?.error || 'no matching element'}).`
                    );
                }
            }
        );
    }
}

function inferButtonSelectorFromMessage(message) {
    const quoted = message.match(/["']([^"']{2,80})["']/);
    if (quoted && quoted[1]) {
        const text = quoted[1].trim().replace(/\s+/g, ' ');
        return `button[aria-label*="${text}" i], button[title*="${text}" i], [role="button"][aria-label*="${text}" i], input[type="submit"][value*="${text}" i], input[type="button"][value*="${text}" i]`;
    }
    return 'button, [role="button"], input[type="submit"], input[type="button"]';
}

/**
 * Clear chat history
 */
function clearChat() {
    conversationHistory = [];
    messagesContainer.innerHTML = '';
    saveConversationHistory();
    // Re-add greeting after clearing
    const greetingDiv = document.createElement('div');
    greetingDiv.className = 'message system greeting';
    greetingDiv.innerHTML = `
        <div class="greeting-box">
            <h3>Hi, I'm Tandem.</h3>
            <p>Ask me anything about this page or use the actions below.</p>
        </div>
    `;
    messagesContainer.appendChild(greetingDiv);
}

/**
 * Save conversation history to storage
 */
function saveConversationHistory() {
    chrome.storage.local.set({ conversationHistory });
}

/**
 * Load conversation history from storage
 */
function loadConversationHistory() {
    chrome.storage.local.get(['conversationHistory'], (result) => {
        if (result.conversationHistory) {
            conversationHistory = result.conversationHistory;

            // Display last few messages
            conversationHistory.slice(-5).forEach(msg => {
                if (msg.role !== 'system') {
                    addMessage(msg.role === 'user' ? 'user' : 'assistant', msg.content);
                }
            });
        } else {
            addMessage('system', 'Welcome to Tandem! Ask me anything about this page.');
        }
    });
}

/**
 * Load smart suggestions for current page
 */
async function loadSmartSuggestions() {
    try {
        // Route through background script to handle active tab coordination
        chrome.runtime.sendMessage({
            type: 'PAGE_ACTION',
            action: 'analyzePage',
            params: {}
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn('[Tandem] Content script not ready. Please refresh the page.');
                return;
            }

            if (response && response.success && response.data) {
                displaySuggestions(response.data.suggestions);
            }
        });
    } catch (error) {
        console.error('[Tandem] Error loading suggestions:', error);
    }
}

/**
 * Display suggestions in the panel
 */
function displaySuggestions(suggestions) {
    if (!suggestions || suggestions.length === 0) {
        if (suggestionsTeaser) suggestionsTeaser.classList.add('hidden');
        return;
    }

    if (suggestionsTeaser) suggestionsTeaser.classList.remove('hidden');
    suggestionsList.innerHTML = '';

    suggestions.forEach(suggestion => {
        const item = document.createElement('div');
        item.className = `suggestion-item suggestion-priority-${suggestion.priority}`;

        item.innerHTML = `
            <div class="suggestion-icon">${suggestion.icon}</div>
            <div class="suggestion-content">
                <div class="suggestion-title">${suggestion.title}</div>
                <div class="suggestion-description">${suggestion.description}</div>
            </div>
        `;

        item.addEventListener('click', () => executeSuggestion(suggestion));
        suggestionsList.appendChild(item);
    });
}

/**
 * Execute a suggested action
 */
async function executeSuggestion(suggestion) {
    console.log('[Tandem] Executing suggestion:', suggestion.action);

    switch (suggestion.action) {
        case 'fillLogin':
            messageInput.value = 'Fill the login form with my credentials';
            void sendMessage();
            break;

        case 'fillSignup':
            messageInput.value = 'Help me fill the signup form';
            void sendMessage();
            break;

        case 'performSearch':
            messageInput.value = 'What can I search for on this page?';
            void sendMessage();
            break;

        case 'extractTables':
            messageInput.value = 'Extract all table data from this page';
            void sendMessage();
            break;

        case 'extractProducts':
            messageInput.value = 'Extract all product information from this page';
            void sendMessage();
            break;

        case 'analyzeVideos':
            messageInput.value = 'Tell me about the videos on this page';
            void sendMessage();
            break;

        case 'summarizePage':
            messageInput.value = 'Summarize the main content of this page';
            void sendMessage();
            break;

        case 'getPageInfo':
            void getPageInfo();
            break;

        case 'extractAllText':
            void extractPageContent();
            break;

        default:
            console.warn('[Tandem] Unknown suggestion action:', suggestion.action);
    }

    // Close suggestions panel after executing
    suggestionsPanel.classList.add('hidden');
}

/**
 * Load available models from API and categorize by provider
 */
async function loadAvailableModels() {
    try {
        const response = await fetch('http://localhost:42069/api/models', {
            headers: {
                'Authorization': `Bearer ${await getApiToken()}`
            }
        });

        if (!response.ok) {
            console.warn('[Tandem] Failed to load models from API');
            return;
        }

        const data = await response.json();
        if (!data.success || !data.models || data.models.length === 0) {
            console.warn('[Tandem] No models received from API');
            return;
        }

        // Group models by provider
        const groupedModels = {};
        data.models.forEach(model => {
            const provider = model.provider || 'other';
            if (!groupedModels[provider]) {
                groupedModels[provider] = [];
            }
            groupedModels[provider].push(model);
        });

        // Provider labels and order
        const providerConfig = {
            'copilot': { label: '⚡ GitHub Copilot', order: 1 },
            'openai': { label: '✨ OpenAI', order: 2 },
            'anthropic': { label: '🧠 Anthropic', order: 3 },
            'antigravity': { label: '🌐 Antigravity', order: 4 },
            'opencode': { label: '💻 OpenCode', order: 5 },
            'ollama': { label: '🖥️ Ollama', order: 6 },
            'other': { label: '📦 Other', order: 99 }
        };

        // Clear existing options
        modelSelector.innerHTML = '';

        // Sort providers by order
        const sortedProviders = Object.keys(groupedModels).sort((a, b) => {
            const orderA = providerConfig[a]?.order || 99;
            const orderB = providerConfig[b]?.order || 99;
            return orderA - orderB;
        });

        // Add models grouped by provider
        sortedProviders.forEach(provider => {
            const models = groupedModels[provider];
            const config = providerConfig[provider] || providerConfig['other'];

            // Create optgroup for provider
            const optgroup = document.createElement('optgroup');
            optgroup.label = config.label;

            // Add models to optgroup
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name;
                option.dataset.provider = model.provider;

                // Add context window info if available
                if (model.contextWindow) {
                    const contextK = Math.floor(model.contextWindow / 1000);
                    option.textContent += ` (${contextK}K)`;
                }

                optgroup.appendChild(option);
            });

            modelSelector.appendChild(optgroup);
        });

        console.log(`[Tandem] Loaded ${data.models.length} models from ${sortedProviders.length} providers`);
    } catch (error) {
        console.error('[Tandem] Error loading models:', error);
    }
}

/**
 * Get API token from storage
 */
async function getApiToken() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['apiToken'], (result) => {
            resolve(result.apiToken || '');
        });
    });
}

/**
 * Toggle multi-tab panel
 */
function toggleMultitabPanel() {
    if (multitabPanel.classList.contains('hidden')) {
        multitabPanel.classList.remove('hidden');
        suggestionsPanel.classList.add('hidden'); // Close suggestions
        updateTabStats();
    } else {
        multitabPanel.classList.add('hidden');
    }
}

/**
 * Update tab statistics
 */
async function updateTabStats() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_TAB_STATS' });
        if (response.success) {
            const stats = response.stats;
            tabStatsDiv.innerHTML = `
                <div><strong>Total Tabs:</strong> ${stats.totalTabs}</div>
                <div><strong>Tab Groups:</strong> ${stats.totalGroups}</div>
                <div><strong>Shared Context:</strong> ${stats.sharedContextSize} items</div>
            `;
        }
    } catch (error) {
        console.error('[Tandem] Error getting tab stats:', error);
    }
}

/**
 * Show all tabs in chat
 */
async function showAllTabs() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_ALL_TABS' });
        if (response.success) {
            const tabs = response.tabs;
            let message = `📋 **Active Tabs (${tabs.length}):**\n\n`;
            tabs.forEach((tab, idx) => {
                message += `${idx + 1}. ${tab.title || 'Untitled'}\n   ${tab.url}\n`;
                if (tab.groupId) message += `   📁 Group: ${tab.groupId}\n`;
            });
            addMessage('system', message);
            multitabPanel.classList.add('hidden');
        }
    } catch (error) {
        addMessage('error', 'Failed to get tabs: ' + error.message);
    }
}

/**
 * Close all inactive tabs
 */
async function closeInactiveTabs() {
    try {
        const allTabs = await chrome.tabs.query({});
        const activeTabs = allTabs.filter(tab => tab.active);
        const inactiveTabs = allTabs.filter(tab => !tab.active);

        if (inactiveTabs.length === 0) {
            addMessage('system', 'No inactive tabs to close.');
            return;
        }

        const confirm = window.confirm(`Close ${inactiveTabs.length} inactive tabs?`);
        if (!confirm) return;

        const tabIds = inactiveTabs.map(tab => tab.id);
        await chrome.runtime.sendMessage({ type: 'CLOSE_TABS', tabIds });

        addMessage('system', `✅ Closed ${inactiveTabs.length} inactive tabs.`);
        updateTabStats();
        multitabPanel.classList.add('hidden');
    } catch (error) {
        addMessage('error', 'Failed to close tabs: ' + error.message);
    }
}

/**
 * Duplicate current tab
 */
async function duplicateCurrentTab() {
    try {
        const currentTab = await chrome.tabs.query({ active: true, currentWindow: true });
        if (currentTab.length === 0) return;

        const response = await chrome.runtime.sendMessage({
            type: 'DUPLICATE_TAB',
            tabId: currentTab[0].id
        });

        if (response.success) {
            addMessage('system', `✅ Tab duplicated: ${response.tab.title}`);
            updateTabStats();
            multitabPanel.classList.add('hidden');
        }
    } catch (error) {
        addMessage('error', 'Failed to duplicate tab: ' + error.message);
    }
}

/**
 * Extract data from multiple URLs
 */
async function extractFromMultiple() {
    const urls = window.prompt(
        'Enter URLs to extract (one per line):',
        'https://example.com\nhttps://example.org'
    );

    if (!urls) return;

    const urlList = urls.split('\n').filter(u => u.trim());
    if (urlList.length === 0) return;

    addMessage('system', `🚀 Opening ${urlList.length} tabs and extracting content...`);
    multitabPanel.classList.add('hidden');

    try {
        const tasks = urlList.map(url => ({
            url: url.trim(),
            action: 'extractText',
            params: {},
            waitForLoad: true
        }));

        const response = await chrome.runtime.sendMessage({
            type: 'OPEN_AND_EXECUTE',
            tasks
        });

        if (response.success) {
            let message = `✅ **Extraction Complete**\n\n`;
            message += `Total: ${response.summary.total}\n`;
            message += `Successful: ${response.summary.successful}\n`;
            message += `Failed: ${response.summary.failed}\n\n`;

            response.results.forEach((result, idx) => {
                if (result.success) {
                    message += `${idx + 1}. ${result.url}\n`;
                    message += `   ✅ Extracted ${result.result?.data?.text?.length || 0} characters\n`;
                } else {
                    message += `${idx + 1}. ${result.url}\n`;
                    message += `   ❌ Error: ${result.error}\n`;
                }
            });

            addMessage('system', message);

            // Ask if user wants to close the tabs
            const closeGroup = window.confirm('Close all opened tabs?');
            if (closeGroup && response.groupId) {
                await chrome.runtime.sendMessage({
                    type: 'CLOSE_GROUP',
                    groupId: response.groupId
                });
            }
        }
    } catch (error) {
        addMessage('error', 'Multi-tab extraction failed: ' + error.message);
    }
}

/**
 * Compare data across tabs
 */
async function compareTabs() {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'FIND_TABS',
            criteria: {}
        });

        if (!response.success || response.tabs.length < 2) {
            addMessage('system', 'Need at least 2 tabs to compare.');
            return;
        }

        addMessage('system', `🔍 Comparing ${response.tabs.length} tabs...`);
        multitabPanel.classList.add('hidden');

        const tabIds = response.tabs.map(t => t.id);
        const aggregateResponse = await chrome.runtime.sendMessage({
            type: 'AGGREGATE_FROM_TABS',
            tabIds,
            action: 'getPageInfo',
            params: {},
            aggregator: 'collect'
        });

        if (aggregateResponse.success) {
            let message = `📊 **Tab Comparison**\n\n`;
            aggregateResponse.aggregated.forEach((data, idx) => {
                message += `**Tab ${idx + 1}:** ${data.title}\n`;
                message += `URL: ${data.url}\n`;
                message += `Links: ${data.linkCount || 0}, Forms: ${data.formCount || 0}\n\n`;
            });

            addMessage('system', message);
        }
    } catch (error) {
        addMessage('error', 'Comparison failed: ' + error.message);
    }
}

// Setup close button for suggestions
if (closeSuggestionsButton) {
    closeSuggestionsButton.addEventListener('click', () => {
        suggestionsPanel.style.display = 'none';
    });
}

console.log('[Tandem Popup] Script loaded');

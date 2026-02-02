// Background Service Worker for Tandem Extension
// Handles communication between content script, popup, and Tandem API

const API_BASE_URL = 'http://localhost:42069';
let apiToken = null;
let proxyStatus = { running: false, enabled: false };

// Import feature modules (relative to extension root)
importScripts('features/screenshot-vision.js');
importScripts('features/multi-tab.js');

const screenshotVision = new ScreenshotVision();
const tabManager = new MultiTabManager();

// Initialize on installation
chrome.runtime.onInstalled.addListener(async () => {
    console.log('[Tandem] Extension installed');
    await checkApiConnection();
});

// Initialize on startup
chrome.runtime.onStartup.addListener(async () => {
    console.log('[Tandem] Extension started');
    await checkApiConnection();
});

/**
 * Check connection to Tandem API and get auth token
 */
async function checkApiConnection() {
    try {
        // Get API token
        const tokenRes = await fetch(`${API_BASE_URL}/api/auth/token`);
        if (!tokenRes.ok) {
            throw new Error('Failed to get API token');
        }
        const tokenData = await tokenRes.json();
        apiToken = tokenData.token;

        // Set token for screenshot vision
        screenshotVision.setApiToken(apiToken);

        console.log('[Tandem] API token received');

        // Check proxy status
        await updateProxyStatus();

        // Store connection status
        await chrome.storage.local.set({
            connected: true,
            apiToken,
            proxyStatus
        });

        // Notify popup if open
        chrome.runtime.sendMessage({
            type: 'CONNECTION_STATUS',
            connected: true,
            proxyStatus
        }).catch(() => {
            // Popup might not be open, ignore error
        });

        return true;
    } catch (error) {
        console.error('[Tandem] Failed to connect to API:', error);
        await chrome.storage.local.set({
            connected: false,
            apiToken: null,
            proxyStatus: { running: false, enabled: false }
        });

        chrome.runtime.sendMessage({
            type: 'CONNECTION_STATUS',
            connected: false,
            error: error.message
        }).catch(() => {
            // Popup might not be open, ignore error
        });

        return false;
    }
}

/**
 * Update proxy status from API
 */
async function updateProxyStatus() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/proxy/status`);
        if (!res.ok) {
            throw new Error('Failed to get proxy status');
        }
        proxyStatus = await res.json();
        console.log('[Tandem] Proxy status:', proxyStatus);
        return proxyStatus;
    } catch (error) {
        console.error('[Tandem] Failed to get proxy status:', error);
        return { running: false, enabled: false };
    }
}

/**
 * Execute a tool via API
 */
async function executeTool(toolName, args) {
    if (!apiToken) {
        throw new Error('Not connected to Tandem API');
    }

    const res = await fetch(`${API_BASE_URL}/api/tools/execute`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiToken}`
        },
        body: JSON.stringify({ toolName, args })
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Tool execution failed');
    }

    return await res.json();
}

/**
 * Send chat message (non-streaming)
 */
async function sendChatMessage(messages, model, provider) {
    if (!apiToken) {
        throw new Error('Not connected to Tandem API');
    }

    const res = await fetch(`${API_BASE_URL}/api/chat/message`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiToken}`
        },
        body: JSON.stringify({ messages, model, provider })
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Chat request failed');
    }

    return await res.json();
}

/**
 * Get available tools
 */
async function getTools() {
    if (!apiToken) {
        throw new Error('Not connected to Tandem API');
    }

    const res = await fetch(`${API_BASE_URL}/api/tools/list`, {
        headers: {
            'Authorization': `Bearer ${apiToken}`
        }
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to get tools');
    }

    return await res.json();
}

// Message handler for popup and content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Tandem] Message received:', message.type);

    switch (message.type) {
        case 'CHECK_CONNECTION':
            console.log('[Tandem SW] CHECK_CONNECTION received');
            checkApiConnection()
                .then(connected => {
                    console.log('[Tandem SW] Sending response:', { connected, proxyStatus });
                    sendResponse({ connected, proxyStatus });
                })
                .catch((error) => {
                    console.error('[Tandem SW] checkApiConnection error:', error);
                    sendResponse({ connected: false, proxyStatus });
                });
            return true; // Keep channel open for async response

        case 'GET_PROXY_STATUS':
            updateProxyStatus().then(status => {
                sendResponse({ status });
            });
            return true;

        case 'EXECUTE_TOOL':
            executeTool(message.toolName, message.args)
                .then(result => sendResponse({ success: true, result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'SEND_CHAT':
            sendChatMessage(message.messages, message.model, message.provider)
                .then(result => sendResponse({ success: true, result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'GET_TOOLS':
            getTools()
                .then(result => sendResponse({ success: true, result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'PAGE_ACTION':
            // Forward to content script on active tab
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const activeTab = tabs[0];
                if (activeTab) {
                    console.log(`[Tandem SW] Forwarding ${message.action} to tab ${activeTab.id}: ${activeTab.url}`);
                    chrome.tabs.sendMessage(activeTab.id, message, (response) => {
                        if (chrome.runtime.lastError) {
                            console.warn('[Tandem SW] Send message error:', chrome.runtime.lastError.message);
                            sendResponse({ success: false, error: 'Could not connect to page. Please refresh the page.' });
                        } else {
                            console.log('[Tandem SW] Received response from content script');
                            sendResponse(response);
                        }
                    });
                } else {
                    console.warn('[Tandem SW] No active tab found for PAGE_ACTION');
                    sendResponse({ success: false, error: 'No active tab' });
                }
            });
            return true;

        // Screenshot & Vision actions
        case 'CAPTURE_SCREENSHOT':
            screenshotVision.captureFullPage(message.fullPage || false)
                .then(dataUrl => sendResponse({ success: true, image: dataUrl }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'CAPTURE_ELEMENT':
            screenshotVision.captureElement(message.selector)
                .then(dataUrl => sendResponse({ success: true, image: dataUrl }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'ANALYZE_VISION':
            screenshotVision.analyzeWithVision(
                message.image,
                message.prompt,
                message.model,
                message.provider
            )
                .then(result => sendResponse({ success: true, ...result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'FIND_BY_DESCRIPTION':
            screenshotVision.findElementByDescription(message.description)
                .then(coords => sendResponse({ success: true, coords }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'CLICK_BY_DESCRIPTION':
            screenshotVision.clickByDescription(message.description)
                .then(result => sendResponse(result))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'DESCRIBE_PAGE':
            screenshotVision.describePage()
                .then(description => sendResponse({ success: true, description }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        // Multi-tab orchestration messages
        case 'CREATE_TAB':
            tabManager.createTab(message.options)
                .then(tab => sendResponse({ success: true, tab }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'CLOSE_TABS':
            tabManager.closeTabs(message.tabIds)
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'SWITCH_TAB':
            tabManager.switchToTab(message.tabId)
                .then(tab => sendResponse({ success: true, tab }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'DUPLICATE_TAB':
            tabManager.duplicateTab(message.tabId, message.options)
                .then(tab => sendResponse({ success: true, tab }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'ADD_TO_GROUP':
            tabManager.addToGroup(message.groupId, message.tabId);
            sendResponse({ success: true });
            return false;

        case 'GET_GROUP_TABS':
            const groupTabs = tabManager.getGroupTabs(message.groupId);
            sendResponse({ success: true, tabs: groupTabs });
            return false;

        case 'CLOSE_GROUP':
            tabManager.closeGroup(message.groupId)
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'EXECUTE_IN_TAB':
            tabManager.executeInTab(message.tabId, message.action, message.params)
                .then(result => sendResponse({ success: true, result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'EXECUTE_IN_GROUP':
            tabManager.executeInGroup(message.groupId, message.action, message.params)
                .then(results => sendResponse({ success: true, results }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'OPEN_AND_EXECUTE':
            tabManager.openAndExecute(message.tasks)
                .then(result => sendResponse({ success: true, ...result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'EXECUTE_WORKFLOW':
            tabManager.executeWorkflow(message.workflow)
                .then(result => sendResponse({ success: true, ...result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'SET_SHARED_CONTEXT':
            tabManager.setSharedContext(message.key, message.value);
            sendResponse({ success: true });
            return false;

        case 'GET_SHARED_CONTEXT':
            const value = tabManager.getSharedContext(message.key);
            sendResponse({ success: true, value });
            return false;

        case 'AGGREGATE_FROM_TABS':
            tabManager.aggregateFromTabs(message.tabIds, message.action, message.params, message.aggregator)
                .then(result => sendResponse({ success: true, ...result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'GET_ALL_TABS':
            const allTabs = tabManager.getAllTabs();
            sendResponse({ success: true, tabs: allTabs });
            return false;

        case 'FIND_TABS':
            const foundTabs = tabManager.findTabs(message.criteria);
            sendResponse({ success: true, tabs: foundTabs });
            return false;

        case 'GET_TAB_STATS':
            const stats = tabManager.getStats();
            sendResponse({ success: true, stats });
            return false;

        default:
            console.warn('[Tandem] Unknown message type:', message.type);
            sendResponse({ success: false, error: 'Unknown message type' });
    }
});

// Check connection every 30 seconds
setInterval(checkApiConnection, 30000);

console.log('[Tandem] Background service worker loaded');

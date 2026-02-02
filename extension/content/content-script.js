// Content Script - Injected into web pages
// Provides DOM manipulation capabilities for AI

console.log('[Tandem Content Script] Initializing on:', window.location.href);

// Shared context storage (cross-tab data)
let sharedContext = {};

// Analyzer is now injected via manifest.json

// Wait for analyzer to load
let pageAnalyzer = null;
setTimeout(() => {
    if (window.PageAnalyzer) {
        pageAnalyzer = new window.PageAnalyzer();
        console.log('[Tandem] Page analyzer ready');
    }
}, 100);

/**
 * Analyze current page and get smart suggestions
 */
function analyzePage() {
    try {
        if (!pageAnalyzer) {
            pageAnalyzer = new window.PageAnalyzer();
        }
        const analysis = pageAnalyzer.analyze();
        return { success: true, data: analysis };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Extract text from current page
 */
function extractPageText(selector = 'body') {
    try {
        const element = document.querySelector(selector);
        if (!element) {
            return { success: false, error: `Element not found: ${selector}` };
        }

        return {
            success: true,
            text: element.innerText,
            html: element.innerHTML,
            url: window.location.href,
            title: document.title
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Click an element
 */
function clickElement(selector) {
    try {
        const element = document.querySelector(selector);
        if (!element) {
            return { success: false, error: `Element not found: ${selector}` };
        }

        element.click();
        return {
            success: true,
            message: `Clicked element: ${selector}`,
            tagName: element.tagName,
            text: element.innerText?.substring(0, 100)
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Fill a form field
 */
function fillField(selector, value) {
    try {
        const element = document.querySelector(selector);
        if (!element) {
            return { success: false, error: `Element not found: ${selector}` };
        }

        // Handle different input types
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.value = value;
            // Trigger change event
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (element.isContentEditable) {
            element.textContent = value;
        } else {
            return { success: false, error: 'Element is not editable' };
        }

        return {
            success: true,
            message: `Filled ${selector} with value`,
            tagName: element.tagName
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Navigate to URL
 */
function navigateToUrl(url) {
    try {
        window.location.href = url;
        return { success: true, message: `Navigating to ${url}` };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Get page information
 */
function getPageInfo() {
    return {
        success: true,
        url: window.location.href,
        title: document.title,
        meta: {
            description: document.querySelector('meta[name="description"]')?.content,
            keywords: document.querySelector('meta[name="keywords"]')?.content
        },
        links: Array.from(document.querySelectorAll('a')).slice(0, 20).map(a => ({
            text: a.innerText?.substring(0, 50),
            href: a.href
        })),
        forms: Array.from(document.querySelectorAll('form')).length,
        images: Array.from(document.querySelectorAll('img')).length
    };
}

/**
 * Find elements by various criteria
 */
function findElements(query) {
    try {
        const elements = Array.from(document.querySelectorAll(query)).slice(0, 10);
        return {
            success: true,
            count: elements.length,
            elements: elements.map(el => ({
                tagName: el.tagName,
                id: el.id,
                className: el.className,
                text: el.innerText?.substring(0, 100),
                attributes: Array.from(el.attributes).reduce((acc, attr) => {
                    acc[attr.name] = attr.value;
                    return acc;
                }, {})
            }))
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Highlight element on page (for debugging)
 */
function highlightElement(selector, duration = 2000) {
    try {
        const element = document.querySelector(selector);
        if (!element) {
            return { success: false, error: `Element not found: ${selector}` };
        }

        const originalStyle = element.style.cssText;
        element.style.outline = '3px solid red';
        element.style.outlineOffset = '2px';
        element.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';

        setTimeout(() => {
            element.style.cssText = originalStyle;
        }, duration);

        return { success: true, message: `Highlighted ${selector}` };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Get page dimensions for screenshot stitching
 */
function getPageDimensions() {
    return {
        success: true,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY
    };
}

/**
 * Scroll to specific position
 */
function scrollTo(x, y) {
    window.scrollTo(x, y);
    return { success: true, x, y };
}

/**
 * Scroll element into view
 */
function scrollToElement(selector) {
    try {
        const element = document.querySelector(selector);
        if (!element) {
            return { success: false, error: `Element not found: ${selector}` };
        }

        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Get element bounding rectangle
 */
function getElementRect(selector) {
    try {
        const element = document.querySelector(selector);
        if (!element) {
            return { success: false, error: `Element not found: ${selector}` };
        }

        const rect = element.getBoundingClientRect();
        return {
            success: true,
            rect: {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                bottom: rect.bottom,
                right: rect.right
            }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Click at specific coordinates (for vision-based clicking)
 */
function clickAtCoordinates(x, y) {
    try {
        const element = document.elementFromPoint(x, y);
        if (!element) {
            return { success: false, error: 'No element at coordinates' };
        }

        // Simulate click event
        const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y
        });

        element.dispatchEvent(clickEvent);

        return {
            success: true,
            element: {
                tag: element.tagName,
                id: element.id,
                class: element.className,
                text: element.textContent?.substring(0, 50)
            }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Tandem Content Script] Message:', message.type);

    switch (message.type) {
        case 'PAGE_ACTION':
            handlePageAction(message.action, message.params, sendResponse);
            return true; // Keep channel open

        case 'PING':
            sendResponse({ success: true, status: 'ready', url: window.location.href });
            return false;

        default:
            console.warn('[Tandem Content Script] Unknown message type:', message.type);
            sendResponse({ success: false, error: 'Unknown message type' });
    }
});

/**
 * Handle page actions from popup/background
 */
function handlePageAction(action, params, sendResponse) {
    let result;

    switch (action) {
        case 'extract':
            result = extractPageText(params.selector);
            break;

        case 'click':
            result = clickElement(params.selector);
            break;

        case 'fill':
            result = fillField(params.selector, params.value);
            break;

        case 'navigate':
            result = navigateToUrl(params.url);
            break;

        case 'getPageInfo':
            result = getPageInfo();
            break;

        case 'findElements':
            result = findElements(params.query);
            break;

        case 'highlight':
            result = highlightElement(params.selector, params.duration);
            break;

        case 'analyzePage':
            result = analyzePage();
            break;

        // Screenshot & Vision actions
        case 'getPageDimensions':
            result = getPageDimensions();
            break;

        case 'scrollTo':
            result = scrollTo(params.x, params.y);
            break;

        case 'scrollToElement':
            result = scrollToElement(params.selector);
            break;

        case 'getElementRect':
            result = getElementRect(params.selector);
            break;

        case 'clickAtCoordinates':
            result = clickAtCoordinates(params.x, params.y);
            break;

        // Shared context access
        case 'getSharedContext':
            result = { success: true, context: sharedContext };
            break;

        case 'setSharedContextValue':
            sharedContext[params.key] = params.value;
            result = { success: true };
            break;

        default:
            result = { success: false, error: `Unknown action: ${action}` };
    }

    sendResponse(result);
}

// Listen for shared context updates from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SHARED_CONTEXT_UPDATE') {
        sharedContext[message.key] = message.value;
        console.log('[Tandem] Shared context updated:', message.key);
    }
});

// Notify background that content script is ready
console.log('[Tandem Content Script] Sending READY signal to background');
chrome.runtime.sendMessage({
    type: 'CONTENT_SCRIPT_READY',
    url: window.location.href
}).then(() => {
    console.log('[Tandem Content Script] READY signal acknowledged');
}).catch((err) => {
    console.log('[Tandem Content Script] Background not listening yet (normal on cold start)');
});

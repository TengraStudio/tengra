/**
 * Enhanced DOM Manipulation
 * Advanced selectors, fuzzy matching, shadow DOM, and complex interactions
 */

class EnhancedDOM {
    constructor() {
        this.highlightedElements = [];
    }

    /**
     * Find element using XPath
     * @param {string} xpath - XPath expression
     * @returns {Element|null}
     */
    findByXPath(xpath) {
        try {
            const result = document.evaluate(
                xpath,
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
            );
            return result.singleNodeValue;
        } catch (error) {
            console.error('[EnhancedDOM] XPath error:', error);
            return null;
        }
    }

    /**
     * Find all elements using XPath
     * @param {string} xpath - XPath expression
     * @returns {Element[]}
     */
    findAllByXPath(xpath) {
        try {
            const result = document.evaluate(
                xpath,
                document,
                null,
                XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                null
            );
            
            const elements = [];
            for (let i = 0; i < result.snapshotLength; i++) {
                elements.push(result.snapshotItem(i));
            }
            return elements;
        } catch (error) {
            console.error('[EnhancedDOM] XPath error:', error);
            return [];
        }
    }

    /**
     * Find element in Shadow DOM
     * @param {string} selector - CSS selector
     * @param {Element} root - Root element to start search
     * @returns {Element|null}
     */
    findInShadowDOM(selector, root = document.body) {
        // Try regular DOM first
        let element = root.querySelector(selector);
        if (element) return element;

        // Recursively search shadow roots
        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_ELEMENT,
            null
        );

        let node;
        while (node = walker.nextNode()) {
            if (node.shadowRoot) {
                element = node.shadowRoot.querySelector(selector);
                if (element) return element;
                
                // Recursive search in nested shadow DOMs
                element = this.findInShadowDOM(selector, node.shadowRoot);
                if (element) return element;
            }
        }

        return null;
    }

    /**
     * Find all elements including Shadow DOM
     * @param {string} selector - CSS selector
     * @returns {Element[]}
     */
    findAllInShadowDOM(selector, root = document.body) {
        const elements = [];

        // Add regular DOM matches
        elements.push(...root.querySelectorAll(selector));

        // Search in shadow DOMs
        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_ELEMENT,
            null
        );

        let node;
        while (node = walker.nextNode()) {
            if (node.shadowRoot) {
                elements.push(...node.shadowRoot.querySelectorAll(selector));
                elements.push(...this.findAllInShadowDOM(selector, node.shadowRoot));
            }
        }

        return elements;
    }

    /**
     * Fuzzy find element by text content
     * @param {string} searchText - Text to search for
     * @param {number} threshold - Similarity threshold (0-1)
     * @returns {Array<{element: Element, score: number}>}
     */
    fuzzyFindByText(searchText, threshold = 0.6) {
        const searchLower = searchText.toLowerCase();
        const results = [];

        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_ELEMENT,
            null
        );

        let node;
        while (node = walker.nextNode()) {
            const text = node.textContent?.trim().toLowerCase();
            if (!text) continue;

            const score = this.calculateSimilarity(searchLower, text);
            if (score >= threshold) {
                results.push({
                    element: node,
                    score,
                    text: node.textContent.trim()
                });
            }
        }

        // Sort by score (highest first)
        return results.sort((a, b) => b.score - a.score);
    }

    /**
     * Calculate text similarity (Levenshtein distance based)
     * @param {string} str1
     * @param {string} str2
     * @returns {number} Similarity score 0-1
     */
    calculateSimilarity(str1, str2) {
        // Simple substring matching for performance
        if (str2.includes(str1)) {
            return str1.length / str2.length;
        }
        if (str1.includes(str2)) {
            return str2.length / str1.length;
        }

        // Levenshtein distance for more complex matching
        const distance = this.levenshteinDistance(str1, str2);
        const maxLength = Math.max(str1.length, str2.length);
        return 1 - (distance / maxLength);
    }

    /**
     * Levenshtein distance algorithm
     */
    levenshteinDistance(str1, str2) {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    /**
     * Fuzzy find element by attributes
     * @param {Object} attributes - Attributes to match {attr: value}
     * @param {number} threshold - Match threshold
     * @returns {Array<{element: Element, score: number}>}
     */
    fuzzyFindByAttributes(attributes, threshold = 0.7) {
        const results = [];
        const elements = document.querySelectorAll('*');

        elements.forEach(element => {
            let totalScore = 0;
            let matchedAttrs = 0;

            for (const [attr, searchValue] of Object.entries(attributes)) {
                const elementValue = element.getAttribute(attr);
                if (elementValue) {
                    const score = this.calculateSimilarity(
                        searchValue.toLowerCase(),
                        elementValue.toLowerCase()
                    );
                    if (score > 0.5) {
                        totalScore += score;
                        matchedAttrs++;
                    }
                }
            }

            if (matchedAttrs > 0) {
                const avgScore = totalScore / Object.keys(attributes).length;
                if (avgScore >= threshold) {
                    results.push({
                        element,
                        score: avgScore,
                        matchedAttributes: matchedAttrs
                    });
                }
            }
        });

        return results.sort((a, b) => b.score - a.score);
    }

    /**
     * Drag and drop operation
     * @param {Element|string} source - Source element or selector
     * @param {Element|string} target - Target element or selector
     */
    dragAndDrop(source, target) {
        const sourceEl = typeof source === 'string' ? document.querySelector(source) : source;
        const targetEl = typeof target === 'string' ? document.querySelector(target) : target;

        if (!sourceEl || !targetEl) {
            throw new Error('Source or target element not found');
        }

        const dataTransfer = new DataTransfer();

        // Dispatch drag events
        const dragStartEvent = new DragEvent('dragstart', {
            bubbles: true,
            cancelable: true,
            dataTransfer
        });
        sourceEl.dispatchEvent(dragStartEvent);

        const dragEnterEvent = new DragEvent('dragenter', {
            bubbles: true,
            cancelable: true,
            dataTransfer
        });
        targetEl.dispatchEvent(dragEnterEvent);

        const dragOverEvent = new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            dataTransfer
        });
        targetEl.dispatchEvent(dragOverEvent);

        const dropEvent = new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer
        });
        targetEl.dispatchEvent(dropEvent);

        const dragEndEvent = new DragEvent('dragend', {
            bubbles: true,
            cancelable: true,
            dataTransfer
        });
        sourceEl.dispatchEvent(dragEndEvent);

        return { success: true, source: sourceEl, target: targetEl };
    }

    /**
     * Hover over element (simulate mouseover/mouseenter)
     * @param {Element|string} element - Element or selector
     * @param {number} duration - How long to hover (ms)
     */
    async hover(element, duration = 1000) {
        const el = typeof element === 'string' ? document.querySelector(element) : element;
        
        if (!el) {
            throw new Error('Element not found');
        }

        // Dispatch mouse events
        const mouseEnterEvent = new MouseEvent('mouseenter', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        el.dispatchEvent(mouseEnterEvent);

        const mouseOverEvent = new MouseEvent('mouseover', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        el.dispatchEvent(mouseOverEvent);

        // Wait for duration
        if (duration > 0) {
            await new Promise(resolve => setTimeout(resolve, duration));

            const mouseOutEvent = new MouseEvent('mouseout', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            el.dispatchEvent(mouseOutEvent);

            const mouseLeaveEvent = new MouseEvent('mouseleave', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            el.dispatchEvent(mouseLeaveEvent);
        }

        return { success: true, element: el };
    }

    /**
     * Right-click (context menu)
     * @param {Element|string} element - Element or selector
     */
    rightClick(element) {
        const el = typeof element === 'string' ? document.querySelector(element) : element;
        
        if (!el) {
            throw new Error('Element not found');
        }

        const contextMenuEvent = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            view: window,
            button: 2
        });

        el.dispatchEvent(contextMenuEvent);

        return { success: true, element: el };
    }

    /**
     * Send keyboard shortcut
     * @param {string} keys - Key combination (e.g., "Ctrl+C", "Alt+F4")
     * @param {Element} target - Target element (default: activeElement)
     */
    sendKeys(keys, target = document.activeElement) {
        const parts = keys.split('+');
        const modifiers = {
            ctrlKey: false,
            altKey: false,
            shiftKey: false,
            metaKey: false
        };

        let key = parts[parts.length - 1];

        parts.slice(0, -1).forEach(mod => {
            const modLower = mod.toLowerCase();
            if (modLower === 'ctrl' || modLower === 'control') modifiers.ctrlKey = true;
            if (modLower === 'alt') modifiers.altKey = true;
            if (modLower === 'shift') modifiers.shiftKey = true;
            if (modLower === 'meta' || modLower === 'cmd' || modLower === 'win') modifiers.metaKey = true;
        });

        const keyDownEvent = new KeyboardEvent('keydown', {
            key,
            bubbles: true,
            cancelable: true,
            ...modifiers
        });

        const keyPressEvent = new KeyboardEvent('keypress', {
            key,
            bubbles: true,
            cancelable: true,
            ...modifiers
        });

        const keyUpEvent = new KeyboardEvent('keyup', {
            key,
            bubbles: true,
            cancelable: true,
            ...modifiers
        });

        target.dispatchEvent(keyDownEvent);
        target.dispatchEvent(keyPressEvent);
        target.dispatchEvent(keyUpEvent);

        return { success: true, keys, target };
    }

    /**
     * Get element's XPath
     * @param {Element} element
     * @returns {string}
     */
    getXPath(element) {
        if (element.id) {
            return `//*[@id="${element.id}"]`;
        }

        if (element === document.body) {
            return '/html/body';
        }

        let ix = 0;
        const siblings = element.parentNode?.childNodes || [];

        for (let i = 0; i < siblings.length; i++) {
            const sibling = siblings[i];
            if (sibling === element) {
                const parentPath = element.parentNode ? this.getXPath(element.parentNode) : '';
                return `${parentPath}/${element.tagName.toLowerCase()}[${ix + 1}]`;
            }

            if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
                ix++;
            }
        }

        return '';
    }
}

// Export for content script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedDOM;
} else {
    window.EnhancedDOM = EnhancedDOM;
}

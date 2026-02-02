/**
 * Screenshot & Vision Integration
 * Captures screenshots and uses vision models (GPT-4o, Claude) for visual understanding
 */

class ScreenshotVision {
    constructor() {
        this.apiBaseUrl = 'http://localhost:42069';
        this.apiToken = null;
    }

    /**
     * Set API token for authentication
     */
    setApiToken(token) {
        this.apiToken = token;
    }

    /**
     * Capture full page screenshot
     * @param {boolean} fullPage - Whether to capture entire scrollable page
     * @returns {Promise<string>} Base64 encoded image
     */
    async captureFullPage(fullPage = false) {
        try {
            if (fullPage) {
                return await this.captureScrollingScreenshot();
            }

            // Capture visible area only
            const canvas = await this.captureVisibleArea();
            return canvas.toDataURL('image/png');
        } catch (error) {
            console.error('[Screenshot] Capture failed:', error);
            throw error;
        }
    }

    /**
     * Capture only the visible area of the page
     */
    async captureVisibleArea() {
        return new Promise((resolve, reject) => {
            chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                    return;
                }

                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas);
                };
                img.onerror = reject;
                img.src = dataUrl;
            });
        });
    }

    /**
     * Capture entire scrolling page (stitches multiple screenshots)
     */
    async captureScrollingScreenshot() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Get page dimensions
        const dimensions = await chrome.tabs.sendMessage(tab.id, {
            type: 'PAGE_ACTION',
            action: 'getPageDimensions'
        });

        const viewportHeight = dimensions.viewportHeight;
        const totalHeight = dimensions.scrollHeight;
        const viewportWidth = dimensions.viewportWidth;

        // Calculate number of screenshots needed
        const screenshotCount = Math.ceil(totalHeight / viewportHeight);
        const screenshots = [];

        // Scroll and capture each section
        for (let i = 0; i < screenshotCount; i++) {
            const scrollY = i * viewportHeight;

            // Scroll to position
            await chrome.tabs.sendMessage(tab.id, {
                type: 'PAGE_ACTION',
                action: 'scrollTo',
                params: { x: 0, y: scrollY }
            });

            // Wait for scroll to complete
            await new Promise(resolve => setTimeout(resolve, 100));

            // Capture visible area
            const dataUrl = await new Promise((resolve) => {
                chrome.tabs.captureVisibleTab(null, { format: 'png' }, resolve);
            });

            screenshots.push(dataUrl);
        }

        // Stitch screenshots together
        const canvas = await this.stitchScreenshots(screenshots, viewportWidth, totalHeight, viewportHeight);

        // Scroll back to top
        await chrome.tabs.sendMessage(tab.id, {
            type: 'PAGE_ACTION',
            action: 'scrollTo',
            params: { x: 0, y: 0 }
        });

        return canvas.toDataURL('image/png');
    }

    /**
     * Stitch multiple screenshots into one canvas
     */
    async stitchScreenshots(screenshots, width, totalHeight, viewportHeight) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = totalHeight;
        const ctx = canvas.getContext('2d');

        for (let i = 0; i < screenshots.length; i++) {
            const img = await this.loadImage(screenshots[i]);
            const y = i * viewportHeight;
            ctx.drawImage(img, 0, y);
        }

        return canvas;
    }

    /**
     * Load image from data URL
     */
    loadImage(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = dataUrl;
        });
    }

    /**
     * Capture screenshot of a specific element
     * @param {string} selector - CSS selector of element
     */
    async captureElement(selector) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Get element position and dimensions
        const elementInfo = await chrome.tabs.sendMessage(tab.id, {
            type: 'PAGE_ACTION',
            action: 'getElementRect',
            params: { selector }
        });

        if (!elementInfo.success) {
            throw new Error('Element not found');
        }

        // Scroll element into view
        await chrome.tabs.sendMessage(tab.id, {
            type: 'PAGE_ACTION',
            action: 'scrollToElement',
            params: { selector }
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        // Capture full viewport
        const dataUrl = await new Promise((resolve) => {
            chrome.tabs.captureVisibleTab(null, { format: 'png' }, resolve);
        });

        // Crop to element bounds
        const img = await this.loadImage(dataUrl);
        const canvas = document.createElement('canvas');
        const rect = elementInfo.rect;

        // Account for device pixel ratio
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(
            img,
            rect.left * dpr,
            rect.top * dpr,
            rect.width * dpr,
            rect.height * dpr,
            0,
            0,
            rect.width * dpr,
            rect.height * dpr
        );

        return canvas.toDataURL('image/png');
    }

    /**
     * Send screenshot to vision model and get description
     * @param {string} imageBase64 - Base64 encoded image
     * @param {string} prompt - What to analyze
     * @param {string} model - Model to use (gpt-4o, claude-3-5-sonnet)
     * @param {string} provider - Provider (openai, anthropic, google)
     */
    async analyzeWithVision(imageBase64, prompt, model = 'gpt-4o', provider = null) {
        try {
            // Auto-detect provider if not specified
            if (!provider) {
                if (model.startsWith('gpt-')) provider = 'openai';
                else if (model.startsWith('claude-')) provider = 'anthropic';
                else if (model.startsWith('gemini-')) provider = 'google';
                else provider = 'openai'; // default
            }

            const response = await fetch(`${this.apiBaseUrl}/api/vision/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiToken}`
                },
                body: JSON.stringify({
                    image: imageBase64,
                    prompt,
                    model,
                    provider
                })
            });

            if (!response.ok) {
                throw new Error(`Vision API error: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('[Vision] Analysis failed:', error);
            throw error;
        }
    }

    /**
     * Find element by visual description
     * @param {string} description - Natural language description (e.g., "the blue login button")
     * @returns {Promise<{x: number, y: number, selector?: string}>}
     */
    async findElementByDescription(description) {
        // Capture current page
        const screenshot = await this.captureFullPage(false);

        // Ask vision model to locate element
        const prompt = `Find the element matching this description: "${description}". 
        Return the approximate coordinates (x, y) as percentages of the image dimensions.
        Format: {"x": <number>, "y": <number>, "confidence": <0-1>}`;

        const response = await this.analyzeWithVision(screenshot, prompt);

        // Parse coordinates from response
        try {
            const coords = JSON.parse(response.content);
            return {
                x: coords.x,
                y: coords.y,
                confidence: coords.confidence || 0.5
            };
        } catch (error) {
            // Fallback: try to extract coordinates from text
            console.warn('[Vision] Could not parse coordinates, using fallback');
            return null;
        }
    }

    /**
     * Click element by visual description
     * @param {string} description - What to click
     */
    async clickByDescription(description) {
        const coords = await this.findElementByDescription(description);

        if (!coords) {
            throw new Error('Could not locate element');
        }

        // Convert percentage to pixels
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const dimensions = await chrome.tabs.sendMessage(tab.id, {
            type: 'PAGE_ACTION',
            action: 'getPageDimensions'
        });

        const x = (coords.x / 100) * dimensions.viewportWidth;
        const y = (coords.y / 100) * dimensions.viewportHeight;

        // Click at coordinates
        await chrome.tabs.sendMessage(tab.id, {
            type: 'PAGE_ACTION',
            action: 'clickAtCoordinates',
            params: { x, y }
        });

        return { success: true, x, y, confidence: coords.confidence };
    }

    /**
     * Compare two screenshots and detect changes
     * @param {string} before - Base64 image before
     * @param {string} after - Base64 image after
     */
    async detectChanges(before, after) {
        const prompt = `Compare these two screenshots and describe what changed.
        Be specific about added, removed, or modified elements.`;

        const response = await this.analyzeWithVision(
            `${before}\n\n[COMPARISON WITH]\n\n${after}`,
            prompt
        );

        return response.content;
    }

    /**
     * Visual verification - check if action succeeded
     * @param {string} beforeImage - Screenshot before action
     * @param {string} afterImage - Screenshot after action
     * @param {string} expectedChange - What should have changed
     */
    async verifyAction(beforeImage, afterImage, expectedChange) {
        const prompt = `Did this change occur: "${expectedChange}"?
        Compare the before and after screenshots.
        Respond with JSON: {"success": true/false, "confidence": 0-1, "observation": "what actually happened"}`;

        const response = await this.analyzeWithVision(
            `${beforeImage}\n\n[AFTER ACTION]\n\n${afterImage}`,
            prompt
        );

        try {
            return JSON.parse(response.content);
        } catch (error) {
            return {
                success: false,
                confidence: 0,
                observation: response.content
            };
        }
    }

    /**
     * Extract text from image (OCR via vision model)
     */
    async extractText(imageBase64) {
        const prompt = 'Extract all visible text from this image. Preserve formatting and structure.';
        const response = await this.analyzeWithVision(imageBase64, prompt);
        return response.content;
    }

    /**
     * Describe page visually
     */
    async describePage() {
        const screenshot = await this.captureFullPage(true);
        const prompt = `Describe this webpage in detail. Include:
        - Main purpose/type of page
        - Key UI elements and their positions
        - Color scheme and design
        - Important buttons or calls-to-action
        - Any forms or interactive elements`;

        const response = await this.analyzeWithVision(screenshot, prompt);
        return response.content;
    }
}

// Export for background script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScreenshotVision;
} else if (typeof self !== 'undefined') {
    self.ScreenshotVision = ScreenshotVision;
} else if (typeof window !== 'undefined') {
    window.ScreenshotVision = ScreenshotVision;
}

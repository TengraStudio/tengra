/**
 * Page Analyzer - Automatically analyzes page content and suggests actions
 * This runs in the content script context
 */

class PageAnalyzer {
    constructor() {
        this.pageData = null;
    }

    /**
     * Analyze the current page and return actionable insights
     */
    analyze() {
        const data = {
            url: window.location.href,
            title: document.title,
            forms: this.analyzeForms(),
            buttons: this.analyzeButtons(),
            links: this.analyzeLinks(),
            inputs: this.analyzeInputs(),
            tables: this.analyzeTables(),
            images: this.analyzeImages(),
            videos: this.analyzeVideos(),
            suggestions: []
        };

        // Generate smart suggestions based on page content
        data.suggestions = this.generateSuggestions(data);
        
        this.pageData = data;
        return data;
    }

    /**
     * Analyze all forms on the page
     */
    analyzeForms() {
        const forms = Array.from(document.querySelectorAll('form'));
        return forms.map((form, index) => {
            const fields = Array.from(form.querySelectorAll('input, textarea, select'));
            const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
            
            return {
                index,
                id: form.id || `form-${index}`,
                action: form.action,
                method: form.method,
                fieldCount: fields.length,
                fields: fields.map(f => ({
                    type: f.type || f.tagName.toLowerCase(),
                    name: f.name,
                    id: f.id,
                    placeholder: f.placeholder,
                    required: f.required,
                    value: f.type === 'password' ? '[hidden]' : f.value
                })),
                hasSubmit: !!submitButton,
                isLogin: this.isLoginForm(form),
                isSignup: this.isSignupForm(form),
                isSearch: this.isSearchForm(form)
            };
        });
    }

    /**
     * Analyze clickable buttons
     */
    analyzeButtons() {
        const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a.btn, a.button'));
        return buttons.slice(0, 20).map((btn, index) => ({
            index,
            text: btn.textContent?.trim() || btn.value || btn.getAttribute('aria-label') || '',
            type: btn.tagName.toLowerCase(),
            classes: btn.className,
            visible: this.isVisible(btn),
            position: this.getElementPosition(btn)
        })).filter(b => b.text && b.visible);
    }

    /**
     * Analyze important links
     */
    analyzeLinks() {
        const links = Array.from(document.querySelectorAll('a[href]'));
        const importantLinks = links.filter(link => {
            const text = link.textContent?.trim().toLowerCase() || '';
            return text.length > 0 && text.length < 100;
        });
        
        return importantLinks.slice(0, 20).map((link, index) => ({
            index,
            text: link.textContent?.trim(),
            href: link.href,
            isExternal: link.host !== window.location.host
        }));
    }

    /**
     * Analyze input fields
     */
    analyzeInputs() {
        const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea'));
        return inputs.slice(0, 15).map((input, index) => ({
            index,
            type: input.type || 'textarea',
            name: input.name,
            id: input.id,
            placeholder: input.placeholder,
            label: this.findLabel(input)
        }));
    }

    /**
     * Analyze data tables
     */
    analyzeTables() {
        const tables = Array.from(document.querySelectorAll('table'));
        return tables.slice(0, 5).map((table, index) => {
            const rows = table.querySelectorAll('tr').length;
            const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent?.trim());
            
            return {
                index,
                rows,
                cols: headers.length || table.querySelector('tr')?.children.length || 0,
                headers,
                hasData: rows > 1
            };
        });
    }

    /**
     * Analyze images
     */
    analyzeImages() {
        const images = Array.from(document.querySelectorAll('img[src]'));
        return {
            count: images.length,
            visible: images.filter(img => this.isVisible(img)).length
        };
    }

    /**
     * Analyze videos
     */
    analyzeVideos() {
        const videos = Array.from(document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]'));
        return {
            count: videos.length,
            types: videos.map(v => v.tagName.toLowerCase())
        };
    }

    /**
     * Generate smart suggestions based on page analysis
     */
    generateSuggestions(data) {
        const suggestions = [];

        // Login form detected
        if (data.forms.some(f => f.isLogin)) {
            suggestions.push({
                type: 'action',
                priority: 'high',
                icon: '🔐',
                title: 'Fill login form',
                description: 'I can help you fill the login credentials',
                action: 'fillLogin'
            });
        }

        // Signup form detected
        if (data.forms.some(f => f.isSignup)) {
            suggestions.push({
                type: 'action',
                priority: 'high',
                icon: '📝',
                title: 'Fill signup form',
                description: 'I can help you complete the registration',
                action: 'fillSignup'
            });
        }

        // Search form detected
        if (data.forms.some(f => f.isSearch)) {
            suggestions.push({
                type: 'action',
                priority: 'medium',
                icon: '🔍',
                title: 'Perform search',
                description: 'I can search for information on this page',
                action: 'performSearch'
            });
        }

        // Large table detected
        if (data.tables.some(t => t.rows > 10)) {
            suggestions.push({
                type: 'extract',
                priority: 'medium',
                icon: '📊',
                title: 'Extract table data',
                description: `Found ${data.tables.length} table(s) with data`,
                action: 'extractTables'
            });
        }

        // Multiple products/cards detected (common e-commerce pattern)
        const productCards = document.querySelectorAll('[class*="product"], [class*="card"], [class*="item"]');
        if (productCards.length > 5) {
            suggestions.push({
                type: 'extract',
                priority: 'high',
                icon: '🛍️',
                title: 'Extract product list',
                description: `Found ${productCards.length} items on this page`,
                action: 'extractProducts'
            });
        }

        // Videos detected
        if (data.videos.count > 0) {
            suggestions.push({
                type: 'info',
                priority: 'low',
                icon: '🎥',
                title: 'Video detected',
                description: `Found ${data.videos.count} video(s)`,
                action: 'analyzeVideos'
            });
        }

        // Long article detected
        const articleText = document.body.innerText;
        if (articleText.length > 5000) {
            suggestions.push({
                type: 'extract',
                priority: 'high',
                icon: '📄',
                title: 'Summarize article',
                description: 'This page has a lot of text, I can summarize it',
                action: 'summarizePage'
            });
        }

        // Generic suggestions always available
        suggestions.push({
            type: 'info',
            priority: 'low',
            icon: 'ℹ️',
            title: 'Get page info',
            description: 'View detailed page information',
            action: 'getPageInfo'
        });

        suggestions.push({
            type: 'extract',
            priority: 'low',
            icon: '📋',
            title: 'Extract all text',
            description: 'Copy all visible text from this page',
            action: 'extractAllText'
        });

        return suggestions.sort((a, b) => {
            const priority = { high: 0, medium: 1, low: 2 };
            return priority[a.priority] - priority[b.priority];
        });
    }

    // Helper methods

    isLoginForm(form) {
        const html = form.outerHTML.toLowerCase();
        const hasPasswordField = form.querySelector('input[type="password"]');
        const keywords = ['login', 'signin', 'log-in', 'sign-in', 'auth'];
        return hasPasswordField && keywords.some(k => html.includes(k));
    }

    isSignupForm(form) {
        const html = form.outerHTML.toLowerCase();
        const fields = form.querySelectorAll('input').length;
        const keywords = ['signup', 'register', 'sign-up', 'create account', 'join'];
        return fields > 3 && keywords.some(k => html.includes(k));
    }

    isSearchForm(form) {
        const html = form.outerHTML.toLowerCase();
        const hasSearchInput = form.querySelector('input[type="search"]') || 
                              form.querySelector('input[name*="search"], input[placeholder*="search"]');
        const keywords = ['search', 'query', 'find'];
        return hasSearchInput || keywords.some(k => html.includes(k));
    }

    isVisible(element) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && 
               rect.height > 0 && 
               style.display !== 'none' && 
               style.visibility !== 'hidden' &&
               style.opacity !== '0';
    }

    getElementPosition(element) {
        const rect = element.getBoundingClientRect();
        return {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height
        };
    }

    findLabel(input) {
        // Try to find associated label
        if (input.id) {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) return label.textContent?.trim();
        }
        
        // Try parent label
        const parentLabel = input.closest('label');
        if (parentLabel) return parentLabel.textContent?.trim();
        
        // Try previous sibling
        let prev = input.previousElementSibling;
        if (prev && (prev.tagName === 'LABEL' || prev.tagName === 'SPAN')) {
            return prev.textContent?.trim();
        }
        
        return input.placeholder || input.name || '';
    }
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PageAnalyzer;
} else {
    window.PageAnalyzer = PageAnalyzer;
}

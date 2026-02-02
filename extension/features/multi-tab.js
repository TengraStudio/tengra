/**
 * Multi-tab Orchestration Module
 * Manages multiple browser tabs, cross-tab operations, and parallel execution
 * 
 * Features:
 * - Tab creation, closing, switching, grouping
 * - Cross-tab data sharing and messaging
 * - Parallel task execution across tabs
 * - Tab state synchronization
 * - Sequential workflows across multiple tabs
 */

class MultiTabManager {
    constructor() {
        this.activeTabs = new Map(); // tabId -> tab metadata
        this.tabGroups = new Map(); // groupId -> Set<tabId>
        this.sharedContext = new Map(); // key -> value (cross-tab data)
        this.taskQueue = [];
        this.maxParallelTabs = 10; // Safety limit
        this.setupListeners();
    }

    /**
     * Setup tab event listeners
     */
    setupListeners() {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.onCreated.addListener((tab) => {
                this.trackTab(tab);
            });

            chrome.tabs.onRemoved.addListener((tabId) => {
                this.untrackTab(tabId);
            });

            chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
                if (changeInfo.status === 'complete') {
                    this.updateTabMetadata(tabId, tab);
                }
            });
        }
    }

    /**
     * Track a new tab
     */
    trackTab(tab) {
        this.activeTabs.set(tab.id, {
            id: tab.id,
            url: tab.url,
            title: tab.title,
            status: tab.status,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            groupId: null,
            metadata: {}
        });
    }

    /**
     * Remove tab from tracking
     */
    untrackTab(tabId) {
        const tab = this.activeTabs.get(tabId);
        if (tab && tab.groupId) {
            const group = this.tabGroups.get(tab.groupId);
            if (group) {
                group.delete(tabId);
                if (group.size === 0) {
                    this.tabGroups.delete(tab.groupId);
                }
            }
        }
        this.activeTabs.delete(tabId);
    }

    /**
     * Update tab metadata
     */
    updateTabMetadata(tabId, tab) {
        if (this.activeTabs.has(tabId)) {
            const tracked = this.activeTabs.get(tabId);
            tracked.url = tab.url;
            tracked.title = tab.title;
            tracked.status = tab.status;
            tracked.lastActivity = Date.now();
        }
    }

    /**
     * Create a new tab
     */
    async createTab(options = {}) {
        const {
            url,
            active = false,
            groupId = null,
            metadata = {}
        } = options;

        return new Promise((resolve, reject) => {
            chrome.tabs.create({ url, active }, (tab) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                    return;
                }

                this.trackTab(tab);

                if (groupId) {
                    this.addToGroup(groupId, tab.id);
                }

                if (Object.keys(metadata).length > 0) {
                    const tracked = this.activeTabs.get(tab.id);
                    tracked.metadata = { ...tracked.metadata, ...metadata };
                }

                resolve(tab);
            });
        });
    }

    /**
     * Close a tab or multiple tabs
     */
    async closeTabs(tabIds) {
        const ids = Array.isArray(tabIds) ? tabIds : [tabIds];

        return new Promise((resolve, reject) => {
            chrome.tabs.remove(ids, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                    return;
                }
                resolve();
            });
        });
    }

    /**
     * Switch to a specific tab
     */
    async switchToTab(tabId) {
        return new Promise((resolve, reject) => {
            chrome.tabs.update(tabId, { active: true }, (tab) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                    return;
                }
                resolve(tab);
            });
        });
    }

    /**
     * Duplicate a tab with its state
     */
    async duplicateTab(tabId, options = {}) {
        return new Promise((resolve, reject) => {
            chrome.tabs.duplicate(tabId, (duplicatedTab) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                    return;
                }

                // Copy metadata from original tab
                const originalTab = this.activeTabs.get(tabId);
                if (originalTab && originalTab.metadata) {
                    const tracked = this.activeTabs.get(duplicatedTab.id);
                    if (tracked) {
                        tracked.metadata = { ...originalTab.metadata };
                    }
                }

                resolve(duplicatedTab);
            });
        });
    }

    /**
     * Create or add tab to a group
     */
    addToGroup(groupId, tabId) {
        if (!this.tabGroups.has(groupId)) {
            this.tabGroups.set(groupId, new Set());
        }

        this.tabGroups.get(groupId).add(tabId);

        const tab = this.activeTabs.get(tabId);
        if (tab) {
            tab.groupId = groupId;
        }
    }

    /**
     * Get all tabs in a group
     */
    getGroupTabs(groupId) {
        const tabIds = this.tabGroups.get(groupId);
        if (!tabIds) return [];

        return Array.from(tabIds)
            .map(id => this.activeTabs.get(id))
            .filter(Boolean);
    }

    /**
     * Close all tabs in a group
     */
    async closeGroup(groupId) {
        const tabIds = this.tabGroups.get(groupId);
        if (!tabIds || tabIds.size === 0) return;

        await this.closeTabs(Array.from(tabIds));
        this.tabGroups.delete(groupId);
    }

    /**
     * Execute action in a specific tab
     */
    async executeInTab(tabId, action, params = {}) {
        return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(
                tabId,
                { type: 'PAGE_ACTION', action, params },
                (response) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                        return;
                    }
                    resolve(response);
                }
            );
        });
    }

    /**
     * Execute action in all tabs of a group (parallel)
     */
    async executeInGroup(groupId, action, params = {}) {
        const tabs = this.getGroupTabs(groupId);

        const promises = tabs.map(tab =>
            this.executeInTab(tab.id, action, params)
                .then(result => ({ tabId: tab.id, success: true, result }))
                .catch(error => ({ tabId: tab.id, success: false, error: error.message }))
        );

        return Promise.all(promises);
    }

    /**
     * Open multiple URLs and execute tasks in parallel
     */
    async openAndExecute(tasks) {
        if (tasks.length > this.maxParallelTabs) {
            throw new Error(`Too many parallel tabs requested (max: ${this.maxParallelTabs})`);
        }

        const groupId = `batch_${Date.now()}`;
        const results = [];

        for (const task of tasks) {
            const { url, action, params, waitForLoad = true } = task;

            try {
                // Create tab
                const tab = await this.createTab({
                    url,
                    active: false,
                    groupId,
                    metadata: { taskType: action }
                });

                // Wait for page load if needed
                if (waitForLoad) {
                    await this.waitForTabLoad(tab.id);
                }

                // Execute action
                const result = await this.executeInTab(tab.id, action, params);

                results.push({
                    url,
                    tabId: tab.id,
                    success: true,
                    result
                });
            } catch (error) {
                results.push({
                    url,
                    success: false,
                    error: error.message
                });
            }
        }

        return {
            groupId,
            results,
            summary: {
                total: tasks.length,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length
            }
        };
    }

    /**
     * Wait for tab to finish loading
     */
    async waitForTabLoad(tabId, timeout = 30000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            const checkStatus = () => {
                chrome.tabs.get(tabId, (tab) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                        return;
                    }

                    if (tab.status === 'complete') {
                        resolve(tab);
                        return;
                    }

                    if (Date.now() - startTime > timeout) {
                        reject(new Error('Tab load timeout'));
                        return;
                    }

                    setTimeout(checkStatus, 100);
                });
            };

            checkStatus();
        });
    }

    /**
     * Execute sequential workflow across multiple tabs
     */
    async executeWorkflow(workflow) {
        const { steps, shareContext = true } = workflow;
        const results = [];
        let context = {};

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const { url, action, params, useNewTab = false, closeAfter = false } = step;

            try {
                let tabId;

                if (useNewTab || i === 0) {
                    const tab = await this.createTab({ url, active: false });
                    tabId = tab.id;
                    await this.waitForTabLoad(tabId);
                } else {
                    // Reuse previous tab
                    tabId = results[i - 1]?.tabId;
                    if (!tabId) {
                        throw new Error('No tab available for step');
                    }
                }

                // Merge context with params
                const mergedParams = shareContext ? { ...context, ...params } : params;

                // Execute action
                const result = await this.executeInTab(tabId, action, mergedParams);

                // Update shared context
                if (shareContext && result?.data) {
                    context = { ...context, ...result.data };
                }

                results.push({
                    step: i + 1,
                    action,
                    tabId,
                    success: true,
                    result
                });

                // Close tab if requested
                if (closeAfter) {
                    await this.closeTabs(tabId);
                }

            } catch (error) {
                results.push({
                    step: i + 1,
                    action,
                    success: false,
                    error: error.message
                });

                // Stop workflow on error unless configured otherwise
                if (!step.continueOnError) {
                    break;
                }
            }
        }

        return {
            results,
            context,
            summary: {
                total: steps.length,
                completed: results.length,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length
            }
        };
    }

    /**
     * Share data across tabs
     */
    setSharedContext(key, value) {
        this.sharedContext.set(key, value);

        // Broadcast to all tabs
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(
                    tab.id,
                    { type: 'SHARED_CONTEXT_UPDATE', key, value },
                    () => {
                        // Ignore errors for tabs without content script
                        chrome.runtime.lastError;
                    }
                );
            });
        });
    }

    /**
     * Get shared data
     */
    getSharedContext(key) {
        return this.sharedContext.get(key);
    }

    /**
     * Clear shared context
     */
    clearSharedContext() {
        this.sharedContext.clear();
    }

    /**
     * Aggregate results from multiple tabs
     */
    async aggregateFromTabs(tabIds, action, params = {}, aggregator = 'concat') {
        const results = await Promise.all(
            tabIds.map(tabId =>
                this.executeInTab(tabId, action, params)
                    .then(result => ({ tabId, success: true, data: result?.data }))
                    .catch(error => ({ tabId, success: false, error: error.message }))
            )
        );

        const successfulResults = results
            .filter(r => r.success)
            .map(r => r.data);

        let aggregated;
        switch (aggregator) {
            case 'concat':
                aggregated = successfulResults.flat();
                break;
            case 'merge':
                aggregated = Object.assign({}, ...successfulResults);
                break;
            case 'sum':
                aggregated = successfulResults.reduce((sum, val) => sum + (Number(val) || 0), 0);
                break;
            case 'collect':
                aggregated = successfulResults;
                break;
            default:
                aggregated = successfulResults;
        }

        return {
            aggregated,
            results,
            summary: {
                total: tabIds.length,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length
            }
        };
    }

    /**
     * Get all active tabs with metadata
     */
    getAllTabs() {
        return Array.from(this.activeTabs.values());
    }

    /**
     * Search tabs by criteria
     */
    findTabs(criteria = {}) {
        const { url, title, groupId, metadata } = criteria;

        return this.getAllTabs().filter(tab => {
            if (url && !tab.url?.includes(url)) return false;
            if (title && !tab.title?.includes(title)) return false;
            if (groupId && tab.groupId !== groupId) return false;
            if (metadata) {
                for (const [key, value] of Object.entries(metadata)) {
                    if (tab.metadata[key] !== value) return false;
                }
            }
            return true;
        });
    }

    /**
     * Get tab statistics
     */
    getStats() {
        return {
            totalTabs: this.activeTabs.size,
            totalGroups: this.tabGroups.size,
            sharedContextSize: this.sharedContext.size,
            groups: Array.from(this.tabGroups.entries()).map(([id, tabs]) => ({
                groupId: id,
                tabCount: tabs.size
            }))
        };
    }
}

// Export/Define for background worker
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MultiTabManager;
} else if (typeof self !== 'undefined') {
    self.MultiTabManager = MultiTabManager;
    self.multiTabManager = new MultiTabManager();
} else if (typeof window !== 'undefined') {
    window.MultiTabManager = MultiTabManager;
    window.multiTabManager = new MultiTabManager();
}

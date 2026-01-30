/**
 * MCP (Model Context Protocol) Module
 * 
 * This module provides a centralized interface for MCP functionality.
 * It serves as the main entry point for MCP-related operations.
 */

export { McpDispatcher } from './dispatcher';
export type { McpAction, McpResult, McpService } from './types';

/**
 * Available MCP Server Types
 * 
 * This enum defines categories of MCP functionality for future organization.
 */
export enum McpServerType {
    FILESYSTEM = 'filesystem',
    GIT = 'git', 
    SYSTEM = 'system',
    DATABASE = 'database',
    NETWORK = 'network',
    UI = 'ui',
    DOCKER = 'docker',
    SSH = 'ssh',
    WEB = 'web',
    UTILITY = 'utility'
}

/**
 * MCP Module Information
 */
export class McpModule {
    /**
     * Get information about available MCP functionality
     */
    static getInfo() {
        return {
            version: '1.0.0',
            description: 'Model Context Protocol integration for Tandem',
            availableServers: Object.values(McpServerType),
            status: 'active'
        };
    }

    /**
     * Get the display name for an MCP server type
     */
    static getServerDisplayName(type: McpServerType): string {
        const names: Record<McpServerType, string> = {
            [McpServerType.FILESYSTEM]: 'File System Operations',
            [McpServerType.GIT]: 'Git Version Control',
            [McpServerType.SYSTEM]: 'System Commands & Info',
            [McpServerType.DATABASE]: 'Database Operations',
            [McpServerType.NETWORK]: 'Network Utilities',
            [McpServerType.UI]: 'User Interface',
            [McpServerType.DOCKER]: 'Docker Container Management',
            [McpServerType.SSH]: 'SSH Remote Operations',
            [McpServerType.WEB]: 'Web Services & HTTP',
            [McpServerType.UTILITY]: 'General Utilities'
        };
        return names[type];
    }
}

/**
 * Default MCP Configuration
 */
export interface McpConfig {
    /** Enable detailed logging for MCP operations */
    enableLogging: boolean
    
    /** Maximum execution timeout for MCP actions (in milliseconds) */
    defaultTimeout: number
    
    /** Security settings for MCP operations */
    security: {
        /** Allow file system operations */
        allowFileAccess: boolean
        
        /** Allow system command execution */
        allowSystemCommands: boolean
        
        /** Allow network operations */
        allowNetworkAccess: boolean
    }
}

export const DEFAULT_MCP_CONFIG: McpConfig = {
    enableLogging: false,
    defaultTimeout: 30000,
    security: {
        allowFileAccess: true,
        allowSystemCommands: true,
        allowNetworkAccess: true
    }
};
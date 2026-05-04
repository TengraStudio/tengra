/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Unified File & Folder Icon Pack
 * Provides VS Code-style icons for the file explorer
 * Uses react-file-icon for files and Tabler for folders with custom colors
 */

import {
    IconBlocks,
    IconDatabase,
    IconFlask,
    IconFolder,
    IconFolderCheck,
    IconFolderCode,
    IconFolderCog,
    IconFolderDown,
    IconFolderHeart,
    IconFolderOpen,
    IconFolderRoot,
    IconFolders,
    IconFolderSearch,
    IconFolderSymlink,
    IconFolderUp,
    IconGlobe,
    IconLayout,
    IconPalette,
    IconSettings,
    IconStack} from '@tabler/icons-react';
import { DefaultExtensionType, defaultStyles, FileIcon as ReactFileIcon } from 'react-file-icon';

import { useTheme } from '@/hooks/useTheme';
import { resolveCssColorVariable } from '@/lib/theme-css';

type UnsafeValue = ReturnType<typeof JSON.parse>;

export interface IconProps {
    size?: number;
    className?: string;
}

// Custom folder icon config
interface FolderIconConfig {
    icon: UnsafeValue;
    cssVar: string;
}

// Special folder name to icon mapping with CSS variable references
const SPECIAL_FOLDER_ICONS: Record<string, FolderIconConfig> = {
    // Source code
    'src': { icon: IconFolderCode, cssVar: '--icon-source' },
    'source': { icon: IconFolderCode, cssVar: '--icon-source' },
    'lib': { icon: IconFolderCode, cssVar: '--icon-lib' },
    'libs': { icon: IconFolderCode, cssVar: '--icon-lib' },

    // Version control
    '.git': { icon: IconFolderCode, cssVar: '--icon-git' },
    '.github': { icon: IconFolderCode, cssVar: '--icon-github' },
    '.gitlab': { icon: IconFolderCode, cssVar: '--icon-git' },

    // Config
    'config': { icon: IconFolderCog, cssVar: '--icon-config' },
    'configs': { icon: IconFolderCog, cssVar: '--icon-config' },
    '.config': { icon: IconFolderCog, cssVar: '--icon-config' },
    'settings': { icon: IconSettings, cssVar: '--icon-settings' },

    // Components
    'components': { icon: IconBlocks, cssVar: '--icon-components' },
    'component': { icon: IconBlocks, cssVar: '--icon-components' },
    'ui': { icon: IconLayout, cssVar: '--icon-ui' },
    'widgets': { icon: IconBlocks, cssVar: '--icon-components' },

    // Pages / Views
    'pages': { icon: IconLayout, cssVar: '--icon-pages' },
    'views': { icon: IconLayout, cssVar: '--icon-pages' },
    'screens': { icon: IconLayout, cssVar: '--icon-pages' },
    'routes': { icon: IconFolderSymlink, cssVar: '--icon-routes' },

    // API / Services
    'api': { icon: IconGlobe, cssVar: '--icon-api' },
    'apis': { icon: IconGlobe, cssVar: '--icon-api' },
    'services': { icon: IconGlobe, cssVar: '--icon-api' },
    'graphql': { icon: IconGlobe, cssVar: '--icon-graphql' },

    // Tests
    'test': { icon: IconFlask, cssVar: '--icon-test' },
    'tests': { icon: IconFlask, cssVar: '--icon-test' },
    '__tests__': { icon: IconFlask, cssVar: '--icon-test' },
    'spec': { icon: IconFlask, cssVar: '--icon-test' },
    'specs': { icon: IconFlask, cssVar: '--icon-test' },
    'e2e': { icon: IconFlask, cssVar: '--icon-test' },
    'cypress': { icon: IconFlask, cssVar: '--icon-cypress' },
    'playwright': { icon: IconFlask, cssVar: '--icon-playwright' },

    // Build output
    'dist': { icon: IconFolderUp, cssVar: '--icon-build' },
    'build': { icon: IconFolderUp, cssVar: '--icon-build' },
    'out': { icon: IconFolderUp, cssVar: '--icon-build' },
    'output': { icon: IconFolderUp, cssVar: '--icon-build' },
    '.next': { icon: IconFolderUp, cssVar: '--icon-next' },
    '.nuxt': { icon: IconFolderUp, cssVar: '--icon-nuxt' },

    // Dependencies
    'node_modules': { icon: IconFolders, cssVar: '--icon-dependencies' },
    'vendor': { icon: IconFolders, cssVar: '--icon-dependencies' },
    'packages': { icon: IconFolders, cssVar: '--icon-dependencies' },

    // Assets
    'assets': { icon: IconFolderHeart, cssVar: '--icon-assets' },
    'images': { icon: IconFolderHeart, cssVar: '--icon-assets' },
    'img': { icon: IconFolderHeart, cssVar: '--icon-assets' },
    'icons': { icon: IconFolderHeart, cssVar: '--icon-assets' },
    'fonts': { icon: IconFolderHeart, cssVar: '--icon-fonts' },
    'media': { icon: IconFolderHeart, cssVar: '--icon-assets' },

    // Styles
    'styles': { icon: IconPalette, cssVar: '--icon-styles' },
    'css': { icon: IconPalette, cssVar: '--icon-css' },
    'scss': { icon: IconPalette, cssVar: '--icon-scss' },
    'less': { icon: IconPalette, cssVar: '--icon-less' },

    // Public
    'public': { icon: IconFolderRoot, cssVar: '--icon-public' },
    'static': { icon: IconFolderRoot, cssVar: '--icon-public' },

    // Types
    'types': { icon: IconFolderRoot, cssVar: '--icon-types' },
    '@types': { icon: IconFolderRoot, cssVar: '--icon-types' },
    'typings': { icon: IconFolderRoot, cssVar: '--icon-types' },
    'interfaces': { icon: IconFolderRoot, cssVar: '--icon-types' },

    // Hooks / Utils
    'hooks': { icon: IconFolders, cssVar: '--icon-hooks' },
    'composables': { icon: IconFolders, cssVar: '--icon-composables' },
    'utils': { icon: IconFolder, cssVar: '--icon-utils' },
    'utilities': { icon: IconFolder, cssVar: '--icon-utils' },
    'helpers': { icon: IconFolder, cssVar: '--icon-utils' },

    // Data
    'data': { icon: IconDatabase, cssVar: '--icon-data' },
    'database': { icon: IconDatabase, cssVar: '--icon-data' },
    'db': { icon: IconDatabase, cssVar: '--icon-data' },
    'models': { icon: IconDatabase, cssVar: '--icon-data' },
    'schema': { icon: IconDatabase, cssVar: '--icon-data' },
    'migrations': { icon: IconDatabase, cssVar: '--icon-test' },
    'prisma': { icon: IconDatabase, cssVar: '--icon-prisma' },

    // Features / Modules 
    'features': { icon: IconStack, cssVar: '--icon-features' },
    'modules': { icon: IconStack, cssVar: '--icon-features' },
    'domains': { icon: IconStack, cssVar: '--icon-features' },

    // Docs
    'docs': { icon: IconFolderSearch, cssVar: '--icon-docs' },
    'documentation': { icon: IconFolderSearch, cssVar: '--icon-docs' },

    // Security
    '.ssh': { icon: IconFolder, cssVar: '--icon-security' },
    'keys': { icon: IconFolder, cssVar: '--icon-security' },
    'certs': { icon: IconFolder, cssVar: '--icon-security' },
    'secrets': { icon: IconFolder, cssVar: '--icon-security' },

    // Scripts
    'scripts': { icon: IconFolderDown, cssVar: '--icon-scripts' },
    'bin': { icon: IconFolderDown, cssVar: '--icon-scripts' },
    'tools': { icon: IconFolderCog, cssVar: '--icon-tools' },

    // Hidden
    '.vscode': { icon: IconFolderCog, cssVar: '--icon-vscode' },
    '.idea': { icon: IconFolderCog, cssVar: '--icon-idea' },
    '.husky': { icon: IconFolderRoot, cssVar: '--icon-husky' },
    '.cache': { icon: IconFolders, cssVar: '--icon-dependencies' },

    // CI/CD
    '.circleci': { icon: IconFolders, cssVar: '--icon-circleci' },
    '.jenkins': { icon: IconFolders, cssVar: '--icon-jenkins' },
    'workflows': { icon: IconFolderCheck, cssVar: '--icon-workflows' },
};

// Extended file extension mapping with CSS variable references
const EXTENSION_CSS_VAR_MAP: Record<string, string> = {
    'ts': '--icon-ts', 'tsx': '--icon-ts', 'js': '--icon-js', 'jsx': '--icon-jsx',
    'py': '--icon-py', 'ipynb': '--icon-ipynb', 'rs': '--icon-rs', 'go': '--icon-go',
    'rb': '--icon-rb', 'php': '--icon-php', 'java': '--icon-java', 'kt': '--icon-kt',
    'c': '--icon-c', 'h': '--icon-c', 'cpp': '--icon-cpp', 'cs': '--icon-cs',
    'swift': '--icon-swift', 'dart': '--icon-dart', 'html': '--icon-html', 'css': '--icon-css-file',
    'scss': '--icon-scss', 'sass': '--icon-scss', 'vue': '--icon-vue', 'svelte': '--icon-svelte',
    'json': '--icon-json', 'yaml': '--icon-yaml', 'yml': '--icon-yaml', 'xml': '--icon-xml',
    'md': '--icon-md', 'sql': '--icon-sql', 'sh': '--icon-sh',
};

const DEFAULT_ICON_COLOR = 'hsl(215 16% 47%)';
const DEFAULT_ICON_GLYPH_COLOR = 'hsl(0 0% 100% / 0.8)';

// Type mappings for react-file-icon
type FileIconType = 'acrobat' | 'audio' | 'binary' | 'code' | 'compressed' |
    'document' | 'drive' | 'font' | 'image' | 'presentation' | 'settings' |
    'spreadsheet' | 'vector' | 'video' | '3d';

const EXTENSION_TYPE_MAP: Record<string, FileIconType> = {
    'ts': 'code', 'tsx': 'code', 'js': 'code', 'jsx': 'code',
    'py': 'code', 'rb': 'code', 'php': 'code', 'java': 'code',
    'c': 'code', 'cpp': 'code', 'cs': 'code', 'go': 'code',
    'rs': 'code', 'swift': 'code', 'kt': 'code', 'dart': 'code',
    'html': 'code', 'css': 'code', 'scss': 'code', 'vue': 'code',
    'svelte': 'code', 'sql': 'code', 'graphql': 'code', 'sh': 'code',
    'pdf': 'acrobat', 'doc': 'document', 'docx': 'document', 'txt': 'document',
    'md': 'document', 'xls': 'spreadsheet', 'xlsx': 'spreadsheet', 'ppt': 'presentation',
    'png': 'image', 'jpg': 'image', 'jpeg': 'image', 'gif': 'image', 'svg': 'vector',
    'mp4': 'video', 'webm': 'video', 'mp3': 'audio', 'wav': 'audio',
    'zip': 'compressed', 'tar': 'compressed', 'gz': 'compressed',
    'woff': 'font', 'woff2': 'font', 'exe': 'binary', 'so': 'binary',
    'json': 'settings', 'yaml': 'settings', 'yml': 'settings', 'ini': 'settings',
};

function resolveIconColor(variableName: string): string {
    return resolveCssColorVariable(variableName, DEFAULT_ICON_COLOR);
}

/**
 * Get display icon configuration for a folder name
 */
export function getFolderIconInfo(folderName: string, isOpen: boolean = false) {
    const lowerName = folderName.toLowerCase();

    if (lowerName in SPECIAL_FOLDER_ICONS) {
        const config = SPECIAL_FOLDER_ICONS[lowerName];
        return {
            Icon: config.icon,
            color: resolveIconColor(config.cssVar)
        };
    }

    return {
        Icon: isOpen ? IconFolderOpen : IconFolder,
        color: resolveIconColor('--icon-default')
    };
}

/**
 * FolderIcon Component
 */
export function FolderIcon({ folderName, isOpen = false, className = 'w-4 h-4', size = 16 }: { folderName: string; isOpen?: boolean; className?: string; size?: number }) {
    useTheme();
    const { Icon, color } = getFolderIconInfo(folderName, isOpen);
    return <Icon className={className} size={size} style={{ color }} />;
}

/**
 * FileIcon Component
 */
export function FileIcon({ fileName, className = 'w-4 h-4', size = 16 }: { fileName: string; className?: string; size?: number }) {
    useTheme();
    const lowerName = fileName.toLowerCase();
    const ext = lowerName.split('.').pop() ?? '';

    const cssVar = EXTENSION_CSS_VAR_MAP[ext];
    const color = resolveIconColor(cssVar ?? '--icon-default');
    const glyphColor = resolveCssColorVariable('--icon-glyph', DEFAULT_ICON_GLYPH_COLOR);
    const type = EXTENSION_TYPE_MAP[ext];
    const defaultStyle = (ext as DefaultExtensionType) in defaultStyles ? defaultStyles[ext as DefaultExtensionType] : undefined;
    const iconStyle = {
        ...(defaultStyle ?? {}),
        color,
        labelColor: color,
        glyphColor,
    };

    return (
        <div className={`${className} inline-flex items-center justify-center`}>
            <div style={{ width: size, height: size }}>
                <ReactFileIcon
                    extension={ext}
                    type={type}
                    {...iconStyle}
                />
            </div>
        </div>
    );
}

/**
 * Utility for components that need to render either file or folder icon
 */
export function renderIcon(name: string, isDirectory: boolean, isOpen: boolean = false, props: { className?: string; size?: number } = {}) {
    if (isDirectory) {
        return <FolderIcon folderName={name} isOpen={isOpen} className={props.className} size={props.size} />;
    }
    return <FileIcon fileName={name} className={props.className} size={props.size} />;
}

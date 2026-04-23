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
 * Uses react-file-icon for files and Lucide for folders with custom colors
 */

import {
    Blocks,
    Database,
    Folder,
    FolderArchive,
    FolderCheck,
    FolderCode,
    FolderCog,
    FolderDot,
    FolderGit,
    FolderHeart,
    FolderInput,
    FolderKanban,
    FolderKey,
    FolderLock,
    FolderOpen,
    FolderOutput,
    FolderSearch,
    FolderSymlink,
    FolderSync,
    FolderTree,
    Globe,
    Layers,
    Layout,
    type LucideIcon,
    Palette,
    Settings,
    TestTube2
} from 'lucide-react';
import { DefaultExtensionType, defaultStyles, FileIcon as ReactFileIcon } from 'react-file-icon';

import { useTheme } from '@/hooks/useTheme';
import { resolveCssColorVariable } from '@/lib/theme-css';

export interface IconProps {
    size?: number;
    className?: string;
}

// Custom folder icon config
interface FolderIconConfig {
    icon: LucideIcon;
    cssVar: string;
}

// Special folder name to icon mapping with CSS variable references
const SPECIAL_FOLDER_ICONS: Record<string, FolderIconConfig> = {
    // Source code
    'src': { icon: FolderCode, cssVar: '--icon-source' },
    'source': { icon: FolderCode, cssVar: '--icon-source' },
    'lib': { icon: FolderCode, cssVar: '--icon-lib' },
    'libs': { icon: FolderCode, cssVar: '--icon-lib' },

    // Version control
    '.git': { icon: FolderGit, cssVar: '--icon-git' },
    '.github': { icon: FolderGit, cssVar: '--icon-github' },
    '.gitlab': { icon: FolderGit, cssVar: '--icon-git' },

    // Config
    'config': { icon: FolderCog, cssVar: '--icon-config' },
    'configs': { icon: FolderCog, cssVar: '--icon-config' },
    '.config': { icon: FolderCog, cssVar: '--icon-config' },
    'settings': { icon: Settings, cssVar: '--icon-settings' },

    // Components
    'components': { icon: Blocks, cssVar: '--icon-components' },
    'component': { icon: Blocks, cssVar: '--icon-components' },
    'ui': { icon: Layout, cssVar: '--icon-ui' },
    'widgets': { icon: Blocks, cssVar: '--icon-components' },

    // Pages / Views
    'pages': { icon: Layout, cssVar: '--icon-pages' },
    'views': { icon: Layout, cssVar: '--icon-pages' },
    'screens': { icon: Layout, cssVar: '--icon-pages' },
    'routes': { icon: FolderSymlink, cssVar: '--icon-routes' },

    // API / Services
    'api': { icon: Globe, cssVar: '--icon-api' },
    'apis': { icon: Globe, cssVar: '--icon-api' },
    'services': { icon: Globe, cssVar: '--icon-api' },
    'graphql': { icon: Globe, cssVar: '--icon-graphql' },

    // Tests
    'test': { icon: TestTube2, cssVar: '--icon-test' },
    'tests': { icon: TestTube2, cssVar: '--icon-test' },
    '__tests__': { icon: TestTube2, cssVar: '--icon-test' },
    'spec': { icon: TestTube2, cssVar: '--icon-test' },
    'specs': { icon: TestTube2, cssVar: '--icon-test' },
    'e2e': { icon: TestTube2, cssVar: '--icon-test' },
    'cypress': { icon: TestTube2, cssVar: '--icon-cypress' },
    'playwright': { icon: TestTube2, cssVar: '--icon-playwright' },

    // Build output
    'dist': { icon: FolderOutput, cssVar: '--icon-build' },
    'build': { icon: FolderOutput, cssVar: '--icon-build' },
    'out': { icon: FolderOutput, cssVar: '--icon-build' },
    'output': { icon: FolderOutput, cssVar: '--icon-build' },
    '.next': { icon: FolderOutput, cssVar: '--icon-next' },
    '.nuxt': { icon: FolderOutput, cssVar: '--icon-nuxt' },

    // Dependencies
    'node_modules': { icon: FolderArchive, cssVar: '--icon-dependencies' },
    'vendor': { icon: FolderArchive, cssVar: '--icon-dependencies' },
    'packages': { icon: FolderArchive, cssVar: '--icon-dependencies' },

    // Assets
    'assets': { icon: FolderHeart, cssVar: '--icon-assets' },
    'images': { icon: FolderHeart, cssVar: '--icon-assets' },
    'img': { icon: FolderHeart, cssVar: '--icon-assets' },
    'icons': { icon: FolderHeart, cssVar: '--icon-assets' },
    'fonts': { icon: FolderHeart, cssVar: '--icon-fonts' },
    'media': { icon: FolderHeart, cssVar: '--icon-assets' },

    // Styles
    'styles': { icon: Palette, cssVar: '--icon-styles' },
    'css': { icon: Palette, cssVar: '--icon-css' },
    'scss': { icon: Palette, cssVar: '--icon-scss' },
    'less': { icon: Palette, cssVar: '--icon-less' },

    // Public
    'public': { icon: FolderTree, cssVar: '--icon-public' },
    'static': { icon: FolderTree, cssVar: '--icon-public' },

    // Types
    'types': { icon: FolderDot, cssVar: '--icon-types' },
    '@types': { icon: FolderDot, cssVar: '--icon-types' },
    'typings': { icon: FolderDot, cssVar: '--icon-types' },
    'interfaces': { icon: FolderDot, cssVar: '--icon-types' },

    // Hooks / Utils
    'hooks': { icon: FolderSync, cssVar: '--icon-hooks' },
    'composables': { icon: FolderSync, cssVar: '--icon-composables' },
    'utils': { icon: FolderKanban, cssVar: '--icon-utils' },
    'utilities': { icon: FolderKanban, cssVar: '--icon-utils' },
    'helpers': { icon: FolderKanban, cssVar: '--icon-utils' },

    // Data
    'data': { icon: Database, cssVar: '--icon-data' },
    'database': { icon: Database, cssVar: '--icon-data' },
    'db': { icon: Database, cssVar: '--icon-data' },
    'models': { icon: Database, cssVar: '--icon-data' },
    'schema': { icon: Database, cssVar: '--icon-data' },
    'migrations': { icon: Database, cssVar: '--icon-test' },
    'prisma': { icon: Database, cssVar: '--icon-prisma' },

    // Features / Modules 
    'features': { icon: Layers, cssVar: '--icon-features' },
    'modules': { icon: Layers, cssVar: '--icon-features' },
    'domains': { icon: Layers, cssVar: '--icon-features' },

    // Docs
    'docs': { icon: FolderSearch, cssVar: '--icon-docs' },
    'documentation': { icon: FolderSearch, cssVar: '--icon-docs' },

    // Security
    '.ssh': { icon: FolderKey, cssVar: '--icon-security' },
    'keys': { icon: FolderKey, cssVar: '--icon-security' },
    'certs': { icon: FolderLock, cssVar: '--icon-security' },
    'secrets': { icon: FolderLock, cssVar: '--icon-security' },

    // Scripts
    'scripts': { icon: FolderInput, cssVar: '--icon-scripts' },
    'bin': { icon: FolderInput, cssVar: '--icon-scripts' },
    'tools': { icon: FolderCog, cssVar: '--icon-tools' },

    // Hidden
    '.vscode': { icon: FolderCog, cssVar: '--icon-vscode' },
    '.idea': { icon: FolderCog, cssVar: '--icon-idea' },
    '.husky': { icon: FolderDot, cssVar: '--icon-husky' },
    '.cache': { icon: FolderArchive, cssVar: '--icon-dependencies' },

    // CI/CD
    '.circleci': { icon: FolderSync, cssVar: '--icon-circleci' },
    '.jenkins': { icon: FolderSync, cssVar: '--icon-jenkins' },
    'workflows': { icon: FolderCheck, cssVar: '--icon-workflows' },
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
        Icon: isOpen ? FolderOpen : Folder,
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

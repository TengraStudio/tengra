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

// Fallback colors for SSR and when CSS vars are not available
const EXTENSION_COLOR_FALLBACKS: Record<string, string> = {
    'ts': '#3178C6', 'tsx': '#3178C6', 'js': '#F7DF1E', 'jsx': '#61DAFB',
    'py': '#3776AB', 'ipynb': '#F37626', 'rs': '#DEA584', 'go': '#00ADD8',
    'rb': '#CC342D', 'php': '#777BB4', 'java': '#ED8B00', 'kt': '#7F52FF',
    'c': '#A8B9CC', 'h': '#A8B9CC', 'cpp': '#00599C', 'cs': '#512BD4',
    'swift': '#F05138', 'dart': '#0175C2', 'html': '#E34F26', 'css': '#1572B6',
    'scss': '#CF649A', 'sass': '#CF649A', 'vue': '#42B883', 'svelte': '#FF3E00',
    'json': '#000000', 'yaml': '#CB171E', 'yml': '#CB171E', 'xml': '#0060AC',
    'md': '#083FA1', 'sql': '#CC2927', 'sh': '#4EAA25',
};

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

/**
 * Helper to get CSS variable value
 */
function getCSSVariableValue(variableName: string): string {
    if (typeof window === 'undefined') {
        // Fallback for SSR - return hex colors based on variable name
        const fallbacks: Record<string, string> = {
            '--icon-source': '#3B82F6',
            '--icon-lib': '#6366F1',
            '--icon-git': '#F97316',
            '--icon-github': '#6366F1',
            '--icon-config': '#8B5CF6',
            '--icon-settings': '#8B5CF6',
            '--icon-components': '#22C55E',
            '--icon-ui': '#22C55E',
            '--icon-pages': '#3B82F6',
            '--icon-routes': '#3B82F6',
            '--icon-api': '#EC4899',
            '--icon-graphql': '#E10098',
            '--icon-test': '#F59E0B',
            '--icon-cypress': '#17202C',
            '--icon-playwright': '#2EAD33',
            '--icon-build': '#6B7280',
            '--icon-next': '#000000',
            '--icon-nuxt': '#00DC82',
            '--icon-dependencies': '#6B7280',
            '--icon-assets': '#EF4444',
            '--icon-fonts': '#8B5CF6',
            '--icon-styles': '#EC4899',
            '--icon-css': '#38BDF8',
            '--icon-scss': '#CF649A',
            '--icon-less': '#1D365D',
            '--icon-public': '#10B981',
            '--icon-types': '#3178C6',
            '--icon-hooks': '#61DAFB',
            '--icon-composables': '#42B883',
            '--icon-utils': '#6366F1',
            '--icon-data': '#0EA5E9',
            '--icon-prisma': '#2D3748',
            '--icon-features': '#8B5CF6',
            '--icon-docs': '#10B981',
            '--icon-security': '#EF4444',
            '--icon-scripts': '#22C55E',
            '--icon-tools': '#6B7280',
            '--icon-vscode': '#0078D4',
            '--icon-idea': '#000000',
            '--icon-husky': '#42B883',
            '--icon-circleci': '#343434',
            '--icon-jenkins': '#D24939',
            '--icon-workflows': '#2088FF',
            '--icon-default': '#60A5FA'
        };
        return fallbacks[variableName] ?? '#6B7280';
    }

    const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
    if (value) {
        // Convert HSL to hex if needed
        if (value.includes(' ')) {
            return `hsl(${value})`;
        }
        return value;
    }
    return '#6B7280';
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
            color: getCSSVariableValue(config.cssVar)
        };
    }

    return {
        Icon: isOpen ? FolderOpen : Folder,
        color: getCSSVariableValue('--icon-default')
    };
}

/**
 * FolderIcon Component
 */
export function FolderIcon({ folderName, isOpen = false, className = 'w-4 h-4', size = 16 }: { folderName: string; isOpen?: boolean; className?: string; size?: number }) {
    const { Icon, color } = getFolderIconInfo(folderName, isOpen);
    return <Icon className={className} size={size} style={{ color }} />;
}

/**
 * FileIcon Component
 */
export function FileIcon({ fileName, className = 'w-4 h-4', size = 16 }: { fileName: string; className?: string; size?: number }) {
    const lowerName = fileName.toLowerCase();
    const ext = lowerName.split('.').pop() ?? '';

    const cssVar = EXTENSION_CSS_VAR_MAP[ext];
    const color = cssVar ? getCSSVariableValue(cssVar) : (EXTENSION_COLOR_FALLBACKS[ext] ?? '#6B7280');
    const type = EXTENSION_TYPE_MAP[ext];
    const defaultStyle = (ext as DefaultExtensionType) in defaultStyles ? defaultStyles[ext as DefaultExtensionType] : undefined;

    return (
        <div className={className} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: size, height: size }}>
                <ReactFileIcon
                    extension={ext}
                    color={color}
                    type={type}
                    labelColor={color}
                    glyphColor="rgba(255,255,255,0.8)"
                    {...(defaultStyle ?? {})}
                    // @ts-expect-error - ReactFileIcon width prop typing
                    width={size}
                    height={size}
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

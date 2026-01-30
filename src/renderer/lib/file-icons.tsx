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
    color: string;
}

// Special folder name to icon mapping
const SPECIAL_FOLDER_ICONS: Record<string, FolderIconConfig> = {
    // Source code
    'src': { icon: FolderCode, color: '#3B82F6' },
    'source': { icon: FolderCode, color: '#3B82F6' },
    'lib': { icon: FolderCode, color: '#6366F1' },
    'libs': { icon: FolderCode, color: '#6366F1' },

    // Version control
    '.git': { icon: FolderGit, color: '#F97316' },
    '.github': { icon: FolderGit, color: '#6366F1' },
    '.gitlab': { icon: FolderGit, color: '#F97316' },

    // Config
    'config': { icon: FolderCog, color: '#8B5CF6' },
    'configs': { icon: FolderCog, color: '#8B5CF6' },
    '.config': { icon: FolderCog, color: '#8B5CF6' },
    'settings': { icon: Settings, color: '#8B5CF6' },

    // Components
    'components': { icon: Blocks, color: '#22C55E' },
    'component': { icon: Blocks, color: '#22C55E' },
    'ui': { icon: Layout, color: '#22C55E' },
    'widgets': { icon: Blocks, color: '#22C55E' },

    // Pages / Views
    'pages': { icon: Layout, color: '#3B82F6' },
    'views': { icon: Layout, color: '#3B82F6' },
    'screens': { icon: Layout, color: '#3B82F6' },
    'routes': { icon: FolderSymlink, color: '#3B82F6' },

    // API / Services
    'api': { icon: Globe, color: '#EC4899' },
    'apis': { icon: Globe, color: '#EC4899' },
    'services': { icon: Globe, color: '#EC4899' },
    'graphql': { icon: Globe, color: '#E10098' },

    // Tests
    'test': { icon: TestTube2, color: '#F59E0B' },
    'tests': { icon: TestTube2, color: '#F59E0B' },
    '__tests__': { icon: TestTube2, color: '#F59E0B' },
    'spec': { icon: TestTube2, color: '#F59E0B' },
    'specs': { icon: TestTube2, color: '#F59E0B' },
    'e2e': { icon: TestTube2, color: '#F59E0B' },
    'cypress': { icon: TestTube2, color: '#17202C' },
    'playwright': { icon: TestTube2, color: '#2EAD33' },

    // Build output
    'dist': { icon: FolderOutput, color: '#6B7280' },
    'build': { icon: FolderOutput, color: '#6B7280' },
    'out': { icon: FolderOutput, color: '#6B7280' },
    'output': { icon: FolderOutput, color: '#6B7280' },
    '.next': { icon: FolderOutput, color: '#000000' },
    '.nuxt': { icon: FolderOutput, color: '#00DC82' },

    // Dependencies
    'node_modules': { icon: FolderArchive, color: '#6B7280' },
    'vendor': { icon: FolderArchive, color: '#6B7280' },
    'packages': { icon: FolderArchive, color: '#6B7280' },

    // Assets
    'assets': { icon: FolderHeart, color: '#EF4444' },
    'images': { icon: FolderHeart, color: '#EF4444' },
    'img': { icon: FolderHeart, color: '#EF4444' },
    'icons': { icon: FolderHeart, color: '#EF4444' },
    'fonts': { icon: FolderHeart, color: '#8B5CF6' },
    'media': { icon: FolderHeart, color: '#EF4444' },

    // Styles
    'styles': { icon: Palette, color: '#EC4899' },
    'css': { icon: Palette, color: '#38BDF8' },
    'scss': { icon: Palette, color: '#CF649A' },
    'less': { icon: Palette, color: '#1D365D' },

    // Public
    'public': { icon: FolderTree, color: '#10B981' },
    'static': { icon: FolderTree, color: '#10B981' },

    // Types
    'types': { icon: FolderDot, color: '#3178C6' },
    '@types': { icon: FolderDot, color: '#3178C6' },
    'typings': { icon: FolderDot, color: '#3178C6' },
    'interfaces': { icon: FolderDot, color: '#3178C6' },

    // Hooks / Utils
    'hooks': { icon: FolderSync, color: '#61DAFB' },
    'composables': { icon: FolderSync, color: '#42B883' },
    'utils': { icon: FolderKanban, color: '#6366F1' },
    'utilities': { icon: FolderKanban, color: '#6366F1' },
    'helpers': { icon: FolderKanban, color: '#6366F1' },

    // Data
    'data': { icon: Database, color: '#0EA5E9' },
    'database': { icon: Database, color: '#0EA5E9' },
    'db': { icon: Database, color: '#0EA5E9' },
    'models': { icon: Database, color: '#0EA5E9' },
    'schema': { icon: Database, color: '#0EA5E9' },
    'migrations': { icon: Database, color: '#F59E0B' },
    'prisma': { icon: Database, color: '#2D3748' },

    // Features / Modules 
    'features': { icon: Layers, color: '#8B5CF6' },
    'modules': { icon: Layers, color: '#8B5CF6' },
    'domains': { icon: Layers, color: '#8B5CF6' },

    // Docs
    'docs': { icon: FolderSearch, color: '#10B981' },
    'documentation': { icon: FolderSearch, color: '#10B981' },

    // Security
    '.ssh': { icon: FolderKey, color: '#EF4444' },
    'keys': { icon: FolderKey, color: '#EF4444' },
    'certs': { icon: FolderLock, color: '#EF4444' },
    'secrets': { icon: FolderLock, color: '#EF4444' },

    // Scripts
    'scripts': { icon: FolderInput, color: '#22C55E' },
    'bin': { icon: FolderInput, color: '#22C55E' },
    'tools': { icon: FolderCog, color: '#6B7280' },

    // Hidden
    '.vscode': { icon: FolderCog, color: '#0078D4' },
    '.idea': { icon: FolderCog, color: '#000000' },
    '.husky': { icon: FolderDot, color: '#42B883' },
    '.cache': { icon: FolderArchive, color: '#6B7280' },

    // CI/CD
    '.circleci': { icon: FolderSync, color: '#343434' },
    '.jenkins': { icon: FolderSync, color: '#D24939' },
    'workflows': { icon: FolderCheck, color: '#2088FF' },
};

// Extended file extension mapping for proper colors
const EXTENSION_COLOR_MAP: Record<string, string> = {
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
 * Get display icon configuration for a folder name
 */
export function getFolderIconInfo(folderName: string, isOpen: boolean = false) {
    const lowerName = folderName.toLowerCase();
    const config = SPECIAL_FOLDER_ICONS[lowerName];

    if (config) {
        return {
            Icon: config.icon,
            color: config.color
        };
    }

    return {
        Icon: isOpen ? FolderOpen : Folder,
        color: '#60A5FA'
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

    const color = EXTENSION_COLOR_MAP[ext] ?? '#6B7280';
    const type = EXTENSION_TYPE_MAP[ext];
    const defaultStyle = defaultStyles[ext as DefaultExtensionType];

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

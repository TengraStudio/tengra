/**
 * File & Folder Icon Pack
 * Returns appropriate icons and colors based on file extension
 */
import {
    File,
    FileCode,
    FileText,
    FileJson,
    FileImage,
    FileVideo,
    FileAudio,
    FileArchive,
    FileSpreadsheet,
    Folder,
    FolderOpen,
    FolderGit2,
    Database,
    Settings,
    Terminal,
    Package,
    Lock,
    Key,
    Globe,
    Cpu,
    BookOpen,
    Braces,
    type LucideIcon
} from 'lucide-react'


export interface FileIconInfo {
    icon: LucideIcon
    color: string
    bgColor: string
}

// Extension to icon mapping
const FILE_ICONS: Record<string, FileIconInfo> = {
    // TypeScript/JavaScript
    ts: { icon: FileCode, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    tsx: { icon: FileCode, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    js: { icon: FileCode, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
    jsx: { icon: FileCode, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
    mjs: { icon: FileCode, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
    cjs: { icon: FileCode, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },

    // Python
    py: { icon: FileCode, color: 'text-green-400', bgColor: 'bg-green-500/10' },
    pyw: { icon: FileCode, color: 'text-green-400', bgColor: 'bg-green-500/10' },
    pyx: { icon: FileCode, color: 'text-green-400', bgColor: 'bg-green-500/10' },

    // Go
    go: { icon: FileCode, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },

    // Rust
    rs: { icon: FileCode, color: 'text-orange-400', bgColor: 'bg-orange-500/10' },

    // C/C++
    c: { icon: FileCode, color: 'text-blue-300', bgColor: 'bg-blue-400/10' },
    cpp: { icon: FileCode, color: 'text-blue-300', bgColor: 'bg-blue-400/10' },
    cc: { icon: FileCode, color: 'text-blue-300', bgColor: 'bg-blue-400/10' },
    h: { icon: FileCode, color: 'text-purple-300', bgColor: 'bg-purple-400/10' },
    hpp: { icon: FileCode, color: 'text-purple-300', bgColor: 'bg-purple-400/10' },

    // Java/Kotlin
    java: { icon: FileCode, color: 'text-red-400', bgColor: 'bg-red-500/10' },
    kt: { icon: FileCode, color: 'text-violet-400', bgColor: 'bg-violet-500/10' },
    kts: { icon: FileCode, color: 'text-violet-400', bgColor: 'bg-violet-500/10' },

    // Ruby
    rb: { icon: FileCode, color: 'text-red-300', bgColor: 'bg-red-400/10' },

    // PHP
    php: { icon: FileCode, color: 'text-indigo-400', bgColor: 'bg-indigo-500/10' },

    // Shell
    sh: { icon: Terminal, color: 'text-green-300', bgColor: 'bg-green-400/10' },
    bash: { icon: Terminal, color: 'text-green-300', bgColor: 'bg-green-400/10' },
    zsh: { icon: Terminal, color: 'text-green-300', bgColor: 'bg-green-400/10' },
    fish: { icon: Terminal, color: 'text-green-300', bgColor: 'bg-green-400/10' },
    ps1: { icon: Terminal, color: 'text-blue-300', bgColor: 'bg-blue-400/10' },
    bat: { icon: Terminal, color: 'text-green-300', bgColor: 'bg-green-400/10' },
    cmd: { icon: Terminal, color: 'text-green-300', bgColor: 'bg-green-400/10' },

    // Web
    html: { icon: Globe, color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
    htm: { icon: Globe, color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
    css: { icon: Braces, color: 'text-pink-400', bgColor: 'bg-pink-500/10' },
    scss: { icon: Braces, color: 'text-pink-400', bgColor: 'bg-pink-500/10' },
    sass: { icon: Braces, color: 'text-pink-400', bgColor: 'bg-pink-500/10' },
    less: { icon: Braces, color: 'text-indigo-400', bgColor: 'bg-indigo-500/10' },
    vue: { icon: FileCode, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
    svelte: { icon: FileCode, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },

    // Data
    json: { icon: FileJson, color: 'text-yellow-300', bgColor: 'bg-yellow-400/10' },
    jsonc: { icon: FileJson, color: 'text-yellow-300', bgColor: 'bg-yellow-400/10' },
    yaml: { icon: FileText, color: 'text-red-300', bgColor: 'bg-red-400/10' },
    yml: { icon: FileText, color: 'text-red-300', bgColor: 'bg-red-400/10' },
    toml: { icon: FileText, color: 'text-gray-300', bgColor: 'bg-gray-400/10' },
    xml: { icon: FileCode, color: 'text-orange-300', bgColor: 'bg-orange-400/10' },
    csv: { icon: FileSpreadsheet, color: 'text-green-400', bgColor: 'bg-green-500/10' },

    // Database
    sql: { icon: Database, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    sqlite: { icon: Database, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    db: { icon: Database, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },

    // Documentation
    md: { icon: BookOpen, color: 'text-emerald-300', bgColor: 'bg-emerald-400/10' },
    mdx: { icon: BookOpen, color: 'text-emerald-300', bgColor: 'bg-emerald-400/10' },
    txt: { icon: FileText, color: 'text-zinc-400', bgColor: 'bg-zinc-500/10' },
    rtf: { icon: FileText, color: 'text-zinc-400', bgColor: 'bg-zinc-500/10' },
    pdf: { icon: FileText, color: 'text-red-400', bgColor: 'bg-red-500/10' },
    doc: { icon: FileText, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    docx: { icon: FileText, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },

    // Images
    png: { icon: FileImage, color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
    jpg: { icon: FileImage, color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
    jpeg: { icon: FileImage, color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
    gif: { icon: FileImage, color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
    svg: { icon: FileImage, color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
    ico: { icon: FileImage, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    webp: { icon: FileImage, color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
    bmp: { icon: FileImage, color: 'text-purple-400', bgColor: 'bg-purple-500/10' },

    // Video
    mp4: { icon: FileVideo, color: 'text-pink-400', bgColor: 'bg-pink-500/10' },
    webm: { icon: FileVideo, color: 'text-pink-400', bgColor: 'bg-pink-500/10' },
    mov: { icon: FileVideo, color: 'text-pink-400', bgColor: 'bg-pink-500/10' },
    avi: { icon: FileVideo, color: 'text-pink-400', bgColor: 'bg-pink-500/10' },
    mkv: { icon: FileVideo, color: 'text-pink-400', bgColor: 'bg-pink-500/10' },

    // Audio
    mp3: { icon: FileAudio, color: 'text-green-400', bgColor: 'bg-green-500/10' },
    wav: { icon: FileAudio, color: 'text-green-400', bgColor: 'bg-green-500/10' },
    ogg: { icon: FileAudio, color: 'text-green-400', bgColor: 'bg-green-500/10' },
    flac: { icon: FileAudio, color: 'text-green-400', bgColor: 'bg-green-500/10' },
    m4a: { icon: FileAudio, color: 'text-green-400', bgColor: 'bg-green-500/10' },

    // Archives
    zip: { icon: FileArchive, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
    rar: { icon: FileArchive, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
    tar: { icon: FileArchive, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
    gz: { icon: FileArchive, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
    '7z': { icon: FileArchive, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },

    // Config
    env: { icon: Key, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
    lock: { icon: Lock, color: 'text-red-400', bgColor: 'bg-red-500/10' },
    ini: { icon: Settings, color: 'text-zinc-400', bgColor: 'bg-zinc-500/10' },
    cfg: { icon: Settings, color: 'text-zinc-400', bgColor: 'bg-zinc-500/10' },
    conf: { icon: Settings, color: 'text-zinc-400', bgColor: 'bg-zinc-500/10' },

    // Binary/Compiled
    exe: { icon: Cpu, color: 'text-red-400', bgColor: 'bg-red-500/10' },
    dll: { icon: Cpu, color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
    so: { icon: Cpu, color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
    wasm: { icon: Cpu, color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
}

// Special file names
const SPECIAL_FILES: Record<string, FileIconInfo> = {
    'package.json': { icon: Package, color: 'text-red-400', bgColor: 'bg-red-500/10' },
    'package-lock.json': { icon: Lock, color: 'text-red-400', bgColor: 'bg-red-500/10' },
    'yarn.lock': { icon: Lock, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    'pnpm-lock.yaml': { icon: Lock, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
    'tsconfig.json': { icon: Settings, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    'jsconfig.json': { icon: Settings, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
    '.gitignore': { icon: FolderGit2, color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
    '.env': { icon: Key, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
    '.env.local': { icon: Key, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
    '.env.development': { icon: Key, color: 'text-green-400', bgColor: 'bg-green-500/10' },
    '.env.production': { icon: Key, color: 'text-red-400', bgColor: 'bg-red-500/10' },
    'Dockerfile': { icon: Package, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    'docker-compose.yml': { icon: Package, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    'docker-compose.yaml': { icon: Package, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    'README.md': { icon: BookOpen, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
    'LICENSE': { icon: FileText, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
    'Makefile': { icon: Terminal, color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
    '.prettierrc': { icon: Settings, color: 'text-pink-400', bgColor: 'bg-pink-500/10' },
    '.eslintrc': { icon: Settings, color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
    'vite.config.ts': { icon: Settings, color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
    'tailwind.config.js': { icon: Settings, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },
    'next.config.js': { icon: Settings, color: 'text-white', bgColor: 'bg-zinc-500/10' },
}

// Folder names to special icons
const SPECIAL_FOLDERS: Record<string, FileIconInfo> = {
    node_modules: { icon: Folder, color: 'text-green-400/50', bgColor: 'bg-green-500/5' },
    '.git': { icon: FolderGit2, color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
    '.vscode': { icon: Folder, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    '.idea': { icon: Folder, color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
    src: { icon: Folder, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    dist: { icon: Folder, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
    build: { icon: Folder, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
    out: { icon: Folder, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
    public: { icon: Folder, color: 'text-green-400', bgColor: 'bg-green-500/10' },
    assets: { icon: Folder, color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
    components: { icon: Folder, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },
    pages: { icon: Folder, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
    lib: { icon: Folder, color: 'text-indigo-400', bgColor: 'bg-indigo-500/10' },
    utils: { icon: Folder, color: 'text-indigo-400', bgColor: 'bg-indigo-500/10' },
    hooks: { icon: Folder, color: 'text-pink-400', bgColor: 'bg-pink-500/10' },
    styles: { icon: Folder, color: 'text-pink-400', bgColor: 'bg-pink-500/10' },
    api: { icon: Folder, color: 'text-green-400', bgColor: 'bg-green-500/10' },
    config: { icon: Folder, color: 'text-zinc-400', bgColor: 'bg-zinc-500/10' },
    tests: { icon: Folder, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
    __tests__: { icon: Folder, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
    test: { icon: Folder, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
    spec: { icon: Folder, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
}

const DEFAULT_FILE: FileIconInfo = { icon: File, color: 'text-zinc-400', bgColor: 'bg-zinc-500/10' }
const DEFAULT_FOLDER: FileIconInfo = { icon: Folder, color: 'text-blue-400', bgColor: 'bg-blue-500/10' }
const OPEN_FOLDER: FileIconInfo = { icon: FolderOpen, color: 'text-blue-400', bgColor: 'bg-blue-500/10' }

/**
 * Get icon info for a file based on its name
 */
export function getFileIcon(fileName: string): FileIconInfo {
    const lowerName = fileName.toLowerCase()

    // Check special file names first
    if (SPECIAL_FILES[lowerName]) {
        return SPECIAL_FILES[lowerName]
    }

    // Check exact matches with common special files
    for (const [pattern, info] of Object.entries(SPECIAL_FILES)) {
        if (lowerName === pattern.toLowerCase()) {
            return info
        }
    }

    // Get extension
    const lastDot = fileName.lastIndexOf('.')
    if (lastDot > 0) {
        const ext = fileName.slice(lastDot + 1).toLowerCase()
        if (FILE_ICONS[ext]) {
            return FILE_ICONS[ext]
        }
    }

    return DEFAULT_FILE
}

/**
 * Get icon info for a folder based on its name
 */
export function getFolderIcon(folderName: string, isOpen: boolean = false): FileIconInfo {
    const lowerName = folderName.toLowerCase()

    if (SPECIAL_FOLDERS[lowerName]) {
        const info = SPECIAL_FOLDERS[lowerName]
        return isOpen ? { ...info, icon: FolderOpen } : info
    }

    return isOpen ? OPEN_FOLDER : DEFAULT_FOLDER
}

/**
 * Render a file icon component
 */
export function FileIcon({ fileName, className = 'w-4 h-4' }: { fileName: string; className?: string }) {
    const { icon: Icon, color } = getFileIcon(fileName)
    return <Icon className={`${className} ${color}`} />
}

/**
 * Render a folder icon component
 */
export function FolderIcon({ folderName, isOpen = false, className = 'w-4 h-4' }: { folderName: string; isOpen?: boolean; className?: string }) {
    const { icon: Icon, color } = getFolderIcon(folderName, isOpen)
    return <Icon className={`${className} ${color}`} />
}

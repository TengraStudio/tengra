# Advanced Terminal System V2 - Architecture Design

## 🎯 Vision
Transform Tandem's terminal from a simple tab into a **first-class, production-grade terminal system** that rivals standalone terminals like Ghostty, Alacritty, Warp, and WezTerm.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Terminal UI Layer                         │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Standalone │  │   Floating   │  │  Integrated  │       │
│  │   Window    │  │   Overlay    │  │   Project    │       │
│  │             │  │  (` hotkey)  │  │     Tab      │       │
│  └─────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              Terminal Session Manager                        │
│  • Session persistence (restore on restart)                  │
│  • Profile management (custom shells, envs, themes)          │
│  • Workspace integration (per-project terminals)             │
│  • Split panes & tab management                              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│           Abstract Terminal Backend Interface                │
│  interface ITerminalBackend {                                │
│    spawn(options): TerminalInstance                          │
│    getCapabilities(): BackendCapabilities                    │
│    supportsGPU(): boolean                                    │
│  }                                                            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                  Terminal Backends                           │
│  ┌───────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐ │
│  │  Ghostty  │  │ Alacritty │  │   Warp   │  │ WezTerm  │ │
│  │ (primary) │  │           │  │          │  │          │ │
│  └───────────┘  └───────────┘  └──────────┘  └──────────┘ │
│  ┌───────────┐  ┌───────────┐  ┌──────────┐               │
│  │  Windows  │  │   Kitty   │  │ xterm.js │               │
│  │ Terminal  │  │           │  │(fallback)│               │
│  └───────────┘  └───────────┘  └──────────┘               │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Component Breakdown

### 1. Terminal Backend Interface (`ITerminalBackend`)

```typescript
/**
 * Abstract interface for terminal backends
 * Allows pluggable terminal implementations
 */
export interface ITerminalBackend {
    // Identification
    readonly id: string;
    readonly name: string;
    readonly version: string;

    // Capabilities
    getCapabilities(): BackendCapabilities;
    isAvailable(): Promise<boolean>;
    getExecutablePath(): Promise<string | null>;

    // Lifecycle
    spawn(options: TerminalSpawnOptions): Promise<ITerminalInstance>;
    dispose(): Promise<void>;
}

export interface BackendCapabilities {
    supportsGPU: boolean;
    supportsSplitPanes: boolean;
    supportsLigatures: boolean;
    supportsTransparency: boolean;
    supportsImageProtocol: boolean; // iTerm2, Kitty protocols
    supportsHyperlinks: boolean;
    supportsUnicode: boolean;
    maxScrollbackLines: number;
}

export interface TerminalSpawnOptions {
    shell: string;
    cwd: string;
    env: Record<string, string>;
    cols: number;
    rows: number;
    profile?: TerminalProfile;
}
```

### 2. Terminal Session Manager

```typescript
/**
 * Manages terminal sessions, persistence, and lifecycle
 */
export class TerminalSessionManager extends BaseService {
    private sessions: Map<string, TerminalSession>;
    private backends: Map<string, ITerminalBackend>;
    private profiles: Map<string, TerminalProfile>;

    // Session Management
    async createSession(options: CreateSessionOptions): Promise<string>;
    async restoreSession(sessionId: string): Promise<void>;
    async closeSession(sessionId: string): Promise<void>;
    getSession(sessionId: string): TerminalSession | null;
    getAllSessions(): TerminalSession[];

    // Profile Management
    async loadProfile(profileId: string): Promise<TerminalProfile>;
    async saveProfile(profile: TerminalProfile): Promise<void>;
    async deleteProfile(profileId: string): Promise<void>;
    getDefaultProfile(): TerminalProfile;

    // Backend Management
    registerBackend(backend: ITerminalBackend): void;
    getAvailableBackends(): ITerminalBackend[];
    getPreferredBackend(): ITerminalBackend;
    detectInstalledBackends(): Promise<ITerminalBackend[]>;

    // Workspace Integration
    getWorkspaceTerminals(workspaceId: string): TerminalSession[];
    async createWorkspaceTerminal(workspaceId: string, options?: Partial<CreateSessionOptions>): Promise<string>;
}
```

### 3. Terminal Profile System

```typescript
export interface TerminalProfile {
    id: string;
    name: string;
    description?: string;
    icon?: string;

    // Shell Configuration
    shell: string; // 'bash', 'zsh', 'fish', 'pwsh', 'cmd'
    shellArgs: string[];
    cwd?: string;
    env: Record<string, string>;

    // Backend Preference
    preferredBackend?: string; // 'ghostty', 'alacritty', etc.
    fallbackBackends: string[];

    // Visual Settings
    theme: TerminalTheme;
    font: TerminalFont;
    opacity?: number; // 0.0 - 1.0
    blur?: number; // blur radius

    // Behavior
    scrollback: number;
    bellStyle: 'none' | 'visual' | 'sound';
    cursorStyle: 'block' | 'underline' | 'bar';
    cursorBlink: boolean;

    // Advanced
    customStartupCommand?: string;
    autoRestore: boolean; // Restore on app restart
}

export interface TerminalTheme {
    name: string;
    colors: {
        background: string;
        foreground: string;
        cursor: string;
        selection: string;
        black: string;
        red: string;
        green: string;
        yellow: string;
        blue: string;
        magenta: string;
        cyan: string;
        white: string;
        brightBlack: string;
        brightRed: string;
        brightGreen: string;
        brightYellow: string;
        brightBlue: string;
        brightMagenta: string;
        brightCyan: string;
        brightWhite: string;
    };
}

export interface TerminalFont {
    family: string; // 'JetBrains Mono', 'Fira Code', etc.
    size: number;
    weight: number;
    ligatures: boolean;
    antialiasing: 'none' | 'grayscale' | 'subpixel';
}
```

## 🚀 Backend Implementations

### Priority 1: Ghostty Backend
**Why Ghostty?**
- ⚡ Blazingly fast (GPU-accelerated, written in Zig)
- 🎨 Native look and feel on macOS
- 🔧 Excellent configuration system
- 🆕 Modern, actively developed

```typescript
export class GhosttyBackend implements ITerminalBackend {
    readonly id = 'ghostty';
    readonly name = 'Ghostty';

    async isAvailable(): Promise<boolean> {
        // Check if ghostty is installed
        const ghosttyPath = await this.getExecutablePath();
        return ghosttyPath !== null;
    }

    async spawn(options: TerminalSpawnOptions): Promise<ITerminalInstance> {
        // Spawn ghostty with IPC bridge
        const ghosttyProcess = spawn('ghostty', [
            '--socket', this.getSocketPath(),
            '--working-directory', options.cwd,
            '--command', options.shell
        ]);

        return new GhosttyInstance(ghosttyProcess, options);
    }
}
```

### Priority 2: Alacritty Backend
**Why Alacritty?**
- 🚀 Cross-platform (Windows, macOS, Linux)
- ⚡ GPU-accelerated (OpenGL)
- 🎯 Simple, focused on performance
- 📦 Easy to bundle

### Priority 3: WezTerm Backend
**Why WezTerm?**
- 🦀 Written in Rust (safe, fast)
- 🎨 Rich feature set (tabs, splits, multiplexing)
- 🔧 Lua configuration (powerful)
- 🖼️ Image protocol support

### Fallback: xterm.js Backend
**Why xterm.js?**
- ✅ Always available (bundled with app)
- 🌐 Web-based (works everywhere)
- 🔌 Already integrated (node-pty)
- 🛡️ Battle-tested

## 🎨 UI Modes

### 1. **Standalone Window**
- Detached terminal in separate window
- Can be moved to different monitor
- Full-screen support
- Independent from main app

### 2. **Floating Overlay** (` hotkey)
- Quick-access terminal
- Slides from top/bottom
- Always on top
- Minimal chrome

### 3. **Integrated Project Tab**
- Current implementation
- Embedded in project view
- Good for project-specific work

### 4. **Split Panes**
- Multiple terminals side-by-side
- Horizontal/vertical splits
- Adjustable dividers
- Per-pane profiles

## ⚡ Advanced Features

### 1. **Smart Command Suggestions**
```typescript
interface ICommandSuggestionProvider {
    getSuggestions(context: TerminalContext): Promise<CommandSuggestion[]>;
}

// AI-powered suggestions
// - Based on current directory
// - Based on git status
// - Based on project type (npm, cargo, make)
// - Based on command history
```

### 2. **Semantic Output Parsing**
```typescript
interface IOutputParser {
    parseOutput(output: string): ParsedOutput;
}

interface ParsedOutput {
    errors: TerminalError[];
    warnings: TerminalWarning[];
    links: TerminalLink[]; // URLs, file paths
    tasks: TerminalTask[]; // Running processes
}

// Example:
// "Error: ENOENT: no such file or directory, open 'foo.txt'"
// → Clickable error, opens file in editor
```

### 3. **Terminal Recording**
```typescript
interface ITerminalRecorder {
    startRecording(sessionId: string): void;
    stopRecording(sessionId: string): TerminalRecording;
    exportRecording(recording: TerminalRecording, format: 'asciinema' | 'gif' | 'mp4'): Promise<string>;
}
```

### 4. **Remote Terminals**
```typescript
// SSH integration
await terminalManager.createSession({
    type: 'remote-ssh',
    host: 'user@server.com',
    port: 22,
    privateKeyPath: '~/.ssh/id_rsa'
});

// Docker exec integration
await terminalManager.createSession({
    type: 'docker-exec',
    containerId: 'abc123',
    shell: '/bin/bash'
});

// Kubernetes pod exec
await terminalManager.createSession({
    type: 'k8s-exec',
    pod: 'my-pod',
    namespace: 'default',
    container: 'app'
});
```

## 📊 Performance Considerations

### GPU Acceleration
- Offload rendering to GPU (via Ghostty/Alacritty)
- Smooth scrolling (60+ FPS)
- Handle large outputs (millions of lines)

### Memory Management
- Virtual scrolling (only render visible lines)
- Truncate old scrollback (configurable limit)
- Share font atlas between terminals

### IPC Optimization
- Batch terminal output updates
- Use shared memory for large buffers
- Debounce resize events

## 🔐 Security

### Sandboxing
- Each terminal backend runs in isolated process
- Limit file system access via profile
- Audit shell commands (prevent injection)

### Environment Variables
- Sanitize env vars before passing to shell
- Don't leak sensitive data (API keys, tokens)
- Support secret management integration

## 🎯 Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Design and implement `ITerminalBackend` interface
- [ ] Create `TerminalSessionManager`
- [ ] Implement profile system
- [ ] Database schema for session persistence

### Phase 2: Ghostty Integration (Week 3)
- [ ] Ghostty backend implementation
- [ ] IPC bridge for Ghostty communication
- [ ] Auto-detection of Ghostty installation
- [ ] Configuration mapping (profiles → Ghostty config)

### Phase 3: UI Overhaul (Week 4)
- [ ] Standalone window mode
- [ ] Floating overlay (` hotkey)
- [ ] Split panes UI
- [ ] Tab management improvements

### Phase 4: Advanced Features (Week 5-6)
- [ ] Alacritty backend
- [ ] WezTerm backend
- [ ] Command suggestions (AI)
- [ ] Semantic output parsing
- [ ] Terminal recording

### Phase 5: Polish & Optimization (Week 7-8)
- [ ] Theme marketplace
- [ ] Remote terminals (SSH, Docker)
- [ ] Performance profiling
- [ ] Documentation & tutorials

## 📚 Inspiration & References

- **Ghostty**: https://github.com/ghostty-org/ghostty
- **Alacritty**: https://github.com/alacritty/alacritty
- **WezTerm**: https://github.com/wez/wezterm
- **Warp**: https://www.warp.dev/ (AI-powered features)
- **Kitty**: https://github.com/kovidgoyal/kitty
- **Windows Terminal**: https://github.com/microsoft/terminal
- **iTerm2**: https://iterm2.com/ (macOS reference)

## 🎨 User Experience Goals

1. **Performance**: Faster than native terminals
2. **Beauty**: Modern, aesthetic, customizable
3. **Productivity**: AI suggestions, smart parsing
4. **Flexibility**: Multiple backends, profiles, modes
5. **Reliability**: Crash-proof, session persistence

---

**Status**: 📝 Design Phase
**Next Step**: Implement `ITerminalBackend` interface

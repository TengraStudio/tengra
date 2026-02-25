# Project Structure

Tengra follows a strict organizational pattern to manage its multi-process architecture. This ensures a clear separation of concerns and makes the codebase easier to navigate for developers.

## Repository Overview

```text
tengra/
├── src/                # Primary source code for the application
│   ├── main/           # Node.js code for the Electron Main process
│   ├── renderer/       # React code for the Electron Renderer process
│   ├── shared/         # Universal types and constants used across processes
│   └── services/       # Native microservices (Rust and Go)
├── docs/               # Technical documentation and project guides
├── resources/          # Static assets, icons, and native binaries for distribution
├── scripts/            # Automation scripts for builds, linting, and environment setup
├── tests/              # Centralized test suites (Unit, Integration, E2E)
├── vendor/             # External source trees and pre-compiled dependencies
├── logs/               # Application logs (gitignored)
└── plans/              # Planning documents and analysis
```

## Main Process (src/main)

The Main process acts as the application's backend. It is responsible for low-level system access, service orchestration, and managing the lifecycle of the window and microservices.

### Directory Structure

```text
src/main/
├── main.ts                 # Application entry point
├── preload.ts              # Preload script for IPC bridge
├── core/                   # Core infrastructure
│   ├── container.ts        # Dependency injection container
│   ├── service-registry.ts # Service discovery and registration
│   ├── circuit-breaker.ts  # Resilience pattern implementation
│   ├── lazy-services.ts    # Lazy loading utilities
│   └── repository.interface.ts  # Data access interface
├── ipc/                    # IPC handlers (50+ handlers)
│   ├── index.ts            # Handler registration
│   ├── auth.ts             # Authentication handlers
│   ├── chat.ts             # Chat completion handlers
│   ├── project.ts          # Project management handlers
│   ├── terminal.ts         # Terminal handlers
│   └── ...                 # Domain-specific handlers
├── services/               # Domain-organized services
│   ├── llm/                # AI/LLM services
│   ├── data/               # Data persistence services
│   ├── project/            # Project management services
│   ├── security/           # Auth and encryption services
│   ├── system/             # System utilities
│   ├── analysis/           # Metrics and telemetry
│   ├── proxy/              # Proxy management
│   ├── external/           # External service integrations
│   └── ui/                 # UI-related services
├── startup/                # Application initialization
│   ├── services.ts         # Service registration
│   ├── ipc.ts              # IPC handler registration
│   ├── window.ts           # Window creation
│   ├── lifecycle.ts        # App lifecycle handlers
│   └── splash.ts           # Splash screen
├── logging/                # Logger infrastructure
│   └── logger.ts           # Centralized logging
├── mcp/                    # MCP plugin system
│   ├── dispatcher.ts       # MCP dispatcher
│   ├── plugin-base.ts      # Plugin base class
│   ├── servers/            # Built-in MCP servers
│   └── templates/          # Server templates
├── tools/                  # Tool execution
│   ├── tool-definitions.ts # Tool schemas
│   └── tool-executor.ts    # Tool execution engine
├── repositories/           # Data repositories
│   ├── folder.repository.ts
│   └── prompt.repository.ts
└── utils/                  # Utility functions
    ├── cache.util.ts       # LRU cache with TTL
    ├── event-bus.util.ts   # Event broadcasting
    ├── ipc-wrapper.util.ts # IPC handler utilities
    └── ...                 # Validation, sanitization
```

### Service Domains

| Domain | Folder | Purpose | Key Services |
|--------|--------|---------|--------------|
| **LLM** | `services/llm/` | AI model integration | LLMService, OllamaService, CopilotService |
| **Data** | `services/data/` | Data persistence | DatabaseService, FileSystemService, BackupService |
| **Project** | `services/project/` | Project management | ProjectService, GitService, TerminalService |
| **Security** | `services/security/` | Auth & encryption | AuthService, TokenService, SecurityService |
| **System** | `services/system/` | System utilities | CommandService, SystemService, NetworkService |
| **Analysis** | `services/analysis/` | Metrics & telemetry | TelemetryService, PerformanceService |
| **Proxy** | `services/proxy/` | API proxy | ProxyService, QuotaService |
| **External** | `services/external/` | External APIs | WebService, HttpService, ContentService |

## Renderer Process (src/renderer)

The Renderer process is a standard React application. It is restricted from direct system access and communicates with the Main process via IPC.

### Directory Structure

```text
src/renderer/
├── main.tsx                # Application entry point
├── App.tsx                 # Main application component
├── AppShell.tsx            # App wrapper
├── index.css               # Global styles
├── typography.css          # Typography definitions
├── web-bridge.ts           # Web preview bridge
├── logging.ts              # Renderer logger
├── assets/                 # Static assets
│   ├── logo.png
│   └── ...                 # Icons, images
├── components/             # Reusable UI components
│   ├── layout/             # Layout components
│   │   ├── ActivityBar.tsx
│   │   ├── AppHeader.tsx
│   │   ├── CommandPalette.tsx
│   │   ├── PanelLayout.tsx
│   │   ├── Sidebar.tsx
│   │   └── ...
│   ├── ui/                 # Base UI components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── modal.tsx
│   │   └── ...
│   ├── shared/             # Shared components
│   └── lazy/               # Lazy-loaded components
├── context/                # React contexts
│   ├── AppProviders.tsx    # Provider hierarchy
│   ├── SettingsContext.tsx
│   ├── AuthContext.tsx
│   ├── ThemeContext.tsx
│   ├── ModelContext.tsx
│   ├── ProjectContext.tsx
│   └── ChatContext.tsx
├── features/               # Feature modules
│   ├── chat/               # Chat feature
│   ├── settings/           # Settings feature
│   ├── projects/           # Projects feature
│   ├── terminal/           # Terminal feature
│   ├── models/             # Model management
│   ├── mcp/                # MCP management
│   ├── memory/             # Memory inspection
│   ├── ideas/              # Idea generation
│   └── ...
├── hooks/                  # Custom React hooks
│   ├── useAppInitialization.ts
│   ├── useKeyboardShortcuts.ts
│   └── ...
├── store/                  # State management
│   ├── theme.store.ts
│   ├── settings.store.ts
│   ├── sidebar.store.ts
│   ├── ui-layout.store.ts
│   └── notification-center.store.ts
├── views/                  # View components
│   ├── ViewManager.tsx     # View routing
│   └── view-manager/       # View wrappers
├── i18n/                   # Internationalization
│   ├── index.ts            # i18n setup
│   ├── en.ts               # English (base)
│   ├── tr.ts               # Turkish
│   └── ...                 # Other languages
├── themes/                 # Theme system
│   ├── README.md
│   ├── theme-registry.service.ts
│   └── manifests/          # Theme definitions
├── lib/                    # Libraries
│   ├── ipc-client.ts       # IPC communication
│   ├── animation-system.ts
│   └── ...
└── utils/                  # Utilities
    ├── accessibility.tsx
    ├── error-handler.util.ts
    └── ...
```

### Feature Modules

Each feature is self-contained with its own components, hooks, and types:

| Feature | Purpose | Key Components |
|---------|---------|----------------|
| `chat` | Main chat interface | ChatView, ChatInput, MessageBubble |
| `settings` | Settings tabs | GeneralTab, AppearanceTab, ModelsTab |
| `projects` | Project management | ProjectsPage, ProjectCard |
| `terminal` | Terminal panel | TerminalPanel, TerminalInstance |
| `models` | Model management | ModelsPage, ModelDetailsPanel |
| `mcp` | MCP servers | DockerDashboard, MCPServersTab |
| `memory` | Memory inspection | MemoryInspector |
| `ideas` | AI idea generation | IdeasPage, IdeaCard |

## Shared Code (src/shared)

Code shared between Main and Renderer processes. Must contain only "pure" code without Node.js or browser-specific APIs.

```text
src/shared/
├── types/                  # TypeScript definitions
│   ├── settings.ts
│   ├── chat.ts
│   └── ...
└── utils/                  # Shared utilities
    ├── error.util.ts
    └── ...
```

## Native Microservices (src/services)

Source code for systems-level microservices:

```text
src/services/
├── token-service/          # Rust token refresh service
│   ├── Cargo.toml
│   └── src/main.rs
└── target/                 # Rust build artifacts
```

## Tests (tests)

Centralized test suites:

```text
tests/
├── renderer/               # Renderer unit tests
│   ├── Button.test.tsx
│   ├── ChatInput.test.tsx
│   └── ...
├── main/                   # Main process tests
├── integration/            # Integration tests
└── e2e/                    # End-to-end tests
```

## Scripts (scripts)

Build and automation scripts:

```text
scripts/
├── build-native.js         # Native binary compilation
├── setup-build-env.js      # Environment setup
├── changelog/              # Changelog utilities
├── security/               # Security scripts
└── docs/                   # Documentation generators
```

## Documentation (docs)

Technical documentation:

```text
docs/
├── AI_RULES.md             # AI agent guidelines
├── ARCHITECTURE.md         # System architecture
├── API_REFERENCE.md        # API documentation
├── SERVICES.md             # Service documentation
├── TODO.md                 # Task tracking
├── adr/                    # Architecture Decision Records
├── changelog/              # Changelog data
└── openapi/                # OpenAPI specification
```

## File Naming Conventions

```
Correct naming:
my-service.service.ts       # Service files
user-profile.component.tsx  # React components
use-chat-manager.hook.ts    # Custom hooks
settings.types.ts           # Type definitions
error.util.ts               # Utility functions

Incorrect naming:
myService.ts                # Missing suffix
UserProfileComp.tsx         # Wrong suffix
usechatmanager.ts           # Missing suffix, bad casing
```

## Protected Paths

Never modify these paths:
- `.git/` - Version control
- `node_modules/` - Dependencies
- `vendor/` - Third-party code
- `.env`, `.env.local` - Environment files


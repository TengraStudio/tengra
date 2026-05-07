# Tengra Project TODO

## Core AI & Runtime Refinement
- [ ] **Deterministic Answer Composer**: Expand `composeDeterministicAnswer` in `ai-runtime.util.ts` to handle more intent types (file counts, path existence, system info) without model involvement.
- [ ] **Shared Evidence Store**: Fully integrate `session-conversation-evidence.util.ts` and `ai-runtime.util.ts` to deduplicate tool results across all surfaces (Chat, Workspace, Session).
- [ ] **Orchestration Parity**: Ensure `useChatGenerator` (renderer) and `session-conversation.ts` (main) use identical tool-loop budgeting and evidence-aware finalization.
- [ ] **Prompt Cleanup**: Move more anti-loop and recovery logic from `instructions.ts` into runtime policies.
- [ ] **Presentation Hardening**: Strengthen `AiPresentationMetadata` to ensure consistent rendering across different providers and surfaces.

## Native Services & Security (Rust)
- [x] **db-service Hardening**: 
    - Convert handlers to typed HTTP statuses instead of always-200.
    - Move blocking SQLite operations behind a write queue or `spawn_blocking`.
    - Add request body limits, response caps, and per-route timeouts.
    - Implement migration integrity checks and transaction wrappers.
- [x] **Vector Search**: Implement indexed approximate search or vector-search acceleration in `db-service`.
- [x] **Path Policy Enforcement**: Add workspace-root and path-policy enforcement for native filesystem and terminal handlers.
- [x] **Rust Service Refactoring**: Split oversized modules in `db-service` and `tengra-proxy` into focused repository/provider modules.
- [x] **Native Tests**: Add functional Rust tests for CRUD, migrations, and query policy in `db-service`.

## Provider & Integration Support
- [ ] **New Providers**: Research and prototype support for `Groq`, `Cursor`, and `Kimi` (auth flows and API compatibility).
- [ ] **Messaging Integrations**: 
    - Implement proactive notifications via Discord/Telegram bots.
    - Research and implement WhatsApp integration (QR/API).
- [ ] **Auth Enrichment**: Add authenticated provider info (avatar/org metadata) for OpenAI/Anthropic accounts.

## OSS Readiness & Roadmap
- [/] **Final OSS Checklist**: Completed governance (CoC, Templates), security (PII scrubbing, Security.md), and documentation (Roadmap, README expansion).
- [x] **Native MCP Orchestrator**: Migrate `ExternalMcpPlugin` lifecycle from Node.js to `tengra-proxy` (Rust).
- [ ] **WASM Plugin Runtime**: Integrate a WASM/WASI runtime (e.g., Wasmtime) for secure plugin sandboxing.
- [ ] **Capability-Based Security**: Implement a request/grant system for native/WASM plugins.
- [ ] **Unified Tool Hub**: Use `tengra-proxy` as the single gateway for all tool calls, eliminating Node.js IPC hops.
- [ ] **Tengra Native SDK**: Develop a Rust crate for building high-performance MCP servers.

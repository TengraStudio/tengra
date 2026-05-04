# Tengra Project Roadmap

This document outlines the strategic direction and planned features for Tengra. It is a living document and will evolve based on community feedback and project needs.

## Phase 1: Foundation (Completed)
- [x] **Modular Architecture**: Migration from monolith to separate Main, Renderer, and Native services.
- [x] **Native Proxy Bridge**: Initial implementation of `tengra-proxy` (Rust) for secure upstream communication.
- [x] **Persistence Layer**: Native `db-service` (Rust + SQLite) with migrations and typed API.
- [x] **Base AI Runtime**: Streaming support for OpenAI, Anthropic, Gemini, and Ollama.
- [x] **Workspace System**: File-based workspace management with agentic capabilities.

## Phase 2: Hardening & OSS Prep (Current)
- [x] **Native Service Hardening**:
    - [x] Typed HTTP statuses and error handling in `db-service`.
    - [x] Path policy enforcement for filesystem access.
    - [x] Migration integrity checks.
- [x] **MCP Native Migration**:
    - [x] Native MCP orchestrator in Rust for plugin lifecycle management.
    - [x] Delegation of tool calls from Node.js to `tengra-proxy`.
- [ ] **Core AI Refinement**:
    - [ ] Deterministic answer composition for basic system queries.
    - [ ] Shared evidence store for deduplicating tool results.
    - [ ] Orchestration parity between main and renderer runtimes.
- [ ] **OSS Readiness**:
    - [ ] Comprehensive documentation (ARCHITECTURE, CONTRIBUTING, ROADMAP).
    - [ ] CI/CD stability and automated linting/typing checks.
    - [ ] Security audit for PII and secret leaks.

## Phase 3: Ecosystem & Extensibility (Upcoming)
- [ ] **Secure Plugin Sandboxing**:
    - [ ] Integration of WASM/WASI runtime (Wasmtime) for 3rd-party plugins.
    - [ ] Capability-based security (request/grant system) for resource access.
- [ ] **Unified Tool Hub**:
    - [ ] Single gateway for all tool calls via `tengra-proxy`.
    - [ ] High-performance Rust SDK for building MCP servers.
- [ ] **Enhanced Provider Support**:
    - [ ] Support for Groq, Cursor, and Kimi.
    - [ ] Messaging integrations (Discord, Telegram, WhatsApp).
- [ ] **Proactive Capabilities**:
    - [ ] Background agents for automated task monitoring.
    - [ ] Context-aware notifications and health reports.

## Phase 4: Long-term Vision
- [ ] **Self-Hosted Infrastructure**: Optimized builds for private server deployments.
- [ ] **Collaborative Workspaces**: Multi-user agentic collaboration.
- [ ] **Local-First Vector Database**: Advanced RAG capabilities powered entirely by native Rust modules.

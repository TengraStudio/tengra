# ADR-003: Multi-LLM Architecture

## Status

Accepted

## Context

Users want flexibility to choose between AI providers depending on task, cost, privacy, and availability. Supporting only one provider would limit Tengra's usefulness. Options considered:

- **Single provider** — simpler but locks users into one ecosystem.
- **Abstraction layer with multiple backends** — more complex but enables provider switching and fallback.

Providers to support: Ollama (local), OpenAI, Anthropic/Claude, GitHub Copilot, Llama.cpp (local), and HuggingFace models.

## Decision

We implemented a **multi-LLM architecture** with a unified chat interface that abstracts provider differences. Each provider has its own service (`OllamaService`, `CopilotService`, etc.) under `src/main/services/llm/`. A `ModelRegistryService` tracks available models across providers.

The chat IPC layer (`src/main/ipc/chat.ts`) routes requests to the appropriate provider based on model selection. An orchestrator supports multi-model collaboration and council-based decision making.

## Consequences

### Positive

- Users can use local models for privacy or cloud models for capability
- Fallback between providers improves reliability
- Model comparison and council features enabled
- Cost optimization by routing tasks to appropriate models
- No vendor lock-in

### Negative

- Each provider requires its own adapter and error handling
- Streaming response formats differ across providers
- Token counting and cost estimation varies by provider
- Testing matrix grows with each new provider

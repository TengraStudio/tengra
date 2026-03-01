# ADR-003: Multi-LLM Provider Architecture

## Status

Accepted

## Context

Users have diverse requirements for AI models — cost sensitivity, privacy constraints,
latency needs, and capability preferences. Locking into a single LLM provider limits
flexibility and creates vendor dependency. Tengra must support cloud providers
(OpenAI, Anthropic, GitHub Copilot), local inference (Ollama, Llama.cpp), and
emerging platforms (HuggingFace, OpenCode) through a unified interface.

Options considered:
- **Single provider with abstraction** — Simple but forces all users onto one vendor.
- **Adapter pattern per provider** — Flexible but lacks orchestration.
- **Orchestrator with provider registry** — Full control over routing, queuing,
  and fallback across providers.

## Decision

We implemented a **multi-LLM orchestrator** with a provider registry pattern:

- `src/main/services/llm/model-registry.service.ts` — Central registry supporting
  11 provider IDs: `ollama`, `openai`, `anthropic`, `copilot`, `huggingface`,
  `nvidia`, `opencode`, `antigravity`, `codex`, `claude`, `sd-cpp`.
- `src/main/services/llm/multi-llm-orchestrator.service.ts` — Manages concurrent
  requests with per-provider queues, priority levels, rate limiting, and resource
  tracking (active/queued tasks, completed count, avg latency).
- `src/main/services/llm/llm.service.ts` — Main entry point orchestrating API calls.
- Provider-specific services: `openai.service.ts`, `ollama.service.ts`,
  `copilot.service.ts`, `huggingface.service.ts`, `local-ai.service.ts`.

Supporting services ensure reliability and cost control:
- `model-fallback.service.ts` — Automatic fallback routing on provider failure.
- `response-cache.service.ts` — Caches responses to reduce redundant API calls.
- `cost-estimation.service.ts` — Token and cost tracking per request.
- `context-window.service.ts` — Token window management per model.
- `embedding.service.ts` — Vector embedding generation across providers.

## Consequences

### Positive
- Users choose providers based on their needs (cost, privacy, capability).
- Fallback routing ensures resilience when a provider is unavailable.
- Per-provider rate limiting prevents quota exhaustion.
- Local inference options (Ollama, Llama.cpp) enable fully offline operation.

### Negative
- Each provider has unique API semantics requiring dedicated helper code.
- Orchestrator adds latency overhead for provider selection and queuing.
- Maintaining compatibility across 11 providers increases testing surface.
- Cost estimation accuracy varies across providers with different pricing models.

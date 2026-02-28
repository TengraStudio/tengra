# Model Context Window Sources

Last verified: 2026-02-27

## OpenAI
- Source: https://platform.openai.com/docs/models
- Used for:
  - `gpt-5*` / `gpt-5*codex*` -> 400,000
  - `gpt-4.1` / `gpt-4.1-mini` -> 1,047,576
  - `gpt-4o` / `gpt-4o-mini` -> 128,000
  - `o1*` / `o3*` -> 200,000

## Codex
- Source: https://platform.openai.com/docs/guides/codex
- Used for:
  - Confirming Codex routes to current GPT-5 Codex family IDs used in app model list.

## Anthropic (Claude)
- Source: https://docs.anthropic.com/en/docs/about-claude/models/overview
- Used for:
  - `claude-*` current 3.x/4.x model IDs in app -> 200,000

## Google (Gemini)
- Source: https://ai.google.dev/gemini-api/docs/models
- Used for:
  - `gemini-2.5-pro` -> 1,048,576
  - `gemini-2.5*` / `gemini-3*` fallback family mapping -> 1,048,576

## NVIDIA-hosted and community catalog
- Source: https://docs.api.nvidia.com/ (model catalog and model cards)
- Used for:
  - Family fallback rules in `model-context-window.data.ts` for NVIDIA long-tail/community IDs when per-model limits are unavailable from runtime payload.

## Notes
- The registry applies exact mappings first, then description parsing, then family pattern rules.
- Any unresolved text-generation model is logged by `ModelRegistryService` to simplify future mapping updates.

## Deprecation / Retirement Sources
- OpenAI deprecations:
  - https://platform.openai.com/docs/deprecations
  - Used to mark:
    - `o1-mini` as deprecated/retired (replacement `o3-mini`)
    - `dall-e-2` and `dall-e-3` as deprecated (replacement `gpt-image-1`; shutdown date listed by OpenAI)
- Anthropic model lifecycle:
  - https://docs.anthropic.com/en/docs/about-claude/models/all-models
  - Used to mark:
    - `claude-3-7-sonnet-20250219` as deprecated/retired
    - `claude-3-5-haiku-20241022` as deprecated/retired
    - `claude-3-opus-20240229` as deprecated/retired
    - `claude-3-5-sonnet-20241022` as deprecated/retired
    - `claude-3-haiku-20240307` as deprecated (scheduled retirement)

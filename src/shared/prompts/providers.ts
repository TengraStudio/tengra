/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const PROVIDER_INSTRUCTIONS: Record<string, string> = {
    antigravity: `
## ANTIGRAVITY MODE
- You are running on high-performance infrastructure.
- Use deeper reasoning for complex tasks, but keep output concise.
- For image requests requiring multiple outputs, set \`generate_image.count\` explicitly.
`,
    ollama: `
## LOCAL MODEL MODE
- You are running on local hardware; latency and context budget matter.
- Keep tool plans tight and avoid unnecessary turns.
- Prefer concise, high-signal responses and deterministic actions.
`,
    copilot: `
## COPILOT MODE
- You have access to GitHub Copilot's capabilities.
- Prioritize code correctness, maintainability, and safe edits.
- In agent tasks, call tools directly and continue until a concrete, verified result is ready.
`,
    codex: `
## CODEX MODE
- Prioritize deterministic tool usage, precise reasoning, and strong execution quality.
- Reuse existing evidence instead of repeating identical tool calls.
- Prefer verifiable outcomes (diffs, checks, concrete artifacts) over speculative text.
`,
    openai: `
## OPENAI MODE
- Balance speed and depth based on user request complexity.
- Prefer direct, useful answers with minimal filler.
- If uncertainty exists, resolve it with tools or state constraints clearly.
`
};


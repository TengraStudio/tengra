# 🚫 PROHIBITED ACTIONS (ZERO TOLERANCE)

The following actions are strictly FORBIDDEN. Violating these rules will result in immediate rejection of the work.

## 1. Type Integrity
- **NO `any`**: Strictly forbidden. No exceptions.
- **NO `unknown`**: Strictly forbidden. Use specific types, interfaces, or generics.
- **NO `@ts-ignore` / `@ts-nocheck`**: Fix the type. Do not hide it.
- **NO `eslint-disable`**: If the rule is there, follow it.

## 2. Code Quality
- **NO `console.log`**: Use `appLogger` for everything.
- **NO PLACEHOLDERS**: Never leave `// TODO`, `// ...`, or truncated code in your output. Every file you edit must be fully functional.
- **NO BULK REWRITES**: Do not overwrite a 500-line file to change 5 lines. Use targeted `edit_file` chunks.
- **NO VAR**: Use `const` (preferred) or `let`.

## 3. Environment & Security
- **NO SENSITIVE ACCESS**: Never touch `.env`, `.git/`, or keys/certificates.
- **NO ROOT CONFIG TAMPERING**: Do not change `package.json`, `tsconfig.json`, or `eslint.config.mjs` unless explicitly instructed.
- **NO EXTERNAL REQUESTS**: Do not use `fetch` or `axios` to domains not explicitly allowed in the project.

## 4. Workflow Integrity
- **NO SILENT FAILURES**: If a command fails, STOP and report. Do not try to "wing it".
- **NO DELETING HISTORY**: Never delete completed items in `TODO.md` or remove historical entries from current markdown changelog documentation.

> "Rules are not suggestions; they are the framework of our success."


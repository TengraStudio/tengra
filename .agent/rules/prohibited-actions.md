# Prohibited Actions for All Agents

This is a universal list of actions that are FORBIDDEN for all AI agents working on this project.

## Forbidden Type Usage

-   **`any`**: The use of the `any` type is strictly forbidden. Use specific types, generics, or `unknown` with type guards.
-   **`@ts-ignore`**: Never suppress TypeScript errors with comments. Fix the underlying type issue.
-   **`eslint-disable`**: Never disable ESLint rules inline. If a rule is consistently problematic, it should be discussed and the config updated.

## Forbidden Logging

-   **`console.log`**: All logging must go through `appLogger`. Use `appLogger.info`, `appLogger.warn`, `appLogger.error`, or `appLogger.debug`.

## Forbidden File Operations

-   **Full file deletion for editing**: Never delete a file and recreate it to make changes. Use targeted, line-by-line edits.
-   **Writing to protected paths**: Never modify `.git/`, `node_modules/`, `vendor/`, or any `.env` file.

## Forbidden Workflow Actions

-   **Committing without building**: All code must pass `npm run build`, `npm run lint`, and `npm run type-check` before being committed.
-   **Deleting TODO items**: When a task in `docs/TODO.md` is complete, mark it with `[x]`. NEVER delete the line.
-   **Ignoring build errors**: If a build or lint command fails, do not proceed. Fix the errors first.

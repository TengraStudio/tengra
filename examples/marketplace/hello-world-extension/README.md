# Hello World Extension

A minimal example of a Tengra extension.

## Features

- Scoped logging to the Tengra app console.
- Basic activation/deactivation lifecycle management.

## How to Run

1. **Build**: Run `npm install` and then `npm run build`.
2. **Test In-App**:
   - Open Tengra.
   - Use the developer tools or internal IPC bridge to call `extension:dev-start` with the absolute path to this folder.
   - Check the application logs to see "Hello World extension is now active!".

## Requirements

- No `any` types.
- Strict function length limits (60 lines).

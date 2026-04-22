# Release Checklist

Use this checklist before public releases, open-source announcements, or packaged builds.

## Source Hygiene

- [ ] `git status --short` only contains intended release changes.
- [ ] No scratch files are under `docs/`, `src/`, or package roots.
- [ ] Generated output is not staged: `dist/`, `release/`, `node_modules/`, `src/native/target/`.
- [ ] Root [README.md](../README.md) and [docs/README.md](./README.md) reflect current commands and architecture.
- [ ] Provider affiliation notice is visible in README/docs.

## Verification

Run:

```bash
npm run type-check
npm test
npm run lint
npm run secrets:scan
npm run audit:deps:gate
npm run build
```

Expected:

- TypeScript passes.
- Tests pass.
- Lint exits successfully.
- Secret scan exits successfully.
- Production dependency audit reports 0 high vulnerabilities.
- Build produces renderer/main/preload output and copies native binaries into managed runtime.

## Packaging

Windows:

```bash
npm run build:exe
```

macOS:

```bash
npm run build:mac
```

Linux:

```bash
npm run build:linux
```

Before publishing artifacts:

- [ ] Installers launch on a clean machine or VM.
- [ ] First-run runtime gate reports healthy or offers repair.
- [ ] Account linking opens and returns to the app correctly.
- [ ] Local Ollama detection works when Ollama is installed and running.
- [ ] A simple chat request succeeds for at least one configured provider.
- [ ] Workspace open/list/read flows work.
- [ ] Native proxy starts and stops cleanly.

## Security Review

- [ ] No accidental local paths, personal tokens, screenshots, or credentials are in staged files.
- [ ] Intentional public client IDs/static provider metadata are documented as intentional.
- [ ] Logs redact sensitive headers and token values.
- [ ] IPC or API changes have validation and tests.

## Release Notes

Prepare a short release note with:

- user-visible changes
- fixed bugs
- known limitations
- upgrade notes
- platform support notes

Keep historical backlog details in [TODO.md](./TODO.md); keep public release notes concise.

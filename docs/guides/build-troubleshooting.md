# Build Troubleshooting & Stable Settings

## `npm run build` Timeouts / OOM in CI and Local Dev Shell

Building a large Electron + React app with Vite and TypeScript can occasionally result in Memory Allocation errors ("JavaScript heap out of memory") or extended timeouts. This is especially true on GitHub Actions runners.

### Recommended Settings

**1. Local Development (Windows / macOS / Linux)**
Increase Node's maximum old space size to at least 8GB (8192MB). In your terminal before running build:

```bash
# Windows (PowerShell)
$env:NODE_OPTIONS="--max-old-space-size=8192"
npm run build

# Windows (CMD)
set NODE_OPTIONS=--max-old-space-size=8192
npm run build

# Linux / macOS
export NODE_OPTIONS="--max-old-space-size=8192"
npm run build
```

*(Note: `npm run dev` and `npm run electron:dev` in TENGRA already include this setting for Windows).*

**2. GitHub Actions (CI)**
To prevent random timeouts and JavaScript heap out of memory errors in GitHub Actions, configure `NODE_OPTIONS` for the build steps and set explicit job timeouts to fail fast.

Update `.github/workflows/ci.yml`:
```yaml
jobs:
  build-preview:
    runs-on: ubuntu-latest
    timeout-minutes: 15 # Add explicit timeout
    steps:
      - name: Build Frontend
        run: npx tsc && npx vite build
        env:
          NODE_OPTIONS: "--max-old-space-size=6144" # Limit to 6GB to fit within 7GB runner limit
```

**Why 6144 MB for GitHub Actions?**
Standard GitHub-hosted Linux runners come with 7GB of RAM. Setting the limit to 8192MB (8GB) can cause the runner itself to run out of physical memory and kill the process abruptly. `6144` provides a stable buffer for Vite and TypeScript to complete their builds safely.


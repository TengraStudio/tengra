import path from 'path';

import { app, BrowserWindow, nativeImage } from 'electron';

let splashWindow: BrowserWindow | null = null;

function getSplashIconPath(): string {
    return app.isPackaged
        ? path.join(process.resourcesPath, 'icon.ico')
        : path.join(__dirname, '../../resources/icon.ico');
}

function getSplashHtml(): string {
    return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tengra</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f5f5f5;
      --fg: #111111;
      --muted: #5f6670;
      --line: #dedede;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(120% 120% at 0% 0%, #ffffff 0%, var(--bg) 60%, #ececec 100%);
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      color: var(--fg);
      overflow: hidden;
    }
    .wrap {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 14px;
      user-select: none;
    }
    .brand {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 0.06em;
    }
    .subtitle {
      font-size: 13px;
      color: var(--muted);
      letter-spacing: 0.02em;
    }
    .progress {
      width: 240px;
      height: 4px;
      border-radius: 999px;
      overflow: hidden;
      background: #e3e3e3;
      border: 1px solid var(--line);
    }
    .bar {
      width: 35%;
      height: 100%;
      background: linear-gradient(90deg, #111111, #4a4f56);
      animation: slide 1.05s ease-in-out infinite;
    }
    @keyframes slide {
      0% { transform: translateX(-130%); }
      50% { transform: translateX(95%); }
      100% { transform: translateX(280%); }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">TENGRA</div>
    <div class="subtitle">Starting services...</div>
    <div class="progress"><div class="bar"></div></div>
  </div>
</body>
</html>`;
}

export function shouldShowSplashWindow(): boolean {
    const hiddenByArg = process.argv.includes('--hidden') || process.argv.includes('/hidden');
    const openedAtLogin = process.platform === 'win32' ? app.getLoginItemSettings().wasOpenedAtLogin : false;
    return !hiddenByArg && !openedAtLogin;
}

export function showSplashWindow(): BrowserWindow {
    if (splashWindow && !splashWindow.isDestroyed()) {
        return splashWindow;
    }

    const splash = new BrowserWindow({
        width: 430,
        height: 270,
        show: false,
        frame: false,
        resizable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        autoHideMenuBar: true,
        alwaysOnTop: true,
        center: true,
        backgroundColor: '#f5f5f5',
        icon: nativeImage.createFromPath(getSplashIconPath()),
        webPreferences: {
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    splash.once('ready-to-show', () => {
        if (!splash.isDestroyed()) {
            splash.show();
        }
    });

    splash.on('closed', () => {
        splashWindow = null;
    });

    void splash.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(getSplashHtml())}`);
    splashWindow = splash;
    return splash;
}

export function closeSplashWindow(): void {
    if (!splashWindow || splashWindow.isDestroyed()) {
        splashWindow = null;
        return;
    }
    splashWindow.close();
    splashWindow = null;
}




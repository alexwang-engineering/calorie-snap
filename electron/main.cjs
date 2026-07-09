const { app, BrowserWindow, shell } = require('electron')
const { spawn } = require('child_process')
const path = require('path')

const isDev = process.env.NODE_ENV === 'development'

let proxyProc = null

// The AI features need the local proxy (port 5174). In dev it's `npm run proxy`;
// packaged, we spawn it here using Electron's own binary as Node.
function startProxy() {
  const serverPath = path.join(app.getAppPath(), 'server', 'proxy.mjs')
  proxyProc = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      // API key lives in ~/Library/Application Support/Calorie Snap/.env
      CALORIE_SNAP_ENV_DIR: app.getPath('userData'),
    },
    stdio: 'ignore',
  })
  proxyProc.on('error', () => { proxyProc = null })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 380,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#f6f2eb',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (isDev) {
    win.loadURL('http://127.0.0.1:5173')
  } else {
    // app.getAppPath() works correctly both in dev and packaged
    const indexPath = path.join(app.getAppPath(), 'dist', 'index.html')
    win.loadFile(indexPath)
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  if (!isDev) startProxy()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('quit', () => {
  proxyProc?.kill()
  proxyProc = null
})

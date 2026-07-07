const { app, BrowserWindow, shell } = require('electron')
const path = require('path')

const isDev = process.env.NODE_ENV === 'development'

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
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

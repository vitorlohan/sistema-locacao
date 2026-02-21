// ============================================================
// Sistema de Locação — Electron Main Process
// Empacota frontend + backend em um único .exe
// ============================================================
const { app, BrowserWindow, Tray, Menu, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Impede múltiplas instâncias
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow = null;
let tray = null;
let backendProcess = null;
let isQuitting = false;

const isDev = !app.isPackaged;
const BACKEND_PORT = 3000;

// ── Paths ──

// Persistent data directory (survives rebuilds / reinstalls)
// Windows: C:\Users\<user>\AppData\Roaming\Sistema de Locação\
function getUserDataPath() {
  return app.getPath('userData');
}

function getBackendPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'backend');
  }
  return path.join(process.resourcesPath, 'backend');
}

function getIconPath() {
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  if (isDev) {
    return path.join(__dirname, iconName);
  }
  return path.join(process.resourcesPath, 'electron', iconName);
}

function getFrontendPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'backend', 'public', 'index.html');
  }
  return path.join(process.resourcesPath, 'backend', 'public', 'index.html');
}

// ── Backend ──

function ensureDataDirs() {
  // Persistent dirs inside AppData (not inside the app folder)
  const userData = getUserDataPath();
  const dataDir = path.join(userData, 'data');
  const backupsDir = path.join(userData, 'backups');

  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

  // Migrate old data from app folder → AppData (one-time)
  const backendDir = getBackendPath();
  migrateIfNeeded(path.join(backendDir, '.license'), path.join(userData, '.license'));
  migrateIfNeeded(path.join(backendDir, 'data', 'locacao.db'), path.join(dataDir, 'locacao.db'));
}

function migrateIfNeeded(oldPath, newPath) {
  try {
    if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
      fs.copyFileSync(oldPath, newPath);
      console.log(`[Migrate] ${oldPath} → ${newPath}`);
    }
  } catch (err) {
    console.warn(`[Migrate] Falha ao migrar ${oldPath}:`, err.message);
  }
}

function startBackend() {
  return new Promise((resolve, reject) => {
    const backendDir = getBackendPath();
    const serverFile = path.join(backendDir, 'dist', 'server.js');

    if (!fs.existsSync(serverFile)) {
      reject(new Error(`Backend não encontrado: ${serverFile}`));
      return;
    }

    ensureDataDirs();

    // Usar o Electron como Node.js para rodar o backend
    // (better-sqlite3 foi recompilado para o ABI do Electron via @electron/rebuild)
    const nodeExe = process.execPath;

    // All persistent data lives in AppData — survives rebuilds/updates
    const userData = getUserDataPath();

    backendProcess = spawn(nodeExe, [serverFile], {
      cwd: backendDir,
      env: {
        ...process.env,
        PORT: String(BACKEND_PORT),
        NODE_ENV: 'production',
        DB_PATH: path.join(userData, 'data', 'locacao.db'),
        BACKUP_DIR: path.join(userData, 'backups'),
        LICENSE_PATH: path.join(userData, '.license'),
        ELECTRON_RUN_AS_NODE: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let started = false;

    backendProcess.stdout.on('data', (data) => {
      const msg = data.toString();
      console.log(`[Backend] ${msg}`);
      if (!started && (msg.includes('sucesso') || msg.includes('iniciado') || msg.includes('listening'))) {
        started = true;
        resolve();
      }
    });

    backendProcess.stderr.on('data', (data) => {
      console.error(`[Backend Error] ${data}`);
    });

    backendProcess.on('error', (err) => {
      console.error('[Backend] Falha ao iniciar:', err);
      if (!started) reject(err);
    });

    backendProcess.on('exit', (code) => {
      console.log(`[Backend] Processo encerrado (código: ${code})`);
      backendProcess = null;
      if (!isQuitting && mainWindow) {
        dialog.showErrorBox(
          'Erro no Sistema',
          'O servidor backend encerrou inesperadamente.\nO sistema será reiniciado.'
        );
        app.relaunch();
        app.exit(0);
      }
    });

    // Timeout — resolve após 8 segundos de qualquer forma
    setTimeout(() => {
      if (!started) {
        started = true;
        resolve();
      }
    }, 8000);
  });
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
}

// ── Window ──

function createWindow() {
  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
    title: 'Sistema de Locação',
    show: false,
    backgroundColor: '#0f172a',
  });

  // Remove o menu padrão
  mainWindow.setMenu(null);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Sempre carrega do backend (que serve o frontend estático)
  mainWindow.loadURL(`http://localhost:${BACKEND_PORT}`);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Links externos abrem no navegador padrão
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Minimiza para bandeja ao fechar (em vez de sair)
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

// ── Tray ──

function createTray() {
  const iconPath = getIconPath();

  try {
    tray = new Tray(fs.existsSync(iconPath) ? iconPath : undefined);
  } catch {
    // Se não tiver ícone, continua sem tray
    console.log('[Tray] Ícone não encontrado, tray não criado');
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir Sistema de Locação',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Reiniciar Sistema',
      click: () => {
        app.relaunch();
        quitApp();
      },
    },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => quitApp(),
    },
  ]);

  tray.setToolTip('Sistema de Locação');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ── Quit ──

function quitApp() {
  isQuitting = true;
  stopBackend();
  if (tray) {
    tray.destroy();
    tray = null;
  }
  app.quit();
}

// ── App Lifecycle ──

app.whenReady().then(async () => {
  try {
    console.log('🚀 Iniciando Sistema de Locação...');

    // Em dev, o backend já roda via concurrently (ts-node-dev)
    // Em produção, inicia o backend como processo filho
    if (!isDev) {
      await startBackend();
      console.log('✅ Backend pronto!');
    } else {
      console.log('⚡ Modo dev — backend já está rodando externamente');
    }

    // Cria janela
    createWindow();

    // Cria ícone na bandeja
    createTray();

    console.log('✅ Sistema pronto!');
  } catch (err) {
    console.error('❌ Falha ao iniciar:', err);
    dialog.showErrorBox(
      'Erro ao Iniciar',
      `Não foi possível iniciar o sistema:\n\n${err.message}\n\nVerifique se a porta ${BACKEND_PORT} não está em uso.`
    );
    app.exit(1);
  }
});

// Segunda instância tenta abrir — mostra a janela existente
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  // Não faz nada — mantém na bandeja
});

app.on('before-quit', () => {
  isQuitting = true;
  stopBackend();
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');

let mainWindow = null;
let serverProcess = null;
const SERVER_PORT = 3000;

// Check if port is available
function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => { server.close(); resolve(true); });
    server.listen(port);
  });
}

// Wait for server to be ready
function waitForServer(port, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const req = require('http').get(`http://localhost:${port}/health`, (res) => {
        if (res.statusCode === 200) resolve();
        else if (Date.now() - start > timeout) reject(new Error('Server timeout'));
        else setTimeout(check, 300);
      });
      req.on('error', () => {
        if (Date.now() - start > timeout) reject(new Error('Server timeout'));
        else setTimeout(check, 300);
      });
    };
    check();
  });
}

function getResourcePath(relativePath) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, relativePath);
  }
  return path.join(__dirname, '..', relativePath);
}

async function startServer() {
  const free = await isPortFree(SERVER_PORT);
  if (!free) {
    console.log('Server already running on port', SERVER_PORT);
    return;
  }

  const serverDir = getResourcePath('server');
  const nodeModulesDir = path.join(serverDir, 'node_modules');

  // Check if server node_modules exist, if not install
  const fs = require('fs');
  if (!fs.existsSync(nodeModulesDir)) {
    console.log('Installing server dependencies...');
    const install = spawn('npm', ['install', '--production'], {
      cwd: serverDir,
      shell: true,
      stdio: 'inherit',
    });
    await new Promise((resolve) => install.on('close', resolve));
  }

  console.log('Starting server from:', serverDir);
  serverProcess = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: serverDir,
    shell: true,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(SERVER_PORT),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  serverProcess.stdout.on('data', (data) => console.log('[Server]', data.toString().trim()));
  serverProcess.stderr.on('data', (data) => console.error('[Server]', data.toString().trim()));
  serverProcess.on('close', (code) => console.log('[Server] exited with code', code));

  await waitForServer(SERVER_PORT);
  console.log('Server ready!');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Ghost Session',
    backgroundColor: '#0F0F18',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', async () => {
  try {
    await startServer();
  } catch (err) {
    console.error('Failed to start server:', err);
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});

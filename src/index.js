const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}
let mainWindow;
const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
    },
    icon: path.join(__dirname, 'icon.png'),
  });

  // Make fullscreen
  mainWindow.maximize();

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open the DevTools.
  //mainWindow.webContents.openDevTools();

  updateTargetPositions();
};


// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  app.quit();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
const express = require('express');
const ws = require('ws');
const myip = require('./get-ip.js');

// get random port
const eapp = express()
const httpServer = eapp.listen(0, () => {
  const port = httpServer.address().port
  console.log(`Server started on http://localhost:${port}`)
  console.log(`Server started on http://${myip.getLocalIP4()}:${port}`)
});

const wsServer = new ws.Server({ noServer: true })

httpServer.on('upgrade', (req, socket, head) => {
  wsServer.handleUpgrade(req, socket, head, (ws) => {
    wsServer.emit('connection', ws, req)
  })
})


eapp.use(express.static(path.join(__dirname, 'client')));

// Read config file
const fs = require('fs');
const appUserDataPath = app.getPath('userData');
const configFile = path.join(appUserDataPath, 'config2.json');
let config = {
  canvas_background: '#ffffff',
  target_color: '#ff0000',
  target_size: 0.1,
  target_icon: "cross",
  inter_eye_distance: 0.5,
  step_size: 0.05,
  target_positions: [
    { x: 0.25, y: 0.5 },
    { x: 0.75, y: 0.5 },
  ],
};

if (fs.existsSync(configFile)) {
  const data = fs.readFileSync(configFile);
  config = {
    ...config,
    ...JSON.parse(data),
  }
}


const clients = new Set()

class Client {
  constructor(ws) {
    this.ws = ws
  }

  send(data) {
    this.ws.send(data)
  }
}

wsServer.on('connection', (ws) => {
  const client = new Client(ws);
  let closeTimeout;
  function keepAlive() {
    clearTimeout(closeTimeout);
    closeTimeout = setTimeout(() => {
      ws.terminate();
    }, 5000);
  }

  ws.on('close', () => {
    clients.delete(client)
    clearTimeout(closeTimeout);
    updateTargetPositions();
  })

  ws.on('message', (data) => {
    const dt = JSON.parse(data);
    if (dt.type === 'resize') {
      const width = dt.width;
      const height = dt.height;
      client.width = width;
      client.height = height;

      updateTargetPositions();
    } else if (dt.type === 'beat') {
      keepAlive();
    }
  });

  client.send(JSON.stringify({
    type: 'config',
    config,
  }));
  
  clients.add(client)
  keepAlive();
});

let localIP = myip.getLocalIP4();
let port = httpServer.address().port;

async function get_config() {
  config.port = port;
  config.server_ip = localIP
  return config;
}

async function set_config(event, new_config) {
  config = {
    ...config,
    ...new_config,
  }

  clients.forEach((client) => {
    client.send(JSON.stringify({
      type: 'config',
      config,
    }));
  });

  fs.writeFileSync(configFile, JSON.stringify(config));
  updateTargetPositions();
}


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  ipcMain.handle('getConfig', get_config);
  ipcMain.handle('setConfig', set_config);
});

function updateTargetPositions() {
  const clientSizes = Array.from(clients).map((client) => {
    return {
      width: client.width,
      height: client.height,
    };
  });

  const message = JSON.stringify({
    type: 'target_positions',
    target_positions: config.target_positions,
    clientSizes,
  });

  for (const client of clients) {
    client.send(message);
  }

  mainWindow.webContents.send('target_positions', {
    clientSizes,
    target_positions: config.target_positions
  });
}

setInterval(()=>{
  const newIP = myip.getLocalIP4();
  if (newIP !== localIP) {
    console.log(`IP has changed from ${localIP} to ${newIP}`)
    localIP = newIP;
   
    mainWindow.webContents.send('ipchange', {
      ip: localIP,
      port
    });
  }

}, 1000);
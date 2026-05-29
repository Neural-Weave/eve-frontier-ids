import 'dotenv/config';
import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import fs from 'fs';
import { startLogWatcher } from './parser/logWatcher.mjs';
import { startChainPoller, broadcastCurrentState, connectWallet, getConnectionStatus } from './chain/chainPoller.mjs';

// Safe __dirname for both pkg and normal node
let __dirname;
try {
  __dirname = path.dirname(fileURLToPath(import.meta.url));
} catch(e) {
  __dirname = path.dirname(process.execPath);
}

const PUBLIC_DIR = process.pkg
  ? path.join(path.dirname(process.execPath), 'public')
  : path.join(__dirname, '../public');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(PUBLIC_DIR));
app.get('/vault', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'vault/index.html')));
app.get('/vault/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'vault/index.html')));
app.use('/vault', express.static(path.join(PUBLIC_DIR, 'vault')));

const clients = new Set();

export function broadcast(event) {
  const payload = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === 1) client.send(payload);
  }
}

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('Dashboard connected');
  ws.send(JSON.stringify({ type: 'status', message: 'IDS Online — watching logs and blockchain' }));
  setTimeout(() => broadcastCurrentState((event) => {
    if (ws.readyState === 1) ws.send(JSON.stringify(event));
  }), 500);
  ws.on('close', () => clients.delete(ws));
});

app.get('/api/status', (req, res) => res.json(getConnectionStatus()));

app.post('/api/connect', async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress || !walletAddress.startsWith('0x')) {
    return res.json({ success: false, error: 'Invalid wallet address — must start with 0x' });
  }
  const result = await connectWallet(walletAddress, broadcast);
  if (result.success) {
    broadcast({ type: 'wallet_connected', characterName: result.characterName, structureCount: result.structureCount, walletAddress });
  }
  res.json(result);
});

app.post('/api/disconnect', (req, res) => {
  try { fs.unlinkSync('./saved-wallet.json'); } catch(e) {}
  broadcast({ type: 'wallet_disconnected' });
  res.json({ success: true });
});

// Auto-detect log path
function detectLogPath() {
  if (process.env.LOG_PATH) return process.env.LOG_PATH.replace(/"/g, '');
  const home = os.homedir();
  const paths = [
    home + '/.steam/debian-installation/steamapps/compatdata/3801026856/pfx/drive_c/users/steamuser/Documents/Frontier/logs/Gamelogs',
    home + '/.local/share/Steam/steamapps/compatdata/3801026856/pfx/drive_c/users/steamuser/Documents/Frontier/logs/Gamelogs',
  ];
  if (process.env.LOCALAPPDATA) {
    paths.push(process.env.LOCALAPPDATA + '\\CCP\\EVE\\c_ccp_eve_frontier_stillness_stillness.servers.evefrontier.com\\logs\\Gamelogs');
  }
  for (const p of paths) {
    try { fs.accessSync(p); console.log('Auto-detected log path:', p); return p; } catch(e) {}
  }
  console.log('Warning: Could not auto-detect log path.');
  return null;
}

const logPath = detectLogPath();
if (logPath) startLogWatcher(logPath, broadcast);
else console.log('No log path found — blockchain monitoring only');

startChainPoller(broadcast);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n EVE Frontier IDS running at http://localhost:${PORT}`);
  console.log(` Log watcher: ${logPath ? 'active' : 'inactive (game not found)'}`);
  console.log(` Chain poller: active\n`);
});

import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';
import { parseLogLine } from './lineParser.mjs';

let watchedFile = null;
let fileSize = 0;

function getLatestLogFile(logDir) {
  try {
    const files = fs.readdirSync(logDir)
      .filter(f => f.endsWith('.txt') && f.includes('_'))
      .map(f => ({ name: f, time: fs.statSync(path.join(logDir, f)).mtime }))
      .sort((a, b) => b.time - a.time);
    return files.length ? path.join(logDir, files[0].name) : null;
  } catch (e) {
    console.error('Could not read log directory:', e.message);
    return null;
  }
}

export function startLogWatcher(logDir, broadcast) {
  console.log(`Log watcher: ${logDir}`);

  chokidar.watch(logDir, { ignoreInitial: true, depth: 0 }).on('add', (filePath) => {
    if (filePath.endsWith('.txt')) {
      console.log(`New log file: ${path.basename(filePath)}`);
      watchFile(filePath, broadcast);
    }
  });

  const latest = getLatestLogFile(logDir);
  if (latest) {
    console.log(`Watching log: ${path.basename(latest)}`);
    watchFile(latest, broadcast);
  } else {
    console.log('No log files found yet — waiting for game to start');
  }

  setInterval(() => {
    const latest = getLatestLogFile(logDir);
    if (latest && latest !== watchedFile) {
      watchFile(latest, broadcast);
    }
  }, 30000);
}

function watchFile(filePath, broadcast) {
  watchedFile = filePath;
  fileSize = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;

  chokidar.watch(filePath, { ignoreInitial: true }).on('change', () => {
    try {
      const stat = fs.statSync(filePath);
      if (stat.size <= fileSize) return;
      const stream = fs.createReadStream(filePath, { start: fileSize, end: stat.size });
      fileSize = stat.size;
      let buffer = '';
      stream.on('data', chunk => buffer += chunk.toString());
      stream.on('end', () => {
        const lines = buffer.split('\n').filter(l => l.trim());
        for (const line of lines) {
          const event = parseLogLine(line);
          if (event) broadcast(event);
        }
      });
    } catch (e) {
      console.error('Error reading log:', e.message);
    }
  });
}

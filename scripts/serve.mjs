import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const allowTrainingWrites = process.argv.includes('--train-ai');
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/__ai-training') {
      if (!allowTrainingWrites || request.method !== 'POST'
        || !['http://127.0.0.1:4173', 'http://localhost:4173'].includes(request.headers.origin)
        || request.headers['content-type'] !== 'application/json') {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 1_000_000) {
          response.writeHead(413).end('Model too large');
          return;
        }
        chunks.push(chunk);
      }
      const model = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const validEntry = (entry) => Number.isInteger(entry?.count) && entry.count >= 0
        && Number.isFinite(entry?.sum);
      const validStats = (stats) => validEntry(stats?.total) && stats.actions
        && typeof stats.actions === 'object' && !Array.isArray(stats.actions)
        && Object.keys(stats.actions).length <= 2000
        && Object.entries(stats.actions).every(([key, entry]) => key.length <= 120
          && !['__proto__', 'constructor', 'prototype'].includes(key) && validEntry(entry));
      const validModel = (candidate) => candidate?.version === 2 && candidate.horizon === 20
        && candidate.sources && typeof candidate.sources === 'object' && !Array.isArray(candidate.sources)
        && Object.keys(candidate.sources).length <= 256
        && Object.entries(candidate.sources).every(([id, source]) => /^[a-zA-Z0-9_-]{1,100}$/.test(id)
          && !['__proto__', 'constructor', 'prototype'].includes(id)
          && validStats(source?.human) && validStats(source?.ai));
      if (!validModel(model)) {
        response.writeHead(400).end('Invalid model');
        return;
      }
      const modelPath = resolve(root, 'js/ai-model.js');
      const currentFile = await readFile(modelPath, 'utf8');
      const match = currentFile.match(/window\.FarmAiModel\s*=\s*([\s\S]*);\s*$/);
      const current = match ? JSON.parse(match[1]) : null;
      if (validModel(current)) {
        for (const [id, source] of Object.entries(current.sources)) {
          const incoming = model.sources[id];
          const count = (entry) => entry.human.total.count + entry.ai.total.count;
          if (!incoming || count(source) > count(incoming)) model.sources[id] = source;
        }
      }
      await writeFile(modelPath,
        `// Play-test model. Sources merge without counting repeat exports twice.\nwindow.FarmAiModel = ${JSON.stringify(model, null, 2)};\n`);
      response.writeHead(204).end();
      return;
    }
    const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
    const filePath = resolve(root, relativePath);
    if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    const body = await readFile(filePath);
    response.writeHead(200, { 'content-type': contentTypes[extname(filePath)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(4173, '127.0.0.1');

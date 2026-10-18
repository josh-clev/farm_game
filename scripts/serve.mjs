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
        if (size > 100_000) {
          response.writeHead(413).end('Model too large');
          return;
        }
        chunks.push(chunk);
      }
      const model = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const validEntry = (entry) => Number.isInteger(entry?.count) && entry.count >= 0
        && Number.isFinite(entry?.sum);
      if (model?.version !== 1 || model.horizon !== 20 || !validEntry(model.total)
        || !model.actions || typeof model.actions !== 'object' || Array.isArray(model.actions)
        || Object.keys(model.actions).length > 2000
        || !Object.entries(model.actions).every(([key, entry]) => key.length <= 120 && validEntry(entry))) {
        response.writeHead(400).end('Invalid model');
        return;
      }
      await writeFile(resolve(root, 'js/ai-model.js'),
        `// Play-test model. Each action stores 20-turn coin + renown outcomes.\nwindow.FarmAiModel = ${JSON.stringify(model, null, 2)};\n`);
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

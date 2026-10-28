import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const BASE_PORT = Number(process.env.PORT || 5188);
const HOST = process.env.HOST || '127.0.0.1';
let port = BASE_PORT;
let attempts = 0;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const resolved = path.join(ROOT, normalized);
  if (!resolved.startsWith(ROOT)) return null;
  return resolved;
}

const server = http.createServer((req, res) => {
  let target = safePath(req.url === '/' ? '/index.html' : req.url);
  if (!target) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  try {
    const stat = fs.statSync(target);
    if (stat.isDirectory()) target = path.join(target, 'index.html');
  } catch {
    // SPA fallback for hash routes and missing static files.
    target = path.join(ROOT, 'index.html');
  }

  fs.readFile(target, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(target).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(data);
  });
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE' && !process.env.PORT && attempts < 10) {
    attempts += 1;
    port += 1;
    console.log(`端口被占用，尝试 ${port}…`);
    setTimeout(() => server.listen(port, HOST), 120);
    return;
  }
  console.error(`启动失败：${error.message}`);
  if (error.code === 'EADDRINUSE') {
    console.error('请用 PORT=其他端口 npm start 指定端口。');
  }
  process.exit(1);
});

server.listen(port, HOST, () => {
  console.log(`\n  德州扑克教练已启动: http://${HOST}:${port}\n`);
});

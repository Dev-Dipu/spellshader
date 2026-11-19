import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = __dirname;
let port = parseInt(process.env.PORT, 10) || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.hdr': 'application/octet-stream',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.obj': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

function createServer() {
  const server = http.createServer((req, res) => {
    try {
      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      let pathname = decodeURIComponent(parsedUrl.pathname);

      let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
      let filePath = path.join(ROOT, safePath);

      fs.stat(filePath, (err, stats) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(`404 Not Found: ${pathname}`);
          return;
        }

        if (stats.isDirectory()) {
          filePath = path.join(filePath, 'index.html');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        fs.readFile(filePath, (readErr, content) => {
          if (readErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`404 File Not Found: ${pathname}`);
            return;
          }

          res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(content);
        });
      });
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Server Error: ${e.message}`);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, trying ${port + 1}...`);
      port++;
      server.listen(port);
    } else {
      console.error('Server error:', err);
    }
  });

  server.listen(port, () => {
    console.log(`\n========================================================`);
    console.log(`✨ SpellShader · 4 Shaders Showcase is LIVE!`);
    console.log(`🌐 Local URL:  http://localhost:${port}/`);
    console.log(`========================================================\n`);
    console.log(`Direct Links:`);
    console.log(`1. Melt:     http://localhost:${port}/3/?seed=1g2g9j5&motion=Tumble&finish=Candy&shape=Blob`);
    console.log(`2. Feathers: http://localhost:${port}/12/?look=dark&seed=1q6iv5h&shape=torus`);
    console.log(`3. Burst:    http://localhost:${port}/2/?seed=1v9sgrx&shape=suzanne`);
    console.log(`4. Jelly:    http://localhost:${port}/9/?light=rose&shape=cross\n`);
  });
}

createServer();

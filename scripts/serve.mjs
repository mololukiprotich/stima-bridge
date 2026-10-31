import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, normalize, join } from 'node:path';

const PORT = 4173;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.csv': 'text/csv' };

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (path === '/') path = '/web/index.html';
  if (path.endsWith('/')) path += 'index.html';
  const safe = normalize(path).replace(/^([/\\]*\.\.[/\\])+/, '');
  try {
    const body = await readFile(join(process.cwd(), safe));
    res.writeHead(200, { 'Content-Type': TYPES[extname(safe)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}/web/`));

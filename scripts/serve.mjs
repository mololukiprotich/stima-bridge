import { createServer } from 'node:http';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { extname, normalize, join } from 'node:path';
import { TABLES, recordsToCsv, recordsFromCsv } from '../src/core/records.js';

const PORT = 4173;
const HOST = '127.0.0.1'; // Records hold IDs and phone numbers, so this stays on this computer.
const MAX_BODY = 5 * 1024 * 1024;
const RECORDS_DIR = join(process.cwd(), 'data', 'records');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.csv': 'text/csv' };
let writes = Promise.resolve();

async function readRecords() {
  const entries = await Promise.all(Object.keys(TABLES).map(async (name) => [name, await readFile(join(RECORDS_DIR, `${name}.csv`), 'utf8').catch(() => '')]));
  return recordsFromCsv(Object.fromEntries(entries));
}

async function writeRecords(records) {
  await mkdir(RECORDS_DIR, { recursive: true });
  for (const [name, text] of Object.entries(recordsToCsv(records))) {
    const file = join(RECORDS_DIR, `${name}.csv`);
    await writeFile(`${file}.tmp`, text);
    await rename(`${file}.tmp`, file);
  }
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > MAX_BODY) throw new Error('too large');
  }
  return JSON.parse(body);
}

async function records(req, res) {
  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  if (req.method === 'GET') return send(200, await readRecords());
  // Requiring JSON stops other websites posting here from the same browser.
  if (req.method !== 'POST' || req.headers['content-type'] !== 'application/json') return send(405, { error: 'Not allowed' });
  try {
    const body = await readBody(req);
    writes = writes.catch(() => {}).then(() => writeRecords(body));
    await writes;
    send(200, { saved: true });
  } catch {
    send(400, { error: 'Could not save records' });
  }
}

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (path === '/api/records') return records(req, res);
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
}).listen(PORT, HOST, () => console.log(`http://localhost:${PORT}/web/`));

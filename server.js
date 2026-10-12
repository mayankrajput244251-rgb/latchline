import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeRingEvent } from './src/events.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 4173);

const json = (res, status, payload) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(payload));
};

async function body(req) {
  let raw = '';
  for await (const part of req) raw += part;
  return raw ? JSON.parse(raw) : {};
}

async function ring(path, token) {
  if (!token) throw new Error('Add a short-lived Ring Playground token first.');
  const response = await fetch(`https://api.amazonvision.com${path}`, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.api+json, application/json' }
  });
  if (!response.ok) throw new Error(`Ring API returned ${response.status}. Check that the Playground token is still active.`);
  return response.json();
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      if (req.method === 'POST' && url.pathname === '/api/ring/connect') {
        const { token } = await body(req);
        if (typeof token !== 'string' || token.trim().length < 12) return json(res, 400, { error: 'Paste a valid Ring Playground token.' });
        const cleanToken = token.trim();
        if (req.headers.authorization !== `Bearer ${cleanToken}`) return json(res, 400, { error: 'Ring token header did not match.' });
        const data = await ring('/v1/devices?include=status,capabilities', cleanToken);
        return json(res, 200, { connected: true, devices: (data?.data || []).map((item) => ({
          id: item.id,
          name: item.attributes?.name || item.attributes?.description || item.id,
          kind: item.attributes?.device_type || item.attributes?.kind || 'Ring device'
        })) });
      }
      if (req.method === 'POST' && url.pathname === '/api/ring/disconnect') {
        return json(res, 200, { connected: false });
      }
      if (req.method === 'GET' && url.pathname === '/api/ring/events') {
        const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
        if (!token) return json(res, 401, { error: 'Reconnect your Ring Playground session.' });
        const deviceIds = (url.searchParams.get('devices') || '').split(',').filter(Boolean).slice(0, 12);
        const since = Number(url.searchParams.get('since') || Date.now() - 24 * 60 * 60 * 1000);
        const results = await Promise.all(deviceIds.map(async (id) => {
          const data = await ring(`/v1/history/devices/${encodeURIComponent(id)}/events`, token);
          return (data?.data || []).map((event) => normalizeRingEvent(event, id)).filter((event) => Date.parse(event.timestamp) >= since);
        }));
        return json(res, 200, { events: results.flat().sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, 100) });
      }
      return json(res, 404, { error: 'API route not found.' });
    }

    const safePath = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\]|\.\.(?:[/\\]|$))+/, '');
    const filename = safePath && !safePath.endsWith('/') ? safePath : `${safePath}index.html`;
    const fullPath = join(root, filename || 'index.html');
    const content = await readFile(fullPath);
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
    res.writeHead(200, { 'content-type': types[extname(fullPath)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') return json(res, 404, { error: 'Not found.' });
    json(res, 502, { error: error.message || 'Request failed.' });
  }
});

server.listen(port, () => console.log(`Latchline running at http://localhost:${port}`));

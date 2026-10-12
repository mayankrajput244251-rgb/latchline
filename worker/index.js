const ASSETS = __LATCHLINE_ASSETS__;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

async function ring(path, token) {
  if (!token) throw new Error('Add a short-lived Ring Playground token first.');
  const response = await fetch(`https://api.amazonvision.com${path}`, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.api+json, application/json' }
  });
  if (!response.ok) throw new Error(`Ring API returned ${response.status}. Check that the Playground token is still active.`);
  return response.json();
}

function normalizeEvent(item, deviceId = '') {
  const attr = item?.attributes || {};
  const rawType = String(attr.event_type || attr.type || item?.type || 'activity').toLowerCase();
  const data = attr.data || {};
  const titles = { motion: 'Visitor detected', motion_detected: 'Visitor detected', ding: 'Doorbell pressed', button_press: 'Doorbell pressed', package: 'Package spotted', package_detected: 'Package spotted', vehicle: 'Vehicle arrived', person: 'Person detected', device_offline: 'Camera went offline', device_online: 'Camera back online' };
  const title = titles[rawType] || rawType.replaceAll('_', ' ').replace(/^./, (char) => char.toUpperCase());
  return {
    id: String(item?.id || `${deviceId}-${attr.timestamp || Date.now()}`),
    deviceId: String(item?.relationships?.device?.data?.id || deviceId),
    type: rawType, title, subtype: attr.sub_type || data.sub_type || data.type || '',
    timestamp: attr.start_time || attr.timestamp || attr.created_at || new Date().toISOString(), source: 'ring', raw: item
  };
}

export default {
  async fetch(request) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith('/api/')) {
        if (request.method === 'POST' && url.pathname === '/api/ring/connect') {
          const { token } = await request.json();
          if (typeof token !== 'string' || token.trim().length < 12) return json({ error: 'Paste a valid Ring Playground token.' }, 400);
          const cleanToken = token.trim();
          if (request.headers.get('authorization') !== `Bearer ${cleanToken}`) return json({ error: 'Ring token header did not match.' }, 400);
          const data = await ring('/v1/devices?include=status,capabilities', cleanToken);
          return json({ connected: true, devices: (data?.data || []).map((item) => ({
            id: item.id, name: item.attributes?.name || item.attributes?.description || item.id,
            kind: item.attributes?.device_type || item.attributes?.kind || 'Ring device'
          })) });
        }
        if (request.method === 'POST' && url.pathname === '/api/ring/disconnect') return json({ connected: false });
        if (request.method === 'GET' && url.pathname === '/api/ring/events') {
          const authorization = request.headers.get('authorization') || '';
          const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
          if (!token) return json({ error: 'Reconnect your Ring Playground session.' }, 401);
          const deviceIds = (url.searchParams.get('devices') || '').split(',').filter(Boolean).slice(0, 12);
          const since = Number(url.searchParams.get('since') || Date.now() - 24 * 60 * 60 * 1000);
          const results = await Promise.all(deviceIds.map(async (id) => {
            const data = await ring(`/v1/history/devices/${encodeURIComponent(id)}/events`, token);
            return (data?.data || []).map((event) => normalizeEvent(event, id)).filter((event) => Date.parse(event.timestamp) >= since);
          }));
          return json({ events: results.flat().sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, 100) });
        }
        return json({ error: 'API route not found.' }, 404);
      }
      const key = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
      const content = ASSETS[key];
      if (content === undefined) return new Response('Not found', { status: 404 });
      const extension = key.slice(key.lastIndexOf('.'));
      return new Response(content, { headers: { 'content-type': MIME[extension] || 'application/octet-stream', 'cache-control': 'no-cache' } });
    } catch (error) {
      return json({ error: error?.message || 'Request failed.' }, 502);
    }
  }
};

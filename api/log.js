const { UAParser } = require('ua-parser-js');

const REDIS_URL = process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN;

async function redis(cmd) {
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    body: JSON.stringify(cmd),
  });
  return res.json();
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  let ip = fwd ? fwd.split(',')[0].trim() : req.socket && req.socket.remoteAddress;
  if (ip && ip.startsWith('::ffff:')) ip = ip.slice(7);
  return ip;
}

async function ipGeolocate(ip) {
  try {
    const geoRes = await fetch(`https://ipwho.is/${ip}`);
    const geo = await geoRes.json();
    if (!geo.success) return { ip, error: geo.message || 'lookup failed' };
    return {
      ip,
      city: geo.city,
      region: geo.region,
      country: geo.country,
      lat: geo.latitude,
      lon: geo.longitude,
      isp: geo.connection && geo.connection.isp,
      timezone: geo.timezone && geo.timezone.id,
    };
  } catch (err) {
    return { ip, error: err.message };
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const clientIp = getClientIp(req) || 'unknown';
  const ipGeo = await ipGeolocate(clientIp);

  const uaString = req.headers['user-agent'] || '';
  const uaResult = new UAParser(uaString).getResult();

  const { browserLocation, device } = req.body || {};

  // Basic shape check on client-supplied data before it's stored — the client already
  // gates this behind consent, but the API shouldn't trust the client blindly either.
  const safeBrowserLocation =
    browserLocation &&
    typeof browserLocation.lat === 'number' &&
    typeof browserLocation.lon === 'number'
      ? {
          lat: browserLocation.lat,
          lon: browserLocation.lon,
          accuracy: browserLocation.accuracy ?? null,
          altitude: browserLocation.altitude ?? null,
          altitudeAccuracy: browserLocation.altitudeAccuracy ?? null,
          heading: browserLocation.heading ?? null,
          speed: browserLocation.speed ?? null,
        }
      : null;

  const safeDevice = device && typeof device === 'object' ? device : {};

  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    timestamp: new Date().toISOString(),
    ip: ipGeo.ip,
    ipLocation: ipGeo.error
      ? null
      : {
          city: ipGeo.city,
          region: ipGeo.region,
          country: ipGeo.country,
          lat: ipGeo.lat,
          lon: ipGeo.lon,
          isp: ipGeo.isp,
          timezone: ipGeo.timezone,
        },
    browserLocation: safeBrowserLocation,
    device: {
      browser: `${uaResult.browser.name || 'Unknown'} ${uaResult.browser.version || ''}`.trim(),
      os: `${uaResult.os.name || 'Unknown'} ${uaResult.os.version || ''}`.trim(),
      deviceType: uaResult.device.type || 'desktop',
      ...safeDevice,
    },
  };

  const persisted = !!(REDIS_URL && REDIS_TOKEN);
  if (persisted) {
    await redis(['LPUSH', 'entries', JSON.stringify(entry)]);
    await redis(['LTRIM', 'entries', '0', '199']); // keep the most recent 200 entries
  } else {
    console.warn('KV_REST_API_URL / KV_REST_API_TOKEN not set — entries are not being persisted.');
  }

  res.status(200).json({ ok: true, entry, persisted });
};

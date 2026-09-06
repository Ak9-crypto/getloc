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

module.exports = async (req, res) => {
  const requiredToken = process.env.ADMIN_TOKEN;
  if (requiredToken) {
    const provided = req.headers['x-admin-token'] || req.query.token;
    if (provided !== requiredToken) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
  } else {
    console.warn('ADMIN_TOKEN not set — /api/entries is unauthenticated. Set it before sharing this deployment.');
  }

  if (!REDIS_URL || !REDIS_TOKEN) {
    res.status(200).json([]);
    return;
  }

  const { result } = await redis(['LRANGE', 'entries', '0', '199']);
  const entries = (result || [])
    .map((s) => {
      try {
        return JSON.parse(s);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  res.status(200).json(entries);
};

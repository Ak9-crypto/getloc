function getDeviceAttributes() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    languages: (navigator.languages || []).join(', '),
    screen: `${screen.width}x${screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    colorDepth: screen.colorDepth,
    pixelRatio: window.devicePixelRatio,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    cookiesEnabled: navigator.cookieEnabled,
    // Rough hardware class only (used for perf-tier heuristics, not identity).
    // Many browsers cap or omit these; null is a normal, expected value.
    deviceMemory: navigator.deviceMemory || null,
    hardwareConcurrency: navigator.hardwareConcurrency || null,
    touchSupport: 'ontouchstart' in window,
  };
}

function getBrowserLocation() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve({ status: 'unsupported', coords: null });
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          status: 'granted',
          coords: {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude,
            altitudeAccuracy: pos.coords.altitudeAccuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
          },
        }),
      (err) =>
        // Denied, timed out, or unavailable — this is a legitimate outcome, not a
        // failure to work around. The demo proceeds using IP-based location only.
        resolve({ status: err.code === 1 ? 'denied' : 'unavailable', coords: null }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function row(label, value) {
  return `<div class="result-row"><span class="result-label">${esc(label)}</span><span class="result-value mono">${esc(value)}</span></div>`;
}

function renderResults(entry, geoStatus) {
  const panel = document.getElementById('results-panel');
  const ipLoc = entry.ipLocation;
  const gps = entry.browserLocation;

  let mismatchNote = '';
  if (ipLoc && entry.device.timezone) {
    // Purely illustrative heuristic: does the browser timezone's rough region line up
    // with the IP-based country? A real system uses a timezone->country table; here we
    // just show the two values side by side so you can see how the comparison would work.
    mismatchNote = `
      <p class="muted small">
        Example VPN/mismatch heuristic: IP-based country is <strong>${esc(ipLoc.country || 'unknown')}</strong>,
        browser timezone is <strong>${esc(entry.device.timezone)}</strong> and browser language is
        <strong>${esc(entry.device.language)}</strong>. A fraud system flags a review when these disagree
        in ways that don't match normal travel — it does not identify who you are.
      </p>`;
  }

  panel.innerHTML = `
    <div class="capture-panel results-block">
      <h3 class="results-title">Here's exactly what was collected about this visit</h3>

      <h4 class="results-sub">Network / IP-based location</h4>
      ${row('Public IP', entry.ip)}
      ${ipLoc ? row('IP-based location', `${ipLoc.city || '?'}, ${ipLoc.region || '?'}, ${ipLoc.country || '?'}`) : row('IP-based location', 'lookup failed')}
      ${ipLoc && ipLoc.isp ? row('ISP', ipLoc.isp) : ''}

      <h4 class="results-sub">Precise GPS location</h4>
      ${geoStatus === 'granted' && gps
        ? row('GPS coordinates', `${gps.lat.toFixed(5)}, ${gps.lon.toFixed(5)} (±${Math.round(gps.accuracy)}m)`)
        : row('GPS coordinates', geoStatus === 'denied' ? 'not collected — you denied the permission prompt' : 'not available on this device/browser')}

      <h4 class="results-sub">Device &amp; browser</h4>
      ${row('Browser / OS', `${entry.device.browser} on ${entry.device.os}`)}
      ${row('Screen resolution', entry.device.screen)}
      ${row('Viewport size', entry.device.viewport)}
      ${row('Timezone', entry.device.timezone)}
      ${row('Language', `${entry.device.language} (${entry.device.languages})`)}
      ${entry.device.deviceMemory ? row('Device memory (approx.)', `${entry.device.deviceMemory} GB`) : ''}
      ${entry.device.hardwareConcurrency ? row('CPU cores (approx.)', entry.device.hardwareConcurrency) : ''}

      ${mismatchNote}

      <p class="muted small" style="margin-top:16px">
        This is everything sent to the demo backend for this visit. It was only sent because
        you consented above.
      </p>
    </div>
  `;
  panel.style.display = 'block';
}

async function runCapture() {
  const capturePanel = document.getElementById('capture-panel');
  const statusEl = document.getElementById('status');
  const dotEl = document.getElementById('status-dot');
  capturePanel.style.display = 'flex';

  statusEl.textContent = 'Requesting location permission…';
  const geo = await getBrowserLocation();
  const device = getDeviceAttributes();

  statusEl.textContent = 'Sending to demo backend…';

  let entry = null;
  try {
    const res = await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ browserLocation: geo.coords, device }),
    });
    const data = await res.json();
    entry = data.entry;
  } catch {
    // Network failure — still show the visitor what was gathered locally, from `device`
    // and geo, even though it couldn't be sent.
  }

  statusEl.textContent = 'Done';
  dotEl.classList.add('done');

  if (entry) {
    renderResults(entry, geo.status);
  }
}

function init() {
  const consentPanel = document.getElementById('consent-panel');
  const declinedPanel = document.getElementById('declined-panel');

  document.getElementById('consent-yes').addEventListener('click', () => {
    consentPanel.style.display = 'none';
    runCapture();
  });

  document.getElementById('consent-no').addEventListener('click', () => {
    // Declining means we do not call getCurrentPosition, do not read device attributes,
    // and do not call the API at all — not just hide the UI after the fact.
    consentPanel.style.display = 'none';
    declinedPanel.style.display = 'flex';
  });
}

init();

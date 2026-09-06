function fmtLoc(loc) {
  if (!loc) return '<span class="muted">not granted</span>';
  return `${loc.lat.toFixed(5)}, ${loc.lon.toFixed(5)} <span class="muted">(±${Math.round(loc.accuracy)}m)</span>`;
}

function fmtIpLoc(ipLoc) {
  if (!ipLoc) return '<span class="muted">lookup failed</span>';
  return [ipLoc.city, ipLoc.region, ipLoc.country].filter(Boolean).join(', ') || '—';
}

async function loadEntries(token) {
  const errorEl = document.getElementById('token-error');
  errorEl.hidden = true;

  const res = await fetch('/api/entries', {
    headers: token ? { 'x-admin-token': token } : {},
  });

  if (!res.ok) {
    errorEl.hidden = false;
    return;
  }

  const entries = await res.json();

  document.getElementById('count').textContent = entries.length;
  document.getElementById('summary-panel').hidden = false;
  document.getElementById('entries-table').hidden = false;
  document.getElementById('token-panel').hidden = true;

  const tbody = document.querySelector('#entries-table tbody');
  tbody.innerHTML = entries
    .map(
      (e) => `
    <tr>
      <td class="mono">${new Date(e.timestamp).toLocaleString()}</td>
      <td class="mono">${e.ip}</td>
      <td>${fmtIpLoc(e.ipLocation)}</td>
      <td>${fmtLoc(e.browserLocation)}</td>
      <td>${e.device.browser}</td>
      <td>${e.device.os}</td>
      <td>${e.device.deviceType}</td>
      <td class="mono">${e.device.screen || '—'}</td>
      <td class="mono">${e.device.viewport || '—'}</td>
      <td class="mono">${e.device.timezone || '—'}</td>
      <td>${e.device.language || '—'}</td>
      <td class="mono">${e.device.deviceMemory ? e.device.deviceMemory + 'GB' : '—'} / ${e.device.hardwareConcurrency || '—'}</td>
    </tr>`
    )
    .join('');

  // remember the token for this browser tab only, so refreshing doesn't force re-entry
  sessionStorage.setItem('adminToken', token || '');
}

document.getElementById('token-submit').addEventListener('click', () => {
  const token = document.getElementById('token-input').value.trim();
  loadEntries(token);
});

document.getElementById('token-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('token-submit').click();
});

// auto-load if we already have a token from earlier this tab
const savedToken = sessionStorage.getItem('adminToken');
if (savedToken) {
  document.getElementById('token-input').value = savedToken;
  loadEntries(savedToken);
}

function getDeviceAttributes() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    languages: (navigator.languages || []).join(', '),
    screen: `${screen.width}x${screen.height}`,
    colorDepth: screen.colorDepth,
    pixelRatio: window.devicePixelRatio,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    cookiesEnabled: navigator.cookieEnabled,
    hardwareConcurrency: navigator.hardwareConcurrency || null,
    touchSupport: 'ontouchstart' in window,
  };
}

function getBrowserLocation() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          altitudeAccuracy: pos.coords.altitudeAccuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
        }),
      () => resolve(null), // permission denied, timed out, or unavailable
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}

async function main() {
  const statusEl = document.getElementById('status');
  const dotEl = document.getElementById('status-dot');

  statusEl.textContent = 'Requesting location…';

  const browserLocation = await getBrowserLocation();
  const device = getDeviceAttributes();

  statusEl.textContent = 'Logging entry…';

  try {
    await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ browserLocation, device }),
    });
  } catch {
    // even on network failure, don't leave the visitor staring at a stuck status
  }

  statusEl.textContent = 'Done';
  dotEl.classList.add('done');
}

main();

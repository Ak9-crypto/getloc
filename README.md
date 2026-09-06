# Session Signal Log — Vercel edition

Same prototype as before, restructured to run as Vercel serverless functions so it gets a
real HTTPS domain (needed for `navigator.geolocation` — browsers only allow it on secure
contexts, i.e. HTTPS or literally `localhost`; a LAN IP like `192.168.x.x` over HTTP is blocked).

## Structure

Two separate pages now, on purpose: the link you'd send to a real visitor shows an explicit
consent screen first, listing every signal that will be requested and why — nothing is
collected until they click through. After capture, the visitor's page shows them exactly
what was collected about them (same data the operator dashboard sees for that entry). No
signal is gathered, and no request is sent to `/api/log`, if the visitor declines. The
table of everyone's (consenting) visits lives on a separate, token-gated page for you (the
operator) only.

Signals collected, once consented:
- Public IP + city-level IP-based location (third-party lookup, approximate)
- Precise GPS coordinates — only if the visitor grants the browser permission prompt;
  declining/timing out is a normal outcome, not something the app works around
- Browser, OS, screen resolution, viewport size, timezone, language, device memory (GB,
  where the browser exposes it) and CPU core count (rough hardware class, not identity)

The timezone/language-vs-IP-country comparison shown on the visitor's own results panel is
a simple illustration of the kind of VPN/impossible-travel heuristic a real fraud system
runs — it's shown to the visitor themselves as part of the demo, not used to deanonymize
them silently.

```
index.html                     # visitor-facing page (served at /) — captures + logs, shows only "Done"
dashboard/index.html            # operator-facing page (served at /dashboard) — full entries table
capture.js, dashboard.js        # client scripts for the pages above
styles.css                       # shared styling
api/log.js                       # POST — logs one entry (IP geo, browser geo, device info)
api/entries.js                    # GET  — returns all logged entries (requires ADMIN_TOKEN)
package.json                      # declares ua-parser-js for the functions
```

`dashboard/index.html` (a folder with an `index.html` inside) is what makes the clean
`/dashboard` URL work — a flat `dashboard.html` file at the root only resolves at
`/dashboard.html`, not `/dashboard` or `/dashboard/`.

### Set an access token for the dashboard

`/dashboard` and its underlying `/api/entries` call are gated by an `ADMIN_TOKEN` env var —
without it, anyone with the link could read every visitor's IP/location/device data.

1. Vercel project → **Settings → Environment Variables** → **Add Environment Variable**.
2. Name: `ADMIN_TOKEN`, Value: any long random string you pick, Environment: All.
3. Redeploy (env var changes require a redeploy, same as the database step).
4. Visit `https://your-project.vercel.app/dashboard`, paste the token in, click **Load entries**.

If `ADMIN_TOKEN` isn't set, `/api/entries` stays open with no auth — fine for a first local
test, not for anything you deploy and share.

No `vercel.json` needed — Vercel auto-detects anything under `/api` as a function and serves
everything else as a static file, zero config.

## 1. Set up a free database (so entries persist across visits)

Serverless functions have no writable local disk, so entries need somewhere real to live.
Easiest free option: Upstash Redis, available directly inside Vercel.

1. In your Vercel project → **Storage** tab → **Create Database** → choose **Upstash Redis**
   (or **Marketplace Database Providers → Upstash**) → pick the free tier.
2. Connect it to this project. Vercel will automatically add two environment variables to
   the project: `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. Redeploy (or it'll pick them up on the next deploy) — that's the only setup required,
   the code already reads those two variables.

If you skip this step, the app still works and still asks for/shows the current visit's
location — it just won't persist entries between page loads, and the UI will show a
"No database connected" notice.

## 2. Deploy

**Option A — Vercel CLI:**
```bash
npm i -g vercel
cd geo-track-vercel
vercel        # first deploy, follow the prompts (link/create project)
vercel --prod # promote to your production *.vercel.app domain
```

**Option B — GitHub:**
Push this folder to a GitHub repo, then in Vercel: **New Project → Import** that repo.
Every push redeploys automatically.

## 3. Test

Open the `https://your-project.vercel.app` URL Vercel gives you — on any device, including
your phone. Because it's HTTPS, the browser's native location permission prompt will actually
fire this time.

## Notes

- `data` is stored in a Redis list capped at the most recent 200 entries (`LTRIM`) so it
  doesn't grow unbounded on the free tier.
- `api/entries.js` currently has no auth — anyone with the URL can read all logged entries.
  Fine for a private test deploy; add auth before sharing the link or using real data.
- Consent-before-prompt is now implemented client-side (see `capture.js`). Still to harden
  before this logic moves into an actual banking app: encryption at rest, rate limiting,
  a proper (paid, higher-accuracy) IP geolocation provider, and a real consent/audit log
  rather than trusting the client's word that consent was given — a production version
  should have the server log a consent timestamp too, not just the client UI gating it.
- This is a demo/portfolio prototype. It should not be pointed at real third parties who
  haven't agreed to be part of a security demo — even with the consent screen, only use it
  on your own devices/browsers or with people who know what it's for.

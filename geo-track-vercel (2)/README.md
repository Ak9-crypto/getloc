# Session Signal Log — Vercel edition

Same prototype as before, restructured to run as Vercel serverless functions so it gets a
real HTTPS domain (needed for `navigator.geolocation` — browsers only allow it on secure
contexts, i.e. HTTPS or literally `localhost`; a LAN IP like `192.168.x.x` over HTTP is blocked).

## Structure

Two separate pages now, on purpose: the link you'd send to a real visitor only captures
their own data and shows them a plain status — it never shows anyone else's entries. The
table of everyone's data lives on a separate, token-gated page for you (the operator) only.

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
- See the parent project's README for the fuller list of things to harden before this logic
  moves into the actual banking app (consent-before-prompt, encryption at rest, rate limiting,
  proper IP geolocation provider, etc.) — all of that still applies here.

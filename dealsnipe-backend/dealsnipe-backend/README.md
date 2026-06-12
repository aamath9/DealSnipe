# DealSnipe Backend

Node.js/Express backend for DealSnipe — a Facebook Marketplace car alert service with Ntfy push notifications.

---

## Stack

- **Express** — API server
- **Playwright** — headless Chrome for scraping Facebook Marketplace
- **node-cron** — scheduled scrape jobs
- **LowDB** — lightweight JSON file database (no external DB needed)
- **Ntfy** — push notifications to your phone

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server status, last check time, active search count |
| GET | `/searches` | List all saved searches |
| POST | `/searches` | Create a new search |
| PATCH | `/searches/:id` | Update / toggle active |
| DELETE | `/searches/:id` | Delete a search |
| POST | `/searches/run` | Manually trigger a scrape now |
| GET | `/alerts` | List alerts (filter: `?score=great&searchId=xxx&limit=50`) |
| GET | `/alerts/stats` | Alert counts by score |
| PATCH | `/alerts/:id/save` | Toggle saved status |
| DELETE | `/alerts/:id` | Delete alert |
| GET | `/settings` | Get current settings |
| PATCH | `/settings` | Update settings |
| POST | `/settings/test-notification` | Send test Ntfy notification |
| GET | `/settings/saved-cars` | List saved cars |
| PATCH | `/settings/saved-cars/:id/notes` | Update notes on saved car |
| DELETE | `/settings/saved-cars/:id` | Remove saved car |

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Install Playwright browser
npx playwright install chromium

# 3. Copy env file and fill in values
cp .env.example .env

# 4. Create data directory
mkdir data

# 5. Start dev server
npm run dev
```

---

## Getting Your Facebook Cookies

The scraper needs a valid Facebook session to access Marketplace listings.

1. Log into **facebook.com** in Chrome
2. Open DevTools → **Application** → **Cookies** → `https://www.facebook.com`
3. You need at minimum these cookies: `c_user`, `xs`, `datr`, `fr`
4. Use the [Cookie Editor](https://chrome.google.com/webstore/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm) Chrome extension to export as JSON
5. Paste the JSON array as a single line in your `.env` as `FB_COOKIES`

**Cookie refresh:** Facebook cookies typically last 30–90 days. When scraping stops working, refresh your cookies.

---

## Setting Up Ntfy Notifications

1. Install the free **[Ntfy app](https://ntfy.sh/)** on your iPhone or Android
2. Choose a unique topic name (e.g. `dealsnipe-aaron-x7k2` — keep this private)
3. In the Ntfy app, subscribe to your topic
4. In DealSnipe Settings, enter your topic and tap "Send Test Notification"

Your backend sends a POST to `https://ntfy.sh/{your-topic}` whenever a deal is found. Tapping the notification opens the Marketplace listing directly.

---

## Deploying to Render

### Option A: Docker (Recommended — handles Playwright deps automatically)

1. Push this repo to GitHub
2. In Render → **New Web Service** → connect your repo
3. Choose **Docker** as the environment
4. Set environment variables (see below)
5. Deploy

### Option B: Native Node

Playwright requires system dependencies. On Render's native Node environment:

1. Set **Build Command:** `npm ci && npx playwright install chromium --with-deps`
2. Set **Start Command:** `node src/index.js`

### Required Environment Variables on Render

| Variable | Value |
|----------|-------|
| `PORT` | `3001` |
| `FRONTEND_URL` | Your Lovable app URL |
| `CHECK_INTERVAL_MINUTES` | `5` |
| `FB_COOKIES` | Your Facebook cookies JSON (single line) |

---

## Deal Scoring

| Score | Condition |
|-------|-----------|
| 🟢 Great Deal | Asking price ≥ 10% below your estimated market value |
| 🟡 Fair | Asking price 0–9% below market value |
| 🔴 Overpriced | Asking price above market value |

Set the **Estimated Market Value** per search (check KBB or CarGurus for your target vehicle).

---

## Notes & Limitations

- **Facebook may rate-limit or block** the scraper if checks are too frequent. 5-minute intervals are generally safe. Don't go below 3 minutes.
- Mileage/distance data requires visiting individual listing pages (a future enhancement — current version shows N/A).
- The `data/db.json` file is the database. On Render's free tier, the filesystem resets on redeploy. For persistence, either use Render's paid persistent disk ($1/mo) or migrate to a free Postgres instance on Render.
- Cookies are stored as an env var — never commit them to git.

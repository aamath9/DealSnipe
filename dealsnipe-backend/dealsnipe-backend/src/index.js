require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

const searchRoutes = require('./routes/searches');
const alertRoutes = require('./routes/alerts');
const settingsRoutes = require('./routes/settings');
const { runAllSearches } = require('./services/scraper');
const db = require('./utils/db');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
}));
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    lastCheck: db.get('meta.lastCheck').value() || null,
    activeSearches: db.get('searches').filter({ active: true }).size().value(),
  });
});

app.use('/searches', searchRoutes);
app.use('/alerts', alertRoutes);
app.use('/settings', settingsRoutes);

// ─── Scrape Cron ──────────────────────────────────────────────────────────────
// Runs every 5 minutes. Adjust cron expression as needed.
// '*/5 * * * *' = every 5 min
// '*/3 * * * *' = every 3 min (more aggressive)
const CHECK_INTERVAL = process.env.CHECK_INTERVAL_MINUTES || 5;
const cronExpression = `*/${CHECK_INTERVAL} * * * *`;

cron.schedule(cronExpression, async () => {
  console.log(`[cron] Running scrape at ${new Date().toISOString()}`);
  try {
    await runAllSearches();
    db.set('meta.lastCheck', new Date().toISOString()).write();
  } catch (err) {
    console.error('[cron] Scrape failed:', err.message);
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`DealSnipe backend running on port ${PORT}`);
  console.log(`Scraper scheduled every ${CHECK_INTERVAL} minutes`);
});

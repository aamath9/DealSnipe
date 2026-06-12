const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { sendTestNotification } = require('../services/ntfy');

// GET /settings
router.get('/', (req, res) => {
  const settings = db.get('settings').value();
  // Never expose sensitive env vars, just return stored settings
  res.json({
    ...settings,
    checkIntervalMinutes: parseInt(process.env.CHECK_INTERVAL_MINUTES) || 5,
  });
});

// PATCH /settings — update settings
router.patch('/', (req, res) => {
  const allowed = [
    'ntfyTopic',
    'ntfyServer',
    'onlyNotifyGreatDeals',
    'pauseAllNotifications',
  ];

  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates[key] = req.body[key];
    }
  }

  db.get('settings').assign(updates).write();
  res.json(db.get('settings').value());
});

// POST /settings/test-notification — send a test ntfy notification
router.post('/test-notification', async (req, res) => {
  // Allow overriding topic/server for the test (useful before saving)
  const { ntfyTopic, ntfyServer } = req.body;

  if (ntfyTopic) {
    // Temporarily update settings for the test
    db.get('settings').assign({ ntfyTopic, ntfyServer: ntfyServer || 'https://ntfy.sh' }).write();
  }

  try {
    await sendTestNotification();
    res.json({ success: true, message: 'Test notification sent!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /settings/saved-cars — list saved cars
router.get('/saved-cars', (req, res) => {
  const savedCars = db.get('savedCars').value();
  res.json(savedCars.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt)));
});

// PATCH /settings/saved-cars/:alertId/notes — update notes on a saved car
router.patch('/saved-cars/:alertId/notes', (req, res) => {
  const car = db.get('savedCars').find({ alertId: req.params.alertId });
  if (!car.value()) return res.status(404).json({ error: 'Saved car not found' });

  car.assign({ notes: req.body.notes || '' }).write();
  res.json(car.value());
});

// DELETE /settings/saved-cars/:alertId — remove from saved
router.delete('/saved-cars/:alertId', (req, res) => {
  db.get('savedCars').remove({ alertId: req.params.alertId }).write();
  // Also mark the alert as unsaved
  db.get('alerts').find({ id: req.params.alertId }).assign({ saved: false }).write();
  res.json({ success: true });
});

module.exports = router;

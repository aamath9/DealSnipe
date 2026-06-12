const express = require('express');
const router = express.Router();
const db = require('../utils/db');

// GET /alerts — list all alerts, newest first
// Query params: ?searchId=xxx&score=great&limit=50
router.get('/', (req, res) => {
  const { searchId, score, limit = 100 } = req.query;

  let alerts = db.get('alerts').value();

  // Filter by search
  if (searchId) {
    alerts = alerts.filter(a => a.searchId === searchId);
  }

  // Filter by deal score
  if (score) {
    alerts = alerts.filter(a => a.dealScore?.score === score);
  }

  // Newest first
  alerts = alerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Limit
  alerts = alerts.slice(0, parseInt(limit));

  res.json(alerts);
});

// GET /alerts/stats — summary counts for dashboard
router.get('/stats', (req, res) => {
  const allAlerts = db.get('alerts').value();
  const today = new Date().toDateString();

  const todayAlerts = allAlerts.filter(a =>
    new Date(a.createdAt).toDateString() === today
  );

  res.json({
    total: allAlerts.length,
    today: todayAlerts.length,
    great: allAlerts.filter(a => a.dealScore?.score === 'great').length,
    fair: allAlerts.filter(a => a.dealScore?.score === 'fair').length,
    overpriced: allAlerts.filter(a => a.dealScore?.score === 'overpriced').length,
  });
});

// PATCH /alerts/:id/save — toggle saved status
router.patch('/:id/save', (req, res) => {
  const alert = db.get('alerts').find({ id: req.params.id });
  if (!alert.value()) return res.status(404).json({ error: 'Alert not found' });

  const current = alert.value().saved;
  alert.assign({ saved: !current }).write();

  // If saving, also add to savedCars collection
  if (!current) {
    const savedCars = db.get('savedCars').value();
    const alreadySaved = savedCars.find(c => c.alertId === req.params.id);
    if (!alreadySaved) {
      db.get('savedCars').push({
        ...alert.value(),
        alertId: req.params.id,
        notes: '',
        savedAt: new Date().toISOString(),
      }).write();
    }
  } else {
    // Unsaving — remove from savedCars too
    db.get('savedCars').remove({ alertId: req.params.id }).write();
  }

  res.json(alert.value());
});

// DELETE /alerts/:id — delete single alert
router.delete('/:id', (req, res) => {
  db.get('alerts').remove({ id: req.params.id }).write();
  res.json({ success: true });
});

// DELETE /alerts — clear all alerts
router.delete('/', (req, res) => {
  db.set('alerts', []).write();
  res.json({ success: true, message: 'All alerts cleared' });
});

module.exports = router;

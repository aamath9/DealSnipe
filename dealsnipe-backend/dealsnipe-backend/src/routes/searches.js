const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');
const { runAllSearches } = require('../services/scraper');

// GET /searches — list all searches
router.get('/', (req, res) => {
  const searches = db.get('searches').value();
  res.json(searches);
});

// GET /searches/:id — get single search
router.get('/:id', (req, res) => {
  const search = db.get('searches').find({ id: req.params.id }).value();
  if (!search) return res.status(404).json({ error: 'Search not found' });
  res.json(search);
});

// POST /searches — create new search
router.post('/', (req, res) => {
  const {
    make,
    model,
    minYear,
    maxYear,
    maxPrice,
    maxMileage,
    marketValue,
    location,
    radius,
    excludeKeywords,
  } = req.body;

  if (!make && !model) {
    return res.status(400).json({ error: 'At least make or model is required' });
  }

  const newSearch = {
    id: uuidv4(),
    make: make || '',
    model: model || '',
    minYear: minYear ? parseInt(minYear) : null,
    maxYear: maxYear ? parseInt(maxYear) : null,
    maxPrice: maxPrice ? parseInt(maxPrice) : null,
    maxMileage: maxMileage ? parseInt(maxMileage) : null,
    marketValue: marketValue ? parseInt(marketValue) : null,
    location: location || '',
    radius: radius ? parseInt(radius) : 50,
    excludeKeywords: excludeKeywords || '',
    active: true,
    createdAt: new Date().toISOString(),
    lastRun: null,
    alertCount: 0,
  };

  db.get('searches').push(newSearch).write();
  res.status(201).json(newSearch);
});

// PATCH /searches/:id — update search (edit or toggle active)
router.patch('/:id', (req, res) => {
  const search = db.get('searches').find({ id: req.params.id });
  if (!search.value()) return res.status(404).json({ error: 'Search not found' });

  search.assign(req.body).write();
  res.json(search.value());
});

// DELETE /searches/:id — delete search
router.delete('/:id', (req, res) => {
  const search = db.get('searches').find({ id: req.params.id }).value();
  if (!search) return res.status(404).json({ error: 'Search not found' });

  db.get('searches').remove({ id: req.params.id }).write();
  res.json({ success: true });
});

// POST /searches/run — manually trigger a scrape right now
router.post('/run', async (req, res) => {
  res.json({ message: 'Scrape started' }); // respond immediately
  try {
    await runAllSearches();
    db.set('meta.lastCheck', new Date().toISOString()).write();
  } catch (err) {
    console.error('[manual run] Error:', err.message);
  }
});

module.exports = router;

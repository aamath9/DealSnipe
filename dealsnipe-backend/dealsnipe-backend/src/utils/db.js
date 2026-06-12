const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');

const adapter = new FileSync(path.join(__dirname, '../../data/db.json'));
const db = low(adapter);

// Default structure
db.defaults({
  searches: [],
  alerts: [],
  savedCars: [],
  seenListingIds: [],   // tracks IDs we've already alerted on to avoid duplicates
  meta: {
    lastCheck: null,
  },
  settings: {
    ntfyTopic: '',
    ntfyServer: 'https://ntfy.sh',
    onlyNotifyGreatDeals: false,
    pauseAllNotifications: false,
  },
}).write();

module.exports = db;

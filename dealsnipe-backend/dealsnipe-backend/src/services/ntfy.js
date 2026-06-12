const fetch = require('node-fetch');
const db = require('../utils/db');

/**
 * Sends a push notification via ntfy.sh (or self-hosted ntfy).
 * Install the free Ntfy app on your phone and subscribe to your topic.
 */
async function sendNotification({ title, body, url, priority = 'default', tags = [] }) {
  const settings = db.get('settings').value();
  const { ntfyTopic, ntfyServer, pauseAllNotifications } = settings;

  if (pauseAllNotifications) {
    console.log('[ntfy] Notifications paused, skipping.');
    return;
  }

  if (!ntfyTopic) {
    console.warn('[ntfy] No topic configured, skipping notification.');
    return;
  }

  const server = ntfyServer || 'https://ntfy.sh';
  const endpoint = `${server}/${ntfyTopic}`;

  const headers = {
    'Title': title,
    'Priority': priority,  // min, low, default, high, urgent
    'Tags': tags.join(','),
  };

  // If a listing URL is provided, make the notification tappable
  if (url) {
    headers['Click'] = url;
    headers['Actions'] = `view, Open Listing, ${url}`;
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body,
    });

    if (!res.ok) {
      console.error(`[ntfy] Failed to send: ${res.status} ${res.statusText}`);
    } else {
      console.log(`[ntfy] Notification sent: ${title}`);
    }
  } catch (err) {
    console.error('[ntfy] Error sending notification:', err.message);
  }
}

/**
 * Sends a test notification. Called from Settings panel.
 */
async function sendTestNotification() {
  await sendNotification({
    title: '✅ DealSnipe Connected',
    body: 'Your notifications are working! You\'ll be alerted when deals are found.',
    priority: 'default',
    tags: ['white_check_mark'],
  });
}

/**
 * Sends a car deal alert notification.
 */
async function sendCarAlert({ car, search, dealScore }) {
  const settings = db.get('settings').value();

  // If user only wants great deals, skip fair/overpriced
  if (settings.onlyNotifyGreatDeals && dealScore.score !== 'great') {
    console.log(`[ntfy] Skipping non-great deal for ${car.title}`);
    return;
  }

  const emoji = dealScore.score === 'great' ? '🟢' : dealScore.score === 'fair' ? '🟡' : '🔴';
  const dealText = dealScore.percentOff !== null
    ? `${Math.abs(dealScore.percentOff)}% ${dealScore.percentOff >= 0 ? 'below' : 'above'} market`
    : 'Market value unknown';

  const title = `${emoji} ${car.title} — $${car.price?.toLocaleString()}`;
  const body = [
    `${car.mileage ? car.mileage.toLocaleString() + ' miles' : 'Mileage N/A'}`,
    `📍 ${car.location || 'Location N/A'}${car.distance ? ` • ${car.distance} mi away` : ''}`,
    `💰 ${dealText}`,
    `🔍 Search: ${search.make} ${search.model}`,
  ].join('\n');

  const priority = dealScore.score === 'great' ? 'high' : 'default';
  const tags = dealScore.score === 'great' ? ['rotating_light', 'car'] : ['car'];

  await sendNotification({
    title,
    body,
    url: car.listingUrl,
    priority,
    tags,
  });
}

module.exports = { sendNotification, sendTestNotification, sendCarAlert };

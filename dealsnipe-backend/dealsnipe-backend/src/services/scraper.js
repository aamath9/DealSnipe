const { chromium } = require('playwright');
const db = require('../utils/db');
const { scoreDeal } = require('../utils/scoring');
const { sendCarAlert } = require('./ntfy');
const { v4: uuidv4 } = require('uuid');

/**
 * Builds a Facebook Marketplace vehicles search URL from search criteria.
 */
function buildMarketplaceUrl(search) {
  const params = new URLSearchParams();

  if (search.maxPrice) params.set('maxPrice', search.maxPrice);
  if (search.minYear) params.set('minYear', search.minYear);
  if (search.maxYear) params.set('maxYear', search.maxYear);
  if (search.maxMileage) params.set('maxMileage', search.maxMileage);
  if (search.radius) params.set('radius', search.radius);

  // Facebook Marketplace vehicles search
  // Location is handled by the 'city' param or defaults to the user's FB location
  const query = [search.make, search.model].filter(Boolean).join(' ');
  const baseUrl = `https://www.facebook.com/marketplace/vehicles`;

  return `${baseUrl}?query=${encodeURIComponent(query)}&${params.toString()}&sortBy=creation_time_descend&exact=false`;
}

/**
 * Checks if a listing matches exclude keywords.
 */
function matchesExcludes(listing, excludeKeywords) {
  if (!excludeKeywords || excludeKeywords.length === 0) return false;
  const text = `${listing.title} ${listing.description || ''}`.toLowerCase();
  return excludeKeywords.some(kw => text.includes(kw.toLowerCase().trim()));
}

/**
 * Scrapes Facebook Marketplace for a single search.
 * Returns array of new (unseen) listings.
 *
 * NOTE: Facebook Marketplace requires a logged-in session.
 * Set FB_COOKIES env var as a JSON string of your browser cookies,
 * OR set FB_EMAIL + FB_PASSWORD for auto-login (less reliable).
 *
 * To get cookies: log into Facebook in Chrome, open DevTools →
 * Application → Cookies → facebook.com, export as JSON.
 */
async function scrapeSearch(browser, search) {
  const page = await browser.newPage();
  const newListings = [];

  try {
    // Inject saved cookies so we appear logged in
    const cookiesRaw = process.env.FB_COOKIES;
    if (cookiesRaw) {
      const cookies = JSON.parse(cookiesRaw);
      await page.context().addCookies(cookies);
    }

    const url = buildMarketplaceUrl(search);
    console.log(`[scraper] Searching: ${url}`);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000); // let listings render

    // Extract listing data from the page
    const listings = await page.evaluate(() => {
      const results = [];

      // Facebook Marketplace listing cards
      // Selectors may need updating if FB changes their DOM
      const cards = document.querySelectorAll('[data-testid="marketplace_feed_item"], a[href*="/marketplace/item/"]');

      cards.forEach(card => {
        try {
          const link = card.closest('a') || card.querySelector('a');
          const href = link?.href || '';
          const idMatch = href.match(/\/marketplace\/item\/(\d+)/);
          const listingId = idMatch ? idMatch[1] : null;
          if (!listingId) return;

          // Price
          const priceEl = card.querySelector('[data-testid="marketplace_listing_price"], span');
          const priceText = priceEl?.textContent || '';
          const priceMatch = priceText.replace(/,/g, '').match(/\$?([\d]+)/);
          const price = priceMatch ? parseInt(priceMatch[1]) : null;

          // Title
          const titleEl = card.querySelector('span[dir="auto"], [data-testid="marketplace_listing_title"]');
          const title = titleEl?.textContent?.trim() || 'Unknown';

          // Location / distance — FB shows this as "City, State" or "X miles away"
          const spans = Array.from(card.querySelectorAll('span'));
          const locationSpan = spans.find(s => s.textContent.includes('miles') || s.textContent.includes(','));
          const location = locationSpan?.textContent?.trim() || null;

          results.push({
            listingId,
            title,
            price,
            location,
            listingUrl: `https://www.facebook.com/marketplace/item/${listingId}/`,
            scrapedAt: new Date().toISOString(),
          });
        } catch (e) {
          // skip malformed card
        }
      });

      return results;
    });

    const seenIds = db.get('seenListingIds').value();
    const excludeKeywords = search.excludeKeywords
      ? search.excludeKeywords.split(',').map(k => k.trim()).filter(Boolean)
      : [];

    for (const listing of listings) {
      // Skip already-seen listings
      if (seenIds.includes(listing.listingId)) continue;

      // Skip excluded keywords
      if (matchesExcludes(listing, excludeKeywords)) {
        console.log(`[scraper] Excluded listing: ${listing.title}`);
        continue;
      }

      // Score the deal
      const dealScore = scoreDeal(listing.price, search.marketValue);

      // Build full alert object
      const alert = {
        id: uuidv4(),
        searchId: search.id,
        searchLabel: `${search.make || ''} ${search.model || ''}`.trim(),
        ...listing,
        mileage: null,         // mileage requires visiting individual listing page
        distance: null,        // same
        dealScore,
        marketValue: search.marketValue || null,
        createdAt: new Date().toISOString(),
        saved: false,
      };

      newListings.push(alert);

      // Save alert to DB
      db.get('alerts').push(alert).write();

      // Mark listing as seen
      db.get('seenListingIds').push(listing.listingId).write();

      // Trim seenIds to last 5000 to prevent unbounded growth
      const currentSeen = db.get('seenListingIds').value();
      if (currentSeen.length > 5000) {
        db.set('seenListingIds', currentSeen.slice(-5000)).write();
      }

      // Send ntfy notification
      await sendCarAlert({ car: alert, search, dealScore });
    }

    console.log(`[scraper] Found ${newListings.length} new listings for search: ${search.make} ${search.model}`);

  } catch (err) {
    console.error(`[scraper] Error scraping search ${search.id}:`, err.message);
  } finally {
    await page.close();
  }

  return newListings;
}

/**
 * Main function: runs all active searches.
 * Called by the cron job in index.js.
 */
async function runAllSearches() {
  const activeSearches = db.get('searches').filter({ active: true }).value();

  if (activeSearches.length === 0) {
    console.log('[scraper] No active searches, skipping.');
    return;
  }

  console.log(`[scraper] Running ${activeSearches.length} active searches`);

  // Launch one browser for all searches (more efficient)
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',   // important for Render/Docker
      '--disable-gpu',
    ],
  });

  try {
    for (const search of activeSearches) {
      await scrapeSearch(browser, search);
      // Small delay between searches to be polite
      await new Promise(r => setTimeout(r, 2000));
    }
  } finally {
    await browser.close();
  }
}

module.exports = { runAllSearches, scrapeSearch };

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const config = require('./config');

const TOKEN_FILE = path.join(__dirname, '..', 'data', 'token.json');
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // check once a day
const REFRESH_WHEN_OLDER_THAN_DAYS = 50; // long-lived tokens last ~60 days

function loadFromDisk() {
  if (fs.existsSync(TOKEN_FILE)) {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  }
  return null;
}

function saveToDisk(tokenData) {
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokenData, null, 2));
}

let current = loadFromDisk();

if (!current) {
  if (!config.igSeedAccessToken) {
    console.error(
      '[tokenStore] No saved token found and IG_ACCESS_TOKEN is empty. ' +
      'Run `npm run get-token` first (see README) to obtain a long-lived token.'
    );
  } else {
    current = { access_token: config.igSeedAccessToken, obtained_at: Date.now() };
    saveToDisk(current);
    console.log('[tokenStore] Seeded token store from IG_ACCESS_TOKEN in .env');
  }
}

function getAccessToken() {
  if (!current) throw new Error('No Instagram access token available. See README setup steps.');
  return current.access_token;
}

async function refreshIfNeeded() {
  if (!current) return;
  const ageDays = (Date.now() - current.obtained_at) / (1000 * 60 * 60 * 24);
  if (ageDays < REFRESH_WHEN_OLDER_THAN_DAYS) return;

  try {
    const res = await axios.get(`https://graph.instagram.com/refresh_access_token`, {
      params: {
        grant_type: 'ig_refresh_token',
        access_token: current.access_token,
      },
    });
    current = { access_token: res.data.access_token, obtained_at: Date.now() };
    saveToDisk(current);
    console.log('[tokenStore] Refreshed long-lived Instagram access token.');
  } catch (err) {
    console.error(
      '[tokenStore] Failed to refresh access token — it will keep using the ' +
      'existing one until it expires. Error:',
      err.response?.data || err.message
    );
  }
}

function startAutoRefresh() {
  refreshIfNeeded(); // check once on boot
  setInterval(refreshIfNeeded, REFRESH_INTERVAL_MS);
}

module.exports = { getAccessToken, startAutoRefresh };

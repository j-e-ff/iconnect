const fs = require('fs');
const path = require('path');

const STORE_FILE = path.join(__dirname, '..', 'data', 'store.json');
const MAX_ENTRIES = 2000; // trim old entries so the file doesn't grow forever

let map = {};
if (fs.existsSync(STORE_FILE)) {
  try {
    map = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  } catch {
    map = {};
  }
}

function persist() {
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
  const entries = Object.entries(map);
  if (entries.length > MAX_ENTRIES) {
    map = Object.fromEntries(entries.slice(entries.length - MAX_ENTRIES));
  }
  fs.writeFileSync(STORE_FILE, JSON.stringify(map, null, 2));
}

/** Remember that a Telegram message corresponds to a given Instagram sender. */
function link(telegramMessageId, igSenderId) {
  map[telegramMessageId] = igSenderId;
  persist();
}

/** Look up which Instagram user a Telegram message came from. */
function getSenderFor(telegramMessageId) {
  return map[telegramMessageId] || null;
}

module.exports = { link, getSenderFor };

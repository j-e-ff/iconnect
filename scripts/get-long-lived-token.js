/**
 * Usage: node scripts/get-long-lived-token.js <SHORT_LIVED_TOKEN>
 *
 * Takes the short-lived token you get from the OAuth redirect (see README
 * step 4) and exchanges it for a long-lived (~60 day) token, then saves it
 * to data/token.json so the running app can use and auto-refresh it.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function main() {
  const shortLivedToken = process.argv[2];
  if (!shortLivedToken) {
    console.error('Usage: node scripts/get-long-lived-token.js <SHORT_LIVED_TOKEN>');
    process.exit(1);
  }

  const { IG_APP_SECRET } = process.env;
  if (!IG_APP_SECRET) {
    console.error('IG_APP_SECRET must be set in your .env file first.');
    process.exit(1);
  }

  try {
    const res = await axios.get('https://graph.instagram.com/access_token', {
      params: {
        grant_type: 'ig_exchange_token',
        client_secret: IG_APP_SECRET,
        access_token: shortLivedToken,
      },
    });

    const tokenData = { access_token: res.data.access_token, obtained_at: Date.now() };
    const tokenFile = path.join(__dirname, '..', 'data', 'token.json');
    fs.mkdirSync(path.dirname(tokenFile), { recursive: true });
    fs.writeFileSync(tokenFile, JSON.stringify(tokenData, null, 2));

    console.log('✅ Long-lived token saved to data/token.json');
    console.log(`   Expires in roughly ${Math.round(res.data.expires_in / 86400)} days.`);
    console.log('   The app will auto-refresh it before it expires as long as it keeps running.');
  } catch (err) {
    console.error('Failed to exchange token:', err.response?.data || err.message);
    process.exit(1);
  }
}

main();

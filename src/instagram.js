const axios = require('axios');
const config = require('./config');
const tokenStore = require('./tokenStore');

const BASE_URL = `https://graph.instagram.com/${config.igApiVersion}`;

/** Send a text DM to an Instagram-scoped user ID (IGSID). */
async function sendMessage(recipientId, text) {
  const url = `${BASE_URL}/${config.igUserId}/messages`;
  return axios.post(
    url,
    { recipient: { id: recipientId }, message: { text } },
    { params: { access_token: tokenStore.getAccessToken() } }
  );
}

/** Best-effort lookup of a sender's display name. Falls back to null. */
async function getUserProfile(igsid) {
  try {
    const res = await axios.get(`${BASE_URL}/${igsid}`, {
      params: { fields: 'name,username', access_token: tokenStore.getAccessToken() },
    });
    return res.data; // { name, username, id }
  } catch (err) {
    console.warn('[instagram] Could not fetch profile for', igsid, err.response?.data || err.message);
    return null;
  }
}

module.exports = { sendMessage, getUserProfile };

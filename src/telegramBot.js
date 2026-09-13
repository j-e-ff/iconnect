const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const instagram = require('./instagram');
const store = require('./store');

// Polling means Telegram doesn't need a public URL of its own — only the
// Instagram webhook (in index.js) needs to be publicly reachable.
const bot = new TelegramBot(config.telegramBotToken, { polling: true });

bot.on('polling_error', (err) => console.error('[telegram] Polling error:', err.message));

/** React with an emoji on a message (Bot API 7.0+). Falls back silently if unsupported. */
async function react(chatId, messageId, emoji) {
  try {
    await axios.post(`https://api.telegram.org/bot${config.telegramBotToken}/setMessageReaction`, {
      chat_id: chatId,
      message_id: messageId,
      reaction: [{ type: 'emoji', emoji }],
    });
  } catch (err) {
    // Non-critical — some older clients don't support reactions.
    console.warn('[telegram] Could not set reaction:', err.response?.data?.description || err.message);
  }
}

// Reply (Telegram's actual "reply" feature) to a forwarded message to send it back to Instagram.
bot.on('message', async (msg) => {
  if (String(msg.chat.id) !== String(config.telegramChatId)) return;
  if (!msg.reply_to_message) return; // only replies are treated as outgoing IG messages
  if (!msg.text) {
    await bot.sendMessage(msg.chat.id, "⚠️ I can only send text replies to Instagram right now.", {
      reply_to_message_id: msg.message_id,
    });
    return;
  }

  const senderId = store.getSenderFor(msg.reply_to_message.message_id);
  if (!senderId) {
    await bot.sendMessage(msg.chat.id, "⚠️ I can't tell which Instagram conversation this belongs to.", {
      reply_to_message_id: msg.message_id,
    });
    return;
  }

  try {
    await instagram.sendMessage(senderId, msg.text);
    await react(msg.chat.id, msg.message_id, '👍');
  } catch (err) {
    console.error('[telegram] Failed to send Instagram reply:', err.response?.data || err.message);
    await react(msg.chat.id, msg.message_id, '❌');
  }
});

/**
 * Post an incoming Instagram DM (text and/or attachments) into the Telegram
 * chat, and remember every resulting message so a reply to any of them can
 * be routed back to the right person.
 *
 * `content` shape: { text, attachments: [{ type, url, title }], unsupported }
 */
async function forwardInstagramMessage(senderId, content) {
  const profile = await instagram.getUserProfile(senderId);
  const displayName = profile?.username ? `@${profile.username}` : `IG user ${senderId}`;
  const header = `📩 Instagram DM from ${displayName}`;
  const chatId = config.telegramChatId;
  const sentIds = [];

  if (content.text) {
    const sent = await bot.sendMessage(chatId, `${header}\n\n${content.text}`);
    sentIds.push(sent.message_id);
  }

  for (const att of content.attachments || []) {
    let sent;
    try {
      if (att.type === 'image') {
        sent = await bot.sendPhoto(chatId, att.url, { caption: header });
      } else if (att.type === 'video') {
        sent = await bot.sendVideo(chatId, att.url, { caption: header });
      } else if (['share', 'ig_post', 'reel', 'ig_reel'].includes(att.type)) {
        // Shared reels/posts: not a raw media file, so send as a tappable
        // link. Telegram will usually render a preview card automatically.
        const caption = att.title ? `\n"${att.title}"` : '';
        sent = await bot.sendMessage(chatId, `${header}\n📎 Shared a reel/post${caption}\n${att.url}`);
      } else if (att.type === 'story_mention') {
        sent = await bot.sendMessage(chatId, `${header}\n📸 Mentioned you in their story\n${att.url}`);
      } else {
        sent = await bot.sendMessage(
          chatId,
          `${header}\n📎 Sent a ${att.type}${att.url ? `: ${att.url}` : ' (no link provided — check Instagram directly)'}`
        );
      }
    } catch (err) {
      // e.g. Telegram couldn't fetch the URL as a photo/video — fall back to a plain link.
      console.warn(`[telegram] Failed to send ${att.type} natively, falling back to link:`, err.message);
      sent = await bot.sendMessage(chatId, `${header}\n📎 (${att.type}) ${att.url || 'no link available'}`);
    }
    sentIds.push(sent.message_id);
  }

  if (content.unsupported) {
    const sent = await bot.sendMessage(
      chatId,
      `${header}\n⚠️ Sent something Instagram's API didn't give details for (often a reel, story reply, or multi-image share). Open Instagram directly to see it.`
    );
    sentIds.push(sent.message_id);
  }

  for (const id of sentIds) {
    store.link(id, senderId);
  }
}

function start() {
  return bot.getMe().then((me) => console.log(`[telegram] Logged in as @${me.username}`));
}

module.exports = { start, forwardInstagramMessage };

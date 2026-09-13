/**
 * Usage: npm run get-chat-id
 *
 * Message your bot on Telegram (search its @username, hit Start, send
 * anything) AFTER starting this script. It prints the chat ID to put in
 * .env as TELEGRAM_CHAT_ID.
 */
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('Set TELEGRAM_BOT_TOKEN in your .env first.');
  process.exit(1);
}

console.log('Now send any message to your bot on Telegram (e.g. "hi")...\n');

const bot = new TelegramBot(token, { polling: true });

bot.on('message', (msg) => {
  console.log(`✅ Your chat ID is: ${msg.chat.id}`);
  console.log('Put this in your .env as TELEGRAM_CHAT_ID, then press Ctrl+C to stop this script.');
});

bot.on('polling_error', (err) => console.error('Polling error:', err.message));

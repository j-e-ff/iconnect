require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.warn(`[config] Warning: ${name} is not set in your .env file.`);
  }
  return value;
}

module.exports = {
  igAppId: required('IG_APP_ID'),
  igAppSecret: required('IG_APP_SECRET'),
  igUserId: process.env.IG_USER_ID || 'me',
  igSeedAccessToken: process.env.IG_ACCESS_TOKEN,
  webhookVerifyToken: required('WEBHOOK_VERIFY_TOKEN'),
  port: process.env.PORT || 3000,
  telegramBotToken: required('TELEGRAM_BOT_TOKEN'),
  telegramChatId: required('TELEGRAM_CHAT_ID'),
  igApiVersion: 'v23.0',
};

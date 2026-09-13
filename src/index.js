const express = require('express');
const config = require('./config');
const tokenStore = require('./tokenStore');
const telegramBot = require('./telegramBot');

const app = express();
app.use(express.json());

// Health check — handy for confirming your host deployed the app correctly.
app.get('/', (req, res) => res.send('IG <-> Telegram bridge is running.'));

// Meta calls this once, with GET, to verify you control this URL.
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.webhookVerifyToken) {
    console.log('[webhook] Verified successfully.');
    res.status(200).send(challenge);
  } else {
    console.warn('[webhook] Verification failed — check WEBHOOK_VERIFY_TOKEN.');
    res.sendStatus(403);
  }
});

// Meta calls this with POST every time something happens (e.g. a new DM).
app.post('/webhook', async (req, res) => {
  // Acknowledge immediately — Meta expects a fast 200, retries if it doesn't get one.
  res.sendStatus(200);

  const body = req.body;
  if (body.object !== 'instagram') return;

  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      try {
        const message = event.message;
        if (!message || message.is_echo || message.is_deleted) continue; // skip our own sends
        const senderId = event.sender?.id;
        if (!senderId) continue;

        const content = {
          text: message.text || null,
          attachments: (message.attachments || []).map((a) => ({
            type: a.type,
            url: a.payload?.url,
            title: a.payload?.title,
          })),
          unsupported: !!message.is_unsupported,
        };

        const hasNothingToShow =
          !content.text && content.attachments.length === 0 && !content.unsupported;
        if (hasNothingToShow) continue;

        await telegramBot.forwardInstagramMessage(senderId, content);
      } catch (err) {
        console.error('[webhook] Error handling event:', err);
      }
    }
  }
});

async function main() {
  await telegramBot.start();
  tokenStore.startAutoRefresh();
  app.listen(config.port, () => {
    console.log(`[server] Listening on port ${config.port}`);
    console.log('[server] Point your Meta webhook config at: https://<your-host>/webhook');
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

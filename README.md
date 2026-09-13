# IG ↔ Telegram Bridge

Forwards your Instagram DMs (text, photos, videos, and shared reels/posts)
into Telegram, and turns a **reply** to one of those messages into a DM
sent back on Instagram. Works from any device logged into your Telegram
account — both phones, desktop app, or web — simultaneously, with no
"only whichever device is active" suppression like Discord has.

Built on Meta's official Instagram API with Instagram Login — free, no
App Review needed, since this only ever touches your own account
("Standard Access" per Meta's rules).

## How it works

```
Instagram DM  →  Meta webhook  →  this app  →  Telegram chat (message/photo/video)
                                                      │
Telegram reply →  this app  →  Instagram Send API  ←──┘
```

- Incoming DMs arrive as a message in your chat with the bot. Photos and
  videos are sent as native Telegram media; shared reels/posts arrive as a
  tappable link (Telegram usually renders a preview card for it).
- Reply (Telegram's actual "reply" feature, swipe or long-press → Reply) to
  that message to send a DM back to that person.
- A 👍 reaction means it sent; ❌ means it failed (check the logs).

## One-time setup

Meta's app dashboard UI changes fairly often, so instead of generic advice,
each step below tells you the exact screen and button label to look for.

### 1. Switch your Instagram account to Professional
Instagram app → Settings → Account type and tools → Switch to Professional
Account → Creator. Free, reversible, doesn't change your public profile.

### 2. Create the Meta app with the right use case
1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps) → **Create App**.
2. Enter an app name and contact email → **Next**.
3. On the **"Add use cases"** screen: click the **"Business messaging"** filter on the left, then select **"Manage messaging and content on Instagram"** → **Next**.
   - Do **not** pick the "Other" option at the bottom, even though it looks like a shortcut — Meta is retiring it, and the option above already gives you the correct permissions automatically.
4. Choose or create a Business Portfolio if prompted, click through the remaining screens, and finish creating the app.

You'll land on the app's Dashboard. For the rest of Instagram-specific setup,
go to the left sidebar → **Instagram** → **API setup with Instagram login**.
This page has a numbered checklist — steps 3–6 below all happen on this one
page, in different sections of that checklist.

### 3. Add your own Instagram account as a tester
This is the step that's easy to get stuck on, so here's exactly where it is:

1. On the **API setup with Instagram login** page, find the checklist section called **"Generate access tokens"** (this is usually item 1, at the very top). Click the **"Add account"** button inside it.
   - Equivalent alternate path, if you don't see that button: left sidebar → **App roles → Roles** → scroll to the **"Instagram testers"** section → **Add people**.
2. Type in the Instagram username of the account you switched to Professional in step 1 (this is your own username) and send the invite.
3. Now switch over to Instagram itself, logged in as that same account:
   - **In the app:** Settings → **Apps and websites** → **Tester invites** → accept.
   - **On the web:** go to `instagram.com/accounts/manage_connections/` → accept.
4. Go back to the Meta dashboard and confirm your account now shows as **Active** (not "Pending") in that testers list. If it's still Pending, the invite wasn't accepted yet, and step 5 below will fail with an authorization error until it is.

**In short: "add a person with a role" means add your own Instagram username via the "Add account" button, then go accept that invite from inside Instagram's own settings — it's a two-sided handshake, not a one-click thing.**

### 4. Get your App ID, App Secret, and set your redirect URI
1. On the same **API setup with Instagram login** page, open the **"Business login settings"** checklist section.
2. Copy the **Instagram app ID** and **Instagram app secret** shown here into your `.env` file as `IG_APP_ID` / `IG_APP_SECRET`.
   - Important: use the secret shown on *this specific page*, not the general "App Secret" under Settings → Basic elsewhere in the dashboard — for this product they're different values, and using the wrong one will fail silently later.
3. In the same section, find **"OAuth redirect URIs"** and add:
   ```
   https://localhost/callback
   ```
   Click save. This Business login settings screen is the *only* place this value gets registered — it never goes in your `.env` file, and there's no separate "Instagram API webpage" involved.

### 5. Get your first access token
1. Build this URL, filling in your own `IG_APP_ID`, and open it in a browser while logged into the Instagram account from step 3:
   ```
   https://www.instagram.com/oauth/authorize?client_id=<IG_APP_ID>&redirect_uri=https://localhost/callback&response_type=code&scope=instagram_business_basic,instagram_business_manage_messages
   ```
   (If step 3's invite isn't accepted yet, this will fail here with an authorization error — go back and fix that first.)
2. Approve it. Your browser will try to load `https://localhost/callback` and probably show a "can't reach this page" error — that's expected, nothing needs to actually run there. Copy the `code=...` value out of the address bar before closing the tab.
3. Copy `.env.example` to `.env` if you haven't yet, then exchange that code for a short-lived token:
   ```bash
   curl -X POST https://api.instagram.com/oauth/access_token \
     -F client_id=<IG_APP_ID> \
     -F client_secret=<IG_APP_SECRET> \
     -F grant_type=authorization_code \
     -F redirect_uri=https://localhost/callback \
     -F code=<CODE_FROM_STEP_2>
   ```
   This prints a short-lived `access_token`.
4. Exchange that for a long-lived one:
   ```bash
   npm install
   npm run get-token -- <SHORT_LIVED_TOKEN_FROM_STEP_3>
   ```
   This saves a long-lived (~60 day) token to `data/token.json`. The app renews it automatically from then on, as long as it keeps running.

### 6. Create your Telegram bot
1. Open Telegram, message **@BotFather**, send `/newbot`, follow the prompts (name + username).
2. BotFather gives you a token — put it in `.env` as `TELEGRAM_BOT_TOKEN`.
3. Search for your new bot's username in Telegram and send it any message (e.g. "hi") — this is what lets it message you back.
4. Run:
   ```bash
   npm run get-chat-id
   ```
   Then send another message to the bot if you haven't already — the script prints your chat ID. Put it in `.env` as `TELEGRAM_CHAT_ID`.
5. **Log into this same Telegram account on both of your phones plus desktop/web on your PC.** Telegram supports unlimited simultaneous devices per account with no suppression — all of them will get pushed to at once.

### 7. Deploy it somewhere with a public URL
Meta requires a public **HTTPS** URL for the Instagram webhook — `localhost` only worked for grabbing the token in step 5. Telegram itself doesn't need a public URL (this app polls Telegram; Telegram doesn't need to reach it), so this webhook endpoint is the only piece that needs hosting. Cheapest free options:
- **Railway** or **Render** free tier — push this folder as a repo, set the `.env` values as environment variables in their dashboard, deploy.
- **Self-host** on any machine you already leave running, paired with a free **Cloudflare Tunnel** to get a public HTTPS URL without opening router ports.

Either way, you'll end up with a URL like `https://your-app.up.railway.app`. You need this URL before step 8 will work.

### 8. Point Meta's webhook at your deployed app
1. Back on the **API setup with Instagram login** page, open the **"Configure webhooks"** checklist section.
2. **Callback URL:** `https://<your-deployed-url>/webhook`
3. **Verify token:** whatever you set as `WEBHOOK_VERIFY_TOKEN` in your `.env` — must match exactly.
4. Click **"Verify and save."** This only succeeds if your app is already deployed and running — Meta calls this URL live to test the handshake.
5. Once it's verified, subscribe to the **`messages`** field.

### 9. About "published state" and app review — you can mostly ignore these
- The webhook section may warn "to receive webhooks, your app must be in published state." This refers to switching your app from **Development** to **Live** mode (Settings → Basic — you'll need to fill in a privacy policy URL, icon, and category before the toggle allows it). This is a basic completeness check, **not** the same as full App Review.
- The checklist's **"Complete app review"** step doesn't apply to you: Meta only requires App Review/Advanced Access for apps serving *other people's* Instagram accounts. Since this only touches your own account, you're in the "Standard Access — no review required" category. Leave that step alone.

### 10. Run it
```bash
npm install
npm start
```
Send yourself a test DM on Instagram from another account — it should show up in Telegram within a few seconds, on every device you're logged in on.

## Limitations to know about
- **Text-only replies** — you can reply with text from Telegram; sending photos/videos back to Instagram isn't wired up yet (the Instagram API supports it — it's a straightforward extension in `src/instagram.js` and `src/telegramBot.js` if you want it later).
- **Reel/post share links can expire.** The links Instagram gives for shared reels/posts are signed and time-limited — open them soon after they arrive rather than treating them as permanent bookmarks.
- **Occasional "unsupported" messages.** Some reel shares, story replies, or multi-image shares can arrive from Instagram's API without full details (`is_unsupported: true`). You'll still get a heads-up message in Telegram in that case, just without a direct link — open Instagram itself to see that one.
- **24-hour reply window** — Meta only lets you message someone within 24 hours of their last message to you, standard across all Meta messaging APIs. Fine for normal back-and-forth, not for messaging someone out of the blue.
- **Token refresh needs the process running continuously.** If you stop the app for more than ~60 days, re-run `npm run get-token` with a fresh short-lived token (repeat step 5).
- **`data/store.json`** keeps the last 2000 Telegram-message-to-sender mappings so replies keep working after a restart.

# StreamDonate

Donation pages, live alerts and an OBS overlay for streamers. Plain HTML/CSS/JS frontend, zero-dependency Node.js (18+) backend.

## Run
```
cp .env.example .env     # DEV_MODE=1 for local testing
node server.js           # http://localhost:3000
```
1. Register at `/register.html` → dashboard.
2. Copy the **overlay URL** into OBS (Browser Source, 1920×1080). Add `&pos=bottom` or `&pos=center` to move alerts.
3. Open your donate page `/d/<username>`, donate, press **จำลองการชำระเงิน** (DEV_MODE only) → the alert appears in OBS.

## Payments (important)
A donation is created as **pending** and only becomes **paid** (and triggers an alert / counts in totals) when:
- `POST /api/webhook/<provider>` arrives with header `x-signature` = hex HMAC-SHA256 of the raw body using `WEBHOOK_SECRET`, body `{"donationId","status":"paid","amount"}`, and the amount equals the donation amount.
- `DEV_MODE=1` only: the simulate button. Those donations are flagged **TEST**, shown separately and excluded from real totals.

You still must connect a real provider (e.g. Omise / Stripe PromptPay): set `CHECKOUT_URL`, and map the provider's webhook to the format above (a small adapter in the webhook route; verify with the provider's own signature scheme if it differs). Without `DEV_MODE` or `CHECKOUT_URL`+`WEBHOOK_SECRET`, the server refuses to create donations.

## Layout
`server.js` API + SSE + static · `public/js/main.js` shared helpers & alert renderer · `dashboard.js` / `donation.js` / `overlay.js` / `auth.js` page logic · `public/css/style.css` all styles. Data is stored in `data.json` (swap for Supabase/SQL when scaling). Put behind HTTPS in production.

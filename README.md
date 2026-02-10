# Vision Resource Planning (Single Window Tool)

This is a full stack app (React + Vite frontend, Express API + MongoDB + Gemini Vision backend).
It matches your "small center upload window with surrounding result panels" layout.
Free uses are limited to 3 per device or signed-in email, then paywall triggers.
The base analysis now focuses on construction progress and resource planning (labor, machinery, materials, paint panel, special components, and completion requirements).

## Stack (MERN-ish, but Vercel sane)
- React (Vite)
- Node (Express API)
- MongoDB (Mongoose)
- Gemini API (@google/generative-ai)
- Tailwind CSS
- Montserrat font

## 1) Run locally
```bash
npm i
npm run dev
```

This starts:
- Vite dev server on http://localhost:5173
- API server on http://localhost:8787

## 2) Environment variables
Create `.env.local` in the project root:

```bash
# Required
MONGODB_URI="mongodb+srv://USER:PASS@cluster.mongodb.net/vitruvialyze?retryWrites=true&w=majority"
GEMINI_API_KEY="your_gemini_key"

# Optional (Stripe paywall)
APP_URL="http://localhost:5173"
STRIPE_SECRET_KEY="sk_live_or_test..."
STRIPE_PRICE_ID="price_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Optional (separate API host)
# VITE_API_BASE="https://your-api-host.com"

# Optional (cross-origin cookies)
# COOKIE_SAMESITE="none"
# COOKIE_SECURE="true"
```

If Stripe vars are not set, the Upgrade button will show an error. The free-3 logic still works.

## 3) Deploy
- Build: `npm run build`
- Serve API: `npm start` (uses `dist-server/server/index.js`)
- Serve frontend: any static host for `dist/`, or let the API serve `dist/` by setting `NODE_ENV=production`
- If you enable Stripe webhook:
  - Add webhook endpoint: `https://YOUR_DOMAIN/api/stripe/webhook`
  - Listen for event: `checkout.session.completed`

## Notes
- The sign-in is intentionally minimal: email-only, stored as a server session token cookie.
- Replace with a full auth provider later if you want real auth flows.
- The Gemini prompt forces JSON-only output and validates it with Zod.
- CORS is wide open by default (any origin, credentials allowed).
- Prompt tuning is editable in `config/prompt-tuning.json` (used by both base and risk prompts).

## Your tool mapping
Base run (`Generate` button):
- Tool 1: Capture + ingest
- Tool 2: Stage identifier
- Tool 3: Timeline & effort estimate
- Tool 5: Remaining scope analysis

Tool 10 (`Run Tool 10` button):
- Deviation analyzer (unlocks only after base run)

# EesyLoad Driver App — Capacitor Android Project

## What's in here
- `www/index.html` — driver app UI
- `www/driver-supabase-integration.js` — Supabase auth, documents, dispatch, trip status
- `android/` — native Android project (Capacitor-generated; regenerate with `npx cap add android` if incomplete)
- App ID: `eesyload.delivery.driver`

## First-time setup

```bash
npm install
npx cap sync android
npx cap open android
```

## Operational rules (2026-09-04)

The database is the source of truth for trips and approval:

- Unapproved drivers (`pending_review` / `rejected`) cannot go online or accept loads.
- Apply `supabase/migrations/20260904_enforce_driver_approval_and_online.sql` on the live project so this is enforced server-side, not only in the WebView.
- Trip actions persist `accepted → loading → in_transit → delivered`.
- Earnings UI reads `driver_payout` and `tip_amount`.
- Pending jobs are filtered by driver vehicle when the name can be classified.

## Known trial-account limitation (Twilio)

OTP SMS only reliably reaches Verified Caller IDs until the Twilio account is upgraded.

## Requirements
- Node.js 18+
- Android Studio with Android SDK
- A physical Android device or emulator

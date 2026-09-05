# Store blockers you still do by hand

1. Paystack Dashboard: replace pk_test with pk_live in www/paystack-config.js on the release build only.
2. Google Cloud: restrict the browser Maps key to eesyload.delivery.driver / rider package names and HTTP referrers.
3. Run this SQL: supabase/migrations/20260905_payout_requests.sql
4. iOS: `npx cap add ios` then archive in Xcode. Not done from this chat.
5. Play / App Store listings: use www/legal/privacy.html and support.html URLs.
6. Agent bookings stay cash / unpaid until you add Paystack on that flow.

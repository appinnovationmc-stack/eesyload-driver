import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Vonage Messages API (api.nexmo.com/v1/messages) - this is Vonage's own
// recommended endpoint over the legacy SMS API (rest.nexmo.com/sms/json).
// For the SMS channel, the Messages API accepts plain API key/secret Basic
// Auth as long as the account's "API key & secret" signature method is
// enabled in the Vonage dashboard (API settings) - no JWT/application
// needed for SMS. WhatsApp (and other non-SMS channels) on the Messages API
// require JWT signed with a Messages & Dispatch application's private key
// instead of API key/secret, which isn't wired up yet - see the 501 below.
const VONAGE_CHANNEL = (Deno.env.get("VONAGE_CHANNEL") || "sms").toLowerCase();

function toE164SA(raw: string): string {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("27") && digits.length > 9) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  return "27" + digits; // no leading '+'
}

async function sendVonageSms(to: string, body: string) {
  const apiKey = Deno.env.get("VONAGE_API_KEY")!;
  const apiSecret = Deno.env.get("VONAGE_API_SECRET")!;
  // Secret is named VONAGE_FROM_NUMBER in Supabase (not VONAGE_FROM) -
  // confirmed against the actual secrets list on 2026-10-04.
  const from = Deno.env.get("VONAGE_FROM_NUMBER")!; // alphanumeric sender id (e.g. 'EesyLoad') or a number

  const basicAuth = btoa(`${apiKey}:${apiSecret}`);

  const res = await fetch("https://api.nexmo.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${basicAuth}`,
    },
    body: JSON.stringify({
      message_type: "text",
      text: body,
      to,
      from,
      channel: "sms",
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.message_uuid) {
    // Vonage's Messages API error shape: { type, title, detail, invalid_parameters }
    const detail = json?.detail || json?.title || JSON.stringify(json);
    throw new Error(`Vonage send failed (HTTP ${res.status}): ${detail}`);
  }
  return json;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return Response.json({ error: "Not signed in" }, { status: 401, headers: cors });
    }
    const user = userData.user;

    const body = await req.json();
    const bookingId = String(body.booking_id || "");
    const messageId = body.message_id ? String(body.message_id) : null;
    const text = String(body.body || "").slice(0, 1500);
    if (!bookingId || !text) {
      return Response.json({ error: "Missing booking_id or body" }, { status: 400, headers: cors });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: booking, error: bErr } = await admin.from("bookings")
      .select("id,driver_id,agent_driver_id,rider_id,customer_phone,is_agent_booking")
      .eq("id", bookingId).maybeSingle();
    if (bErr || !booking) {
      return Response.json({ error: "Booking not found" }, { status: 404, headers: cors });
    }
    if (booking.rider_id) {
      return Response.json({ error: "This booking has an app customer; nothing to bridge" }, { status: 400, headers: cors });
    }
    if (user.id !== booking.driver_id && user.id !== booking.agent_driver_id) {
      return Response.json({ error: "Not authorized for this booking" }, { status: 403, headers: cors });
    }
    if (!booking.customer_phone) {
      return Response.json({ error: "No customer phone on file for this booking" }, { status: 400, headers: cors });
    }

    if (VONAGE_CHANNEL === "whatsapp") {
      return Response.json({
        error: "WhatsApp via Vonage isn't set up yet (needs the Messages API + JWT application credentials, separate from the API key/secret used for SMS). Set VONAGE_CHANNEL back to 'sms', or ask for WhatsApp to be wired up.",
      }, { status: 501, headers: cors });
    }

    const toNumber = toE164SA(booking.customer_phone);
    await sendVonageSms(toNumber, text);

    if (messageId) {
      await admin.from("booking_messages").update({ channel: "sms" }).eq("id", messageId);
    }

    return Response.json({ ok: true, channel: "sms" }, { headers: cors });
  } catch (e) {
    console.error("send-customer-message error", e);
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500, headers: cors });
  }
});

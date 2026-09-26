import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

// Drivers call this to confirm they physically collected cash for a
// cash-on-delivery booking. Deliberately NOT relying on the general
// "drivers can update their own bookings" RLS policy for this — that
// policy allows arbitrary column writes, which would let a driver mark
// ANY booking (including card bookings) as paid with no real check.
// This function only flips payout_status for bookings that are
// genuinely payment_method='cash' and genuinely assigned to the caller.

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    try {
      const user = ctx.userClaims;
      if (!user) {
        return Response.json({ error: "Not signed in" }, { status: 401 });
      }

      const { booking_id } = await req.json();
      if (!booking_id) {
        return Response.json({ error: "Missing booking_id" }, { status: 400 });
      }

      const { data: booking, error: fetchErr } = await ctx.supabaseAdmin
        .from("bookings")
        .select("id, driver_id, payment_method, payout_status, status")
        .eq("id", booking_id)
        .single();

      if (fetchErr || !booking) {
        return Response.json({ error: "Booking not found" }, { status: 404 });
      }

      if (booking.driver_id !== user.id) {
        return Response.json({ error: "This booking is not assigned to you" }, { status: 403 });
      }

      if (booking.payment_method !== "cash") {
        return Response.json({ error: "This booking is not a cash booking" }, { status: 400 });
      }

      if (booking.payout_status === "paid") {
        // Already confirmed — treat as success, not an error, since a
        // double-tap on the confirm button shouldn't surface a scary message.
        return Response.json({ ok: true, already_confirmed: true });
      }

      const { error: updateErr } = await ctx.supabaseAdmin
        .from("bookings")
        .update({ payout_status: "paid" })
        .eq("id", booking_id)
        .eq("driver_id", user.id)
        .eq("payment_method", "cash");

      if (updateErr) {
        console.error("Failed to confirm cash payment", updateErr);
        return Response.json({ error: "Could not confirm payment" }, { status: 500 });
      }

      return Response.json({ ok: true });
    } catch (e) {
      console.error("confirm-cash-payment error", e);
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  }),
};

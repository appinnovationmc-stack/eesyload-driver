import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const user = ctx.userClaims;
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

    const body = await req.json();
    const pickup = body.pickup_address;
    const dropoff = body.dropoff_address;
    const vehicleName = body.vehicle_name || body.vehicle;
    const assign = body.assign_mode === "self" ? "self" : "pool";
    if (!pickup || !dropoff || !vehicleName) {
      return Response.json({ error: "Missing pickup, drop-off or vehicle" }, { status: 400 });
    }

    const { data: vehicle, error: vErr } = await ctx.supabaseAdmin
      .from("vehicle_types").select("id,name,base_price,per_km_rate")
      .eq("active", true);
    if (vErr) return Response.json({ error: vErr.message }, { status: 500 });
    const match = (vehicle || []).find((v) => String(v.name).toLowerCase() === String(vehicleName).toLowerCase());

    let total = Number(body.total_fare) || 0;
    if (!total && match) total = Number(match.base_price) || 0;

    const row = {
      status: assign === "self" ? "accepted" : "pending",
      driver_id: assign === "self" ? user.id : null,
      pickup_address: pickup,
      dropoff_address: dropoff,
      vehicle_name: match ? match.name : vehicleName,
      total_fare: total,
      notes: body.notes || null,
      accepted_at: assign === "self" ? new Date().toISOString() : null,
    };

    const { data, error } = await ctx.supabaseAdmin.from("bookings").insert(row).select().single();
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ booking: data });
  }),
};

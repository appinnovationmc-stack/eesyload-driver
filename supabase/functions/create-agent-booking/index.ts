import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" } });
  }
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }
    const user = userData.user;
    const body = await req.json();
    const pickup = body.pickup_address;
    const dropoff = body.dropoff_address;
    const vehicleName = body.vehicle_name || body.vehicle;
    const assign = body.assign_mode === "self" ? "self" : "pool";
    if (!pickup || !dropoff || !vehicleName) {
      return Response.json({ error: "Missing pickup, drop-off or vehicle" }, { status: 400 });
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: vehicles } = await admin.from("vehicle_types").select("id,name,base_price,per_km_rate").eq("active", true);
    const match = (vehicles || []).find((v) => String(v.name).toLowerCase() === String(vehicleName).toLowerCase());
    let total = Number(body.total_fare) || 0;
    if (!total && match) total = Number(match.base_price) || 0;
    const row: Record<string, unknown> = {
      status: assign === "self" ? "accepted" : "pending",
      driver_id: assign === "self" ? user.id : null,
      pickup_address: pickup,
      dropoff_address: dropoff,
      vehicle_name: match ? match.name : vehicleName,
      total_fare: total,
    };
    if (assign === "self") row.accepted_at = new Date().toISOString();
    const { data, error } = await admin.from("bookings").insert(row).select().single();
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ booking: data });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});

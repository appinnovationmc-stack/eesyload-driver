import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

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
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: profile } = await admin.from("profiles")
      .select("id,role,driver_status")
      .eq("id", user.id).maybeSingle();
    const role = String(profile?.role || "");
    const status = String(profile?.driver_status || "").toLowerCase();
    if (role !== "driver" || !["approved", "active"].includes(status)) {
      return Response.json({ error: "Only approved drivers can create agent bookings" }, { status: 403, headers: cors });
    }
    const body = await req.json();
    const pickup = String(body.pickup_address || "").slice(0, 300);
    const dropoff = String(body.dropoff_address || "").slice(0, 300);
    const vehicleName = String(body.vehicle_name || body.vehicle || "").slice(0, 40);
    const assign = body.assign_mode === "self" ? "self" : "pool";
    if (!pickup || !dropoff || !vehicleName) {
      return Response.json({ error: "Missing pickup, drop-off or vehicle" }, { status: 400, headers: cors });
    }
    const { data: vehicles } = await admin.from("vehicle_types")
      .select("id,name,base_price,per_km_rate").eq("active", true);
    const match = (vehicles || []).find((v) => String(v.name).toLowerCase() === vehicleName.toLowerCase());
    if (!match) {
      return Response.json({ error: "Unknown vehicle type" }, { status: 400, headers: cors });
    }
    const base = Number(match.base_price) || 0;
    const perKm = Number(match.per_km_rate) || 0;
    let total = base;
    const mapsKey = Deno.env.get("GOOGLE_MAPS_SERVER_KEY");
    if (mapsKey && perKm) {
      const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
      url.searchParams.set("origins", pickup);
      url.searchParams.set("destinations", dropoff);
      url.searchParams.set("key", mapsKey);
      const dm = await fetch(url.toString()).then((r) => r.json());
      const el = dm?.rows?.[0]?.elements?.[0];
      if (el && el.status === "OK") {
        total = Math.round(base + (el.distance.value / 1000) * perKm);
      }
    }
    const row: Record<string, unknown> = {
      status: assign === "self" ? "accepted" : "pending",
      driver_id: assign === "self" ? user.id : null,
      pickup_address: pickup,
      dropoff_address: dropoff,
      vehicle_name: match.name,
      total_fare: total,
    };
    if (assign === "self") row.accepted_at = new Date().toISOString();
    const { data, error } = await admin.from("bookings").insert(row).select().single();
    if (error) return Response.json({ error: error.message }, { status: 400, headers: cors });
    return Response.json({ booking: data }, { headers: cors });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: cors });
  }
});

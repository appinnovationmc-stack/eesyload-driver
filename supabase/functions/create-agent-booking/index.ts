import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

// Map UI vehicle chips → DB vehicle_types.name
const VEHICLE_ALIASES: Record<string, string[]> = {
  moto: ["moto", "motorbike", "bike", "motorcycle"],
  bakkie: ["bakkie", "pickup"],
  van: ["van", "panel"],
  "4-ton": ["4-ton", "4ton", "4 ton"],
  "8-ton": ["8-ton", "8ton", "8 ton"],
};

function matchVehicle(vehicles: { id: string; name: string; base_price: number; per_km_rate: number }[], raw: string) {
  const key = String(raw || "").toLowerCase().trim();
  let match = vehicles.find((v) => v.name.toLowerCase() === key);
  if (match) return match;
  match = vehicles.find((v) => key.includes(v.name.toLowerCase()) || v.name.toLowerCase().includes(key));
  if (match) return match;
  for (const v of vehicles) {
    const aliases = VEHICLE_ALIASES[v.name.toLowerCase()] || [];
    if (aliases.some((a) => key.includes(a) || a.includes(key))) return v;
  }
  return null;
}

function makeTrackingToken() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let t = "";
  for (let i = 0; i < 12; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
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
    const vehicleRaw = String(body.vehicle_name || body.vehicle || "").slice(0, 40);
    const customerName = String(body.customer_name || "").trim().slice(0, 120);
    const customerPhone = String(body.customer_phone || "").replace(/\D/g, "").slice(0, 20);
    const notes = String(body.notes || body.agent_notes || "").slice(0, 500);
    const assign = body.assign_mode === "self" ? "self" : "pool";

    if (!pickup || !dropoff || !vehicleRaw) {
      return Response.json({ error: "Missing pickup, drop-off or vehicle" }, { status: 400, headers: cors });
    }
    if (!customerName || customerPhone.length < 9) {
      return Response.json({ error: "Customer name and valid phone are required" }, { status: 400, headers: cors });
    }

    const { data: vehicles } = await admin.from("vehicle_types")
      .select("id,name,base_price,per_km_rate").eq("active", true);
    const match = matchVehicle(vehicles || [], vehicleRaw);
    if (!match) {
      return Response.json({ error: "Unknown vehicle type: " + vehicleRaw }, { status: 400, headers: cors });
    }

    const base = Number(match.base_price) || 0;
    const perKm = Number(match.per_km_rate) || 0;
    let distanceKm = 0;
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
        distanceKm = el.distance.value / 1000;
        total = Math.round(base + distanceKm * perKm);
      }
    }

    const agentFee = assign === "pool" ? Math.round(total * 0.12) : 0;

    const row: Record<string, unknown> = {
      is_agent_booking: true,
      rider_id: null,
      customer_name: customerName,
      customer_phone: customerPhone,
      agent_driver_id: user.id,
      agent_notes: notes || null,
      agent_fee_amount: agentFee,

      status: assign === "self" ? "accepted" : "pending",
      driver_id: assign === "self" ? user.id : null,
      pickup_address: pickup,
      dropoff_address: dropoff,
      vehicle_type_id: match.id,
      vehicle_name: match.name,
      base_fare: base,
      total_fare: total,
      addons: [],
      addons_total: 0,

      payment_method: "cash",
      paystack_verified: false,
      paystack_reference: null,
      payout_status: "pending",
      tip_amount: 0,
      load_surcharge_amount: 0,
      tracking_token: makeTrackingToken(),
    };
    if (assign === "self") row.accepted_at = new Date().toISOString();

    const { data, error } = await admin.from("bookings").insert(row).select().single();
    if (error) {
      console.error("create-agent-booking insert failed", error);
      return Response.json({ error: error.message }, { status: 400, headers: cors });
    }

    return Response.json({
      booking: data,
      total_fare: total,
      agent_fee_amount: agentFee,
      distance_km: Math.round(distanceKm * 10) / 10,
    }, { headers: cors });
  } catch (e) {
    console.error("create-agent-booking error", e);
    return Response.json({ error: String(e) }, { status: 500, headers: cors });
  }
});

function riderVehicleName(key) {
  const k = typeof normalizeVehicleKey === 'function' ? normalizeVehicleKey(key) : String(key || '').toLowerCase();
  return ({ motorbike: 'Moto', bakkie: 'Bakkie', van: 'Van', '4ton': '4-Ton', '8ton': '8-Ton' })[k] || key;
}

async function getVehicleTypesForDriver() {
  const { data, error } = await sb.from('vehicle_types').select('*').eq('active', true).order('sort_order');
  if (error) throw error;
  return data || [];
}

async function getFareQuote({ pickup_address, dropoff_address, vehicle_type }) {
  const { data, error } = await sb.functions.invoke('get-fare-quote', {
    body: { pickup_address, dropoff_address, vehicle_type, addon_ids: [] }
  });
  if (error) {
    let msg = error.message || 'Could not quote';
    try { const ctx = await error.context.json(); if (ctx && ctx.error) msg = ctx.error; } catch (e) {}
    throw new Error(msg);
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}

window.updateBfcEstimate = async function updateBfcEstimate() {
  const pickup = (document.getElementById('bfcPickup') || {}).value || '';
  const drop = (document.getElementById('bfcDropoff') || {}).value || '';
  const fareEl = document.getElementById('bfcEstFare');
  const earnEl = document.getElementById('bfcEstEarn');
  const name = riderVehicleName((window.bfcState && bfcState.vehicle) || 'bakkie');
  let fare = 0;
  try {
    if (pickup.trim() && drop.trim()) {
      const q = await getFareQuote({ pickup_address: pickup.trim(), dropoff_address: drop.trim(), vehicle_type: name });
      fare = Number(q.total_fare) || 0;
      window._bfcQuote = q;
    } else {
      const types = await getVehicleTypesForDriver();
      const row = types.find((v) => riderVehicleName(v.name) === name || v.name === name);
      fare = row ? Math.round(Number(row.base_price) || 0) : 0;
      window._bfcQuote = { total_fare: fare, vehicle_type: name };
    }
  } catch (e) {
    console.error(e);
    fare = 0;
  }
  const assign = (window.bfcState && bfcState.assign) || 'pool';
  const earn = assign === 'self' ? Math.round(fare * 0.85) : Math.round(fare * 0.12);
  if (fareEl) fareEl.textContent = fare ? ('R ' + fare) : '—';
  if (earnEl) earnEl.textContent = fare ? ('R ' + earn) : '—';
};

const _origCreate = window.createAgentBooking;
window.createAgentBooking = async function (payload) {
  const name = riderVehicleName(payload.vehicle);
  const q = window._bfcQuote || {};
  return _origCreate({
    ...payload,
    vehicle: name,
    vehicle_name: name,
    total_fare: q.total_fare || payload.total_fare,
    quote_id: q.quote_id || null
  });
};

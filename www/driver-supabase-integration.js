/* ============================================================
   EesyLoad DRIVER APP — Supabase Integration Layer
   ============================================================ */

const SUPABASE_URL = 'https://mbtqqnbklcltrtwlpduq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ff0SBElpjzVkCaHyPHAYUQ_1sOCyRES';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const APPROVED_STATUSES = ['approved', 'active'];

function isApprovedStatus(status) {
  return APPROVED_STATUSES.includes(String(status || '').toLowerCase());
}

function normalizeVehicleKey(raw) {
  const s = String(raw || '').toLowerCase();
  if (!s) return '';
  if (s.includes('motor') || s.includes('bike')) return 'motorbike';
  if (s.includes('bakkie') || s.includes('pickup')) return 'bakkie';
  if (s.includes('van') || s.includes('panel')) return 'van';
  if (s.includes('4-ton') || s.includes('4 ton') || s.includes('4ton')) return '4ton';
  if (s.includes('8-ton') || s.includes('8 ton') || s.includes('8ton') || s.includes('flatbed')) return '8ton';
  return s.replace(/[^a-z0-9]+/g, '');
}

function vehicleMatchesDriver(bookingVehicle, driverVehicle) {
  const b = normalizeVehicleKey(bookingVehicle);
  const d = normalizeVehicleKey(driverVehicle);
  if (!b || !d) return true;
  return b === d;
}

function driverPayoutFromBooking(b) {
  if (!b) return 0;
  const ledger = Number(b.driver_payout);
  if (Number.isFinite(ledger) && ledger > 0) return Math.round(ledger);
  const fare = Number(b.total_fare) || 0;
  const pct = Number(b.commission_pct);
  if (fare && Number.isFinite(pct)) return Math.round(fare * (1 - pct / 100));
  return Math.round(fare);
}

function tipAmountFromBooking(b) {
  if (!b) return 0;
  const n = Number(b.tip_amount != null ? b.tip_amount : b.tip);
  return Number.isFinite(n) ? n : 0;
}

async function sbSendOtp(phone) {
  const { error } = await sb.auth.signInWithOtp({ phone });
  if (error) throw error;
}

async function sbVerifyOtp(phone, token) {
  const { data, error } = await sb.auth.verifyOtp({ phone, token, type: 'sms' });
  if (error) throw error;
  const { data: existing } = await sb.from('profiles').select('id').eq('id', data.user.id).single();
  if (!existing) {
    await sb.from('profiles').insert({ id: data.user.id, role: 'driver', phone, driver_status: 'pending_review' });
  }
  return data.user;
}

async function sbGetCurrentUser() {
  const { data } = await sb.auth.getUser();
  return data.user;
}

async function sbSignOut() {
  const { error } = await sb.auth.signOut();
  if (error) throw error;
}

async function getMyDriverProfile() {
  const user = await sbGetCurrentUser();
  if (!user) return null;
  const { data, error } = await sb.from('profiles')
    .select('id,role,phone,full_name,vehicle_type,vehicle_plate,driver_status,is_online,avatar_url,vehicle_photo_url')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function submitDriverApplicationToSupabase(name, vehicleType, plate) {
  const user = await sbGetCurrentUser();
  if (!user) throw new Error('Not signed in');
  const { data: existing } = await sb.from('profiles').select('id,driver_status').eq('id', user.id).single();
  if (!existing) {
    const { error: insertError } = await sb.from('profiles').insert({
      id: user.id,
      role: 'driver',
      phone: user.phone,
      full_name: name,
      vehicle_type: vehicleType,
      vehicle_plate: plate.toUpperCase(),
      driver_status: 'pending_review',
      is_online: false,
    });
    if (insertError) throw insertError;
    return;
  }
  const patch = {
    full_name: name,
    vehicle_type: vehicleType,
    vehicle_plate: plate.toUpperCase(),
  };
  if (existing.driver_status === 'pending_review' || existing.driver_status === 'rejected') {
    patch.driver_status = 'pending_review';
    patch.is_online = false;
  }
  const { error } = await sb.from('profiles').update(patch).eq('id', user.id);
  if (error) throw error;
}

async function uploadDriverDocument(docType, file) {
  const user = await sbGetCurrentUser();
  const path = `${user.id}/${docType}-${Date.now()}.${file.name.split('.').pop()}`;
  const { error: uploadError } = await sb.storage.from('driver-documents').upload(path, file);
  if (uploadError) throw uploadError;
  const { data: urlData, error: signError } = await sb.storage.from('driver-documents').createSignedUrl(path, 60 * 60 * 24 * 30);
  if (signError) throw signError;
  const { error } = await sb.from('driver_documents').insert({
    driver_id: user.id, doc_type: docType, file_url: urlData.signedUrl,
  });
  if (error) throw error;
}

async function uploadDriverAvatar(file) {
  const user = await sbGetCurrentUser();
  const path = `${user.id}/avatar-${Date.now()}.${file.name.split('.').pop()}`;
  const { error: uploadError } = await sb.storage.from('driver-avatars').upload(path, file);
  if (uploadError) throw uploadError;
  const { data: urlData, error: signError } = await sb.storage.from('driver-avatars').createSignedUrl(path, 60 * 60 * 24 * 30);
  if (signError) throw signError;
  const { error } = await sb.from('profiles').update({ avatar_url: urlData.signedUrl }).eq('id', user.id);
  if (error) throw error;
  return urlData.signedUrl;
}

async function uploadVehiclePhoto(file) {
  const user = await sbGetCurrentUser();
  const path = `${user.id}/vehicle-${Date.now()}.${file.name.split('.').pop()}`;
  const { error: uploadError } = await sb.storage.from('vehicle-photos').upload(path, file);
  if (uploadError) throw uploadError;
  const { data: urlData, error: signError } = await sb.storage.from('vehicle-photos').createSignedUrl(path, 60 * 60 * 24 * 30);
  if (signError) throw signError;
  const { error } = await sb.from('profiles').update({ vehicle_photo_url: urlData.signedUrl }).eq('id', user.id);
  if (error) throw error;
  return urlData.signedUrl;
}

async function createAgentBooking({ customer_name, customer_phone, pickup_address, dropoff_address, vehicle, assign_mode, notes }) {
  const { data, error } = await sb.functions.invoke('create-agent-booking', {
    body: { customer_name, customer_phone, pickup_address, dropoff_address, vehicle, assign_mode, notes },
  });
  if (error) {
    let msg = error.message || 'Could not create booking';
    try {
      const ctx = await error.context.json();
      if (ctx && ctx.error) msg = ctx.error;
    } catch (e) {}
    throw new Error(msg);
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}

async function setDriverOnline(isOnline) {
  const profile = await getMyDriverProfile();
  if (!profile) throw new Error('Not signed in');
  if (isOnline && !isApprovedStatus(profile.driver_status)) {
    throw new Error('Your account is still under review. You can go online once approved.');
  }
  const { error } = await sb.from('profiles').update({ is_online: !!isOnline }).eq('id', profile.id);
  if (error) throw error;
  return !!isOnline;
}

async function updateDriverLocation(lat, lng, heading) {
  const user = await sbGetCurrentUser();
  if (!user) return;
  const { error } = await sb.from('driver_locations').upsert({
    driver_id: user.id, lat, lng, heading, updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

async function getPendingBookings(opts) {
  const driverVehicle = opts && opts.vehicleType;
  const excludeIds = (opts && opts.excludeIds) || [];
  const { data, error } = await sb.from('bookings')
    .select('*')
    .eq('status', 'pending')
    .is('driver_id', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).filter((b) => {
    if (excludeIds.includes(b.id)) return false;
    return vehicleMatchesDriver(b.vehicle_name || b.vehicle, driverVehicle);
  });
}

function subscribeToIncomingBookings(onNewBooking, onStatusChange, onBookingUpdate) {
  return sb.channel('pending-bookings')
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'bookings'
    }, (payload) => {
      const row = payload.new;
      if (row && row.status === 'pending' && !row.driver_id) onNewBooking(row);
    })
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'bookings'
    }, (payload) => {
      if (onBookingUpdate) onBookingUpdate(payload.new, payload.old);
    })
    .subscribe((status, err) => { if (onStatusChange) onStatusChange(status, err); });
}

async function acceptBooking(bookingId) {
  const profile = await getMyDriverProfile();
  if (!profile) throw new Error('Not signed in');
  if (!isApprovedStatus(profile.driver_status)) {
    throw new Error('Your account is still under review.');
  }
  const { data, error } = await sb.from('bookings')
    .update({ driver_id: profile.id, status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', bookingId).eq('status', 'pending').is('driver_id', null)
    .select().single();
  if (error || !data) return null;
  return data;
}

async function getRiderProfile(riderId) {
  const { data, error } = await sb.from('profiles').select('full_name,phone').eq('id', riderId).single();
  if (error) throw error;
  return data;
}

async function updateBookingStatus(bookingId, status) {
  const patch = { status };
  if (status === 'delivered') patch.delivered_at = new Date().toISOString();
  const { data, error } = await sb.from('bookings')
    .update(patch)
    .eq('id', bookingId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function cancelBookingAsDriver(bookingId) {
  const { error } = await sb.from('bookings')
    .update({ status: 'cancelled_driver', cancelled_at: new Date().toISOString() })
    .eq('id', bookingId);
  if (error) throw error;
}

async function getDriverEarnings() {
  const user = await sbGetCurrentUser();
  const { data, error } = await sb.from('bookings')
    .select('*').eq('driver_id', user.id).eq('status', 'delivered')
    .order('delivered_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function uploadDeliveryPhoto(bookingId, file) {
  const user = await sbGetCurrentUser();
  const path = `${user.id}/${bookingId}-photo-${Date.now()}.${file.name.split('.').pop()}`;
  const { error: uploadError } = await sb.storage.from('delivery-photos').upload(path, file);
  if (uploadError) throw uploadError;
  const { data: urlData, error: signError } = await sb.storage.from('delivery-photos').createSignedUrl(path, 60 * 60 * 24 * 30);
  if (signError) throw signError;
  const { error } = await sb.from('bookings').update({ delivery_photo_url: urlData.signedUrl }).eq('id', bookingId);
  if (error) throw error;
  return urlData.signedUrl;
}

async function uploadDeliverySignature(bookingId, blob) {
  const user = await sbGetCurrentUser();
  const path = `${user.id}/${bookingId}-signature-${Date.now()}.png`;
  const { error: uploadError } = await sb.storage.from('delivery-photos').upload(path, blob, { contentType: 'image/png' });
  if (uploadError) throw uploadError;
  const { data: urlData, error: signError } = await sb.storage.from('delivery-photos').createSignedUrl(path, 60 * 60 * 24 * 30);
  if (signError) throw signError;
  const { error } = await sb.from('bookings').update({ delivery_signature_url: urlData.signedUrl }).eq('id', bookingId);
  if (error) throw error;
  return urlData.signedUrl;
}

async function sendBookingMessage(bookingId, body) {
  const user = await sbGetCurrentUser();
  const { error } = await sb.from('booking_messages')
    .insert({ booking_id: bookingId, sender_id: user.id, body });
  if (error) throw error;
}

function subscribeToBookingMessages(bookingId, onMessage) {
  return sb.channel(`messages-${bookingId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'booking_messages', filter: `booking_id=eq.${bookingId}`
    }, (payload) => onMessage(payload.new))
    .subscribe();
}

async function getBookingMessages(bookingId) {
  const { data, error } = await sb.from('booking_messages')
    .select('*').eq('booking_id', bookingId).order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

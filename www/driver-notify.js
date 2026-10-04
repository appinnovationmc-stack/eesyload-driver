(function () {
  'use strict';
  var ctx = null, loop = null, stopTimer = null, uid = null, bootedFor = null, chan = null, offerId = null;

  function audio() {
    if (!ctx) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); }
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    return ctx;
  }
  function tone(freq, start, dur, vol) {
    var c = audio(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain(), t = c.currentTime + start;
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  function ding() { tone(988, 0, 0.35, 0.6); tone(1319, 0.25, 0.5, 0.6); }
  function chime() { tone(784, 0, 0.25, 0.4); tone(988, 0.2, 0.35, 0.4); }
  function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

  function startOfferAlert(id) {
    offerId = id || offerId;
    if (loop) return;
    ding(); buzz([400, 200, 400]);
    loop = setInterval(function () { ding(); buzz([400, 200, 400]); }, 2000);
    stopTimer = setTimeout(stopOfferAlert, 30000);
  }
  function stopOfferAlert() {
    if (loop) clearInterval(loop);
    if (stopTimer) clearTimeout(stopTimer);
    loop = stopTimer = null; buzz(0);
  }
  document.addEventListener('touchstart', function () { audio(); if (loop) stopOfferAlert(); }, { passive: true });
  document.addEventListener('click', function () { audio(); });

  function subscribe() {
    if (chan || typeof sb === 'undefined') return;
    chan = sb.channel('driver-notify')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings' }, function (p) {
        var b = p.new;
        if (b && b.status === 'pending' && !b.driver_id && !b.is_agent_booking) startOfferAlert(b.id);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings' }, function (p) {
        var b = p.new; if (!b) return;
        if (b.status === 'pending' && !b.driver_id && b.offered_to === uid && b.id !== offerId) { startOfferAlert(b.id); return; }
        if (b.id === offerId && b.status !== 'pending') stopOfferAlert();
        if (b.driver_id === uid && (b.status === 'cancelled_rider' || b.status === 'cancelled_customer')) { chime(); buzz([200, 100, 200]); }
      })
      .subscribe();
  }

  async function initPush() {
    var cap = window.Capacitor;
    if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
    var PN = cap.Plugins && cap.Plugins.PushNotifications;
    if (!PN) { console.warn('PushNotifications plugin missing'); return; }
    try {
      var perm = await PN.checkPermissions();
      if (perm.receive !== 'granted') perm = await PN.requestPermissions();
      if (perm.receive !== 'granted') return;
      await PN.createChannel({ id: 'trip_offers', name: 'Trip requests', description: 'New trip requests', importance: 5, sound: 'offer_alert.wav', vibration: true, visibility: 1, lights: true });
      await PN.createChannel({ id: 'trip_updates', name: 'Trip updates', description: 'Trip status updates', importance: 4, vibration: true, visibility: 1 });
      await PN.removeAllListeners();
      PN.addListener('registration', function (t) {
        sb.rpc('register_device_token', { p_token: t.value, p_app: 'driver' }).then(function (r) { if (r.error) console.error('token register failed', r.error); });
      });
      PN.addListener('registrationError', function (e) { console.error('push registration error', e); });
      PN.addListener('pushNotificationReceived', function (n) {
        if (n && n.data && n.data.type === 'offer') startOfferAlert(n.data.booking_id);
      });
      await PN.register();
    } catch (e) { console.error('push init failed', e); }
  }

  function boot(user) {
    if (!user || bootedFor === user.id) return;
    bootedFor = user.id; uid = user.id;
    subscribe(); initPush();
  }
  function teardown() {
    uid = null; bootedFor = null; stopOfferAlert();
    if (chan && typeof sb !== 'undefined') { sb.removeChannel(chan); }
    chan = null;
  }
  function init() {
    if (typeof sb === 'undefined') { setTimeout(init, 500); return; }
    sb.auth.getSession().then(function (r) { var s = r.data && r.data.session; if (s) boot(s.user); });
    sb.auth.onAuthStateChange(function (evt, session) {
      if (session && session.user) boot(session.user); else teardown();
    });
  }

  window.DriverNotify = { startOfferAlert: startOfferAlert, stopOfferAlert: stopOfferAlert, chime: chime };
  init();
})();

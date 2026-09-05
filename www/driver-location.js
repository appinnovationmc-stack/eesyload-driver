/* Native + background driver location */
(function (global) {
  const DISTANCE_FILTER_M = 25;
  let watcherId = null;
  let webWatchId = null;
  let running = false;

  function isNative() {
    try {
      return !!(global.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
    } catch (e) {
      return false;
    }
  }

  function bgPlugin() {
    try {
      if (global.Capacitor && typeof Capacitor.registerPlugin === 'function') {
        return Capacitor.registerPlugin('BackgroundGeolocation');
      }
    } catch (e) {}
    return null;
  }

  async function persist(lat, lng, heading) {
    if (typeof updateDriverLocation !== 'function') return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    try {
      await updateDriverLocation(lat, lng, Number.isFinite(heading) ? heading : 0);
    } catch (e) {
      console.error('location persist', e);
    }
  }

  async function startDriverTracking() {
    if (running) return;
    running = true;
    const plugin = isNative() ? bgPlugin() : null;
    if (plugin && typeof plugin.addWatcher === 'function') {
      try {
        watcherId = await plugin.addWatcher(
          {
            backgroundTitle: 'EesyLoad',
            backgroundMessage: 'Sharing your location with the load you accepted',
            requestPermissions: true,
            stale: false,
            distanceFilter: DISTANCE_FILTER_M
          },
          function (location, error) {
            if (error) { console.error('bg location', error); return; }
            if (!location) return;
            persist(location.latitude, location.longitude, location.bearing || location.heading || 0);
          }
        );
        return;
      } catch (e) {
        console.error('bg watcher failed, falling back', e);
      }
    }
    if (navigator.geolocation) {
      webWatchId = navigator.geolocation.watchPosition(
        function (pos) {
          persist(pos.coords.latitude, pos.coords.longitude, pos.coords.heading || 0);
        },
        function (err) { console.error('web location', err); },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );
    }
  }

  function stopDriverTracking() {
    running = false;
    const plugin = bgPlugin();
    if (plugin && watcherId && typeof plugin.removeWatcher === 'function') {
      plugin.removeWatcher({ id: watcherId }).catch(function () {});
    }
    watcherId = null;
    if (webWatchId != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(webWatchId);
    }
    webWatchId = null;
  }

  global.startDriverTracking = startDriverTracking;
  global.stopDriverTracking = stopDriverTracking;
})(window);

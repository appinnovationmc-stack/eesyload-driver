(function () {
  function styleAll() {
    if (typeof eesyApplyMapStyle !== 'function') return;
    if (window.driverMap) eesyApplyMapStyle(driverMap);
    if (window.enRouteMap) eesyApplyMapStyle(enRouteMap);
  }
  function destAddress() {
    const load = window.DriverState && DriverState.activeLoad;
    if (!load) return '';
    const phase = DriverState.erPhase || 'pickup';
    // Prefer the stored coordinates (populated server-side since
    // create-agent-booking v8) over raw address text, same reasoning as the
    // in-app route fix: agent-booking addresses are free text with no
    // autocomplete, so a lat,lng destination is far more reliable for the
    // hand-off to the native Google Maps app.
    const lat = phase === 'dropoff' ? load.dropoff_lat : load.pickup_lat;
    const lng = phase === 'dropoff' ? load.dropoff_lng : load.pickup_lng;
    if (lat != null && lng != null) return lat + ',' + lng;
    return phase === 'dropoff' ? (load.dropoff_address || load.dropoff) : (load.pickup_address || load.pickup);
  }
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(styleAll, 800);
    const orig = window.retryEnRouteNav;
    window.retryEnRouteNav = function () {
      if (typeof orig === 'function') orig();
      if (typeof eesyOpenTurnByTurn === 'function') eesyOpenTurnByTurn(destAddress());
    };
  });
  const origGo = window.go;
  if (origGo) {
    window.go = function (id) {
      origGo(id);
      // Fixed: real screen ids are 'dHome' and 'enRoute' (no separate
      // 'navigate' screen exists) - the old lowercase ids never matched
      // anything go() actually passes, so the dark map style + traffic
      // layer were never re-applied after the very first (too-early,
      // pre-map-creation) call on page load.
      if (id === 'dHome' || id === 'enRoute') setTimeout(styleAll, 400);
    };
  }
})();

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
      if (id === 'home' || id === 'enroute' || id === 'navigate') setTimeout(styleAll, 400);
    };
  }
})();

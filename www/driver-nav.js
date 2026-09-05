(function () {
  let lastSpoken = -1;
  let lastReroute = 0;
  function speak(text) {
    if (!text || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text.replace(/<[^>]+>/g, ''));
    u.rate = 1;
    u.lang = 'en-ZA';
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
  function haversine(a, b) {
    const R = 6371000;
    const toR = (d) => d * Math.PI / 180;
    const dLat = toR(b.lat - a.lat);
    const dLng = toR(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }
  function follow(pos, heading) {
    const map = window.enRouteMap;
    if (!map || !window.google) return;
    map.panTo(pos);
    map.setTilt(45);
    map.setZoom(17);
    if (heading != null && !Number.isNaN(heading)) map.setHeading(heading);
  }
  function tick() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(function (fix) {
      const pos = { lat: fix.coords.latitude, lng: fix.coords.longitude };
      follow(pos, fix.coords.heading);
      if (window.enRouteMarker) enRouteMarker.setPosition(pos);
      const steps = window._enRouteSteps;
      const idx = window._enRouteStepIdx || 0;
      if (steps && steps[idx]) {
        const step = steps[idx];
        const end = { lat: step.end_location.lat(), lng: step.end_location.lng() };
        const street = document.querySelector('#enRoute .nav-street');
        const dist = document.querySelector('#enRoute .nav-dist');
        const raw = step.instructions || '';
        const text = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (street) street.textContent = text || 'Continue';
        if (dist && step.distance) dist.textContent = step.distance.text;
        if (idx !== lastSpoken && text) {
          lastSpoken = idx;
          speak(text);
        }
        if (haversine(pos, end) < 30 && idx < steps.length - 1) {
          window._enRouteStepIdx = idx + 1;
        }
      }
      if (steps && steps.length && Date.now() - lastReroute > 20000) {
        const onPath = steps.some(function (s) {
          const mid = {
            lat: (s.start_location.lat() + s.end_location.lat()) / 2,
            lng: (s.start_location.lng() + s.end_location.lng()) / 2
          };
          return haversine(pos, mid) < 120;
        });
        if (!onPath && typeof window._enRouteRouteFn === 'function') {
          lastReroute = Date.now();
          window._enRouteRouteFn(pos);
          lastSpoken = -1;
        }
      }
    }, function () {}, { enableHighAccuracy: true, maximumAge: 2000 });
  }
  setInterval(function () {
    const on = document.getElementById('enRoute');
    if (on && on.classList.contains('on')) tick();
  }, 3000);
})();

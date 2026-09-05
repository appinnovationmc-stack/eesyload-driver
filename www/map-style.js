window.EESY_DARK_MAP = [
  { elementType: 'geometry', stylers: [{ color: '#1c1c1e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8e8e93' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1c1c1e' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c2e' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a3a3c' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', stylers: [{ color: '#000000' }] }
];
window.eesyMapOptions = function () {
  const light = document.documentElement.dataset.theme === 'light';
  return {
    disableDefaultUI: true,
    zoomControl: false,
    gestureHandling: 'greedy',
    styles: light ? [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }] : window.EESY_DARK_MAP
  };
};
window.eesyApplyMapStyle = function (map) {
  if (!map || !window.google) return;
  map.setOptions(window.eesyMapOptions());
  try {
    const traffic = new google.maps.TrafficLayer();
    traffic.setMap(map);
  } catch (e) {}
};
window.eesyOpenTurnByTurn = function (address) {
  if (!address) return;
  const q = encodeURIComponent(address);
  window.open('https://www.google.com/maps/dir/?api=1&destination=' + q + '&travelmode=driving', '_blank');
};

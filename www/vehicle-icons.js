/* Shared EesyLoad vehicle icons. */
(function (g) {
  const svg = {
    bike: '<svg width="28" height="18" viewBox="0 0 42 26" fill="none"><circle cx="9" cy="20" r="5.5" stroke="currentColor" stroke-width="1.8"/><circle cx="33" cy="20" r="5.5" stroke="currentColor" stroke-width="1.8"/><path d="M14.5 20H27.5M21 20V9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M15 9h12l4 6H11l4-6z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    bakkie: '<svg width="28" height="18" viewBox="0 0 50 28" fill="none"><rect x="14" y="3" width="32" height="16" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M3 13h11l5-10h6" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="24" r="4" stroke="currentColor" stroke-width="1.8"/><circle cx="39" cy="24" r="4" stroke="currentColor" stroke-width="1.8"/></svg>',
    van: '<svg width="28" height="18" viewBox="0 0 50 28" fill="none"><path d="M2 20V11c0-2 1.5-4 3-4L22 4h22a3 3 0 013 3v13" stroke="currentColor" stroke-width="1.8"/><circle cx="11" cy="24" r="4" stroke="currentColor" stroke-width="1.8"/><circle cx="37" cy="24" r="4" stroke="currentColor" stroke-width="1.8"/></svg>',
    truck: '<svg width="28" height="18" viewBox="0 0 52 28" fill="none"><rect x="2" y="4" width="32" height="16" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M34 9h12l5 8v4H34V9z" stroke="currentColor" stroke-width="1.8"/></svg>'
  };
  function key(name) {
    const s = String(name || '').toLowerCase();
    if (s.includes('moto') || s.includes('bike')) return 'bike';
    if (s.includes('bakkie') || s.includes('pickup')) return 'bakkie';
    if (s.includes('van')) return 'van';
    return 'truck';
  }
  g.eesyVehicleIcon = function (name) { return svg[key(name)]; };
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.bfc-vchip').forEach(function (el) {
      const name = el.getAttribute('data-v') || el.textContent;
      const i = el.querySelector('i');
      if (!i) return;
      const wrap = document.createElement('span');
      wrap.innerHTML = g.eesyVehicleIcon(name);
      wrap.style.display = 'flex';
      wrap.style.color = 'currentColor';
      i.replaceWith(wrap.firstChild);
    });
  });
})(window);

(function () {
  window.EESY_PRIVACY_URL = 'https://github.com/appinnovationmc-stack/eesyload-rider/blob/main/www/legal/privacy.html';
  window.EESY_SUPPORT_URL = 'https://github.com/appinnovationmc-stack/eesyload-rider/blob/main/www/legal/support.html';
  function addRow(host, title, sub, href) {
    if (!host || document.getElementById('legal-' + title)) return;
    const row = document.createElement('div');
    row.className = 'row';
    row.id = 'legal-' + title;
    row.onclick = function () { window.open(href, '_blank'); };
    row.innerHTML = '<div class="rb"><div class="rt"></div><div class="rs"></div></div>';
    row.querySelector('.rt').textContent = title;
    row.querySelector('.rs').textContent = sub;
    host.appendChild(row);
  }
  function inject() {
    const host = document.querySelector('#profile .msec') || document.getElementById('profile');
    if (!host) return;
    addRow(host, 'Privacy policy', 'How we use your data and location', window.EESY_PRIVACY_URL);
    addRow(host, 'Support', 'appinnovationmc@gmail.com', window.EESY_SUPPORT_URL);
  }
  const origOnline = window.setDriverOnline;
  if (typeof origOnline === 'function') {
    window.setDriverOnline = async function (on) {
      if (on) {
        const ok = window.confirm('EesyLoad uses your location in the background while you are online so nearby loads can be offered and customers can track delivery. Go offline to stop. Continue?');
        if (!ok) return false;
      }
      return origOnline(on);
    };
  }
  document.addEventListener('DOMContentLoaded', inject);
  const origGo = window.go;
  if (origGo) window.go = function (id) { origGo(id); if (id === 'profile') inject(); };
})();

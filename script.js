/*
 * Travel Map Web App
 * Uses locally baked data.json — all Wikipedia and location data is
 * pre-loaded. Only OSM map tiles require internet to load.
 */

if (window.location.protocol === 'file:') {
  document.getElementById('info-note').classList.add('show');
  document.getElementById('map').innerHTML =
    '<p style="padding:2em;color:red">⚠ Отворете чрез HTTP сървър (вижте съобщението горе).</p>';
} else {
  fetch('data.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      document.getElementById('info-note').classList.remove('show');
      initMap(data);
    })
    .catch(function (err) {
      document.getElementById('map').innerHTML =
        '<p style="padding:2em;color:red">Грешка при зареждане на data.json: ' + err.message + '</p>';
    });
}

/* ── Module state ────────────────────────────────────────────────────── */
var map;
var allMarkers = [];   // { marker, type: 'hotel'|'location', data: {} }
var polylineRef = null;

/* ── Init ─────────────────────────────────────────────────────────────── */
function initMap(data) {
  map = L.map('map');

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
  }).addTo(map);

  var hotelIcon = createPinIcon('#2563eb');
  var locIcon = createPinIcon('#dc2626');
  var allBounds = [];

  /* Hotels */
  data.hotels.forEach(function (h) {
    if (h.lat == null || h.lng == null) return;
    var popupHtml = buildHotelPopup(h);
    var marker = L.marker([h.lat, h.lng], { icon: hotelIcon })
      .bindPopup(popupHtml, { maxWidth: 320 })
      .addTo(map);
    allBounds.push([h.lat, h.lng]);
    allMarkers.push({ marker: marker, type: 'hotel', data: h });
  });

  /* Locations */
  data.locations.forEach(function (loc) {
    if (loc.lat == null || loc.lng == null) return;
    var popupHtml = buildLocationPopup(loc);
    var marker = L.marker([loc.lat, loc.lng], { icon: locIcon })
      .bindPopup(popupHtml, { maxWidth: 320 })
      .addTo(map);
    allBounds.push([loc.lat, loc.lng]);
    allMarkers.push({ marker: marker, type: 'location', data: loc });
  });

  /* Initial polyline (all hotels visible) */
  drawPolyline(data.hotels);

  /* Fit map */
  if (allBounds.length > 0) {
    map.fitBounds(allBounds, { padding: [40, 40] });
  } else {
    map.setView([48.0, 13.0], 5);
  }

  /* Wire up search */
  setupSearch();
}

/* ── Search / filter ──────────────────────────────────────────────────── */
function setupSearch() {
  document.getElementById('search-name').addEventListener('input', applyFilters);
  document.getElementById('search-type').addEventListener('change', applyFilters);
  document.getElementById('search-date').addEventListener('input', applyFilters);
  applyFilters(); // show initial count
}

function applyFilters() {
  var nameQ = document.getElementById('search-name').value.trim().toLowerCase();
  var typeQ = document.getElementById('search-type').value;
  var dateQ = document.getElementById('search-date').value; // yyyy-mm-dd or ""

  var visibleHotelData = [];

  allMarkers.forEach(function (item) {
    var match = true;

    /* ── type filter ── */
    if (typeQ !== 'all' && item.type !== typeQ) match = false;

    /* ── name filter ── */
    if (match && nameQ) {
      var n = (item.data.name || '').toLowerCase();
      if (n.indexOf(nameQ) === -1) match = false;
    }

    /* ── date filter ── */
    if (match && dateQ) {
      var parts = dateQ.split('-');
      var searchDate = parts[2] + '/' + parts[1] + '/' + parts[0]; // → dd/mm/yyyy
      if (item.type === 'hotel') {
        if (searchDate < item.data.checkIn || searchDate > item.data.checkOut) {
          match = false;
        }
      } else {
        if (item.data.date !== searchDate) match = false;
      }
    }

    /* show / hide */
    if (match) {
      if (!map.hasLayer(item.marker)) map.addLayer(item.marker);
      if (item.type === 'hotel') visibleHotelData.push(item.data);
    } else {
      if (map.hasLayer(item.marker)) map.removeLayer(item.marker);
    }
  });

  /* polyline */
  if (typeQ === 'location' || visibleHotelData.length < 2) {
    removePolyline();
  } else {
    drawPolyline(visibleHotelData);
  }

  /* count */
  var count = 0;
  allMarkers.forEach(function (item) {
    if (map.hasLayer(item.marker)) count++;
  });
  document.getElementById('search-count').textContent = count + ' резултата';

  /* refit */
  var vis = [];
  allMarkers.forEach(function (item) {
    if (map.hasLayer(item.marker)) vis.push([item.data.lat, item.data.lng]);
  });
  if (vis.length > 0) {
    map.fitBounds(vis, { padding: [40, 40] });
  }
}

/* ── Polyline helpers ─────────────────────────────────────────────────── */
function drawPolyline(hotels) {
  removePolyline();
  if (!hotels || hotels.length < 2) return;
  var pts = hotels.map(function (h) { return [h.lat, h.lng]; });
  polylineRef = L.polyline(pts, {
    color: '#2563eb',
    weight: 3,
    opacity: 0.7,
    dashArray: '8, 10',
  }).addTo(map);
}

function removePolyline() {
  if (polylineRef) {
    map.removeLayer(polylineRef);
    polylineRef = null;
  }
}

/* ─── Marker helpers ──────────────────────────────────────────────────── */

function createPinIcon(color) {
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36">'
    + '<path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" '
    + 'fill="' + color + '" stroke="rgba(0,0,0,0.3)" stroke-width="1"/>'
    + '<circle cx="12" cy="11" r="5" fill="#fff" opacity="0.9"/>'
    + '</svg>';
  return L.icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(svg),
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  });
}

function openInMapsHtml(lat, lng, name) {
  var encName = encodeURIComponent(String(name || ''));
  var geoHref = 'geo:' + lat + ',' + lng + '?q=' + lat + ',' + lng + '(' + encName + ')';
  var gmapsHref = 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng;
  return '<div class="maps-links">'
    + '<a href="' + geoHref + '" target="_blank" class="maps-btn primary">📍 Open in Maps</a>'
    + '<a href="' + gmapsHref + '" target="_blank" class="maps-btn secondary">🗺 Open in Google Maps</a>'
    + '</div>';
}

function buildHotelPopup(h) {
  return '<div class="popup-content">'
    + '<h3>🏨 ' + escHtml(h.name) + '</h3>'
    + '<p>📍 ' + escHtml(h.city) + ', ' + escHtml(h.country) + '</p>'
    + '<p>📅 ' + h.checkIn + ' → ' + h.checkOut + '</p>'
    + (h.phone ? '<p>📞 ' + escHtml(h.phone) + '</p>' : '')
    + (h.address ? '<p>🏠 ' + escHtml(h.address) + '</p>' : '')
    + openInMapsHtml(h.lat, h.lng, h.name)
    + '</div>';
}

function buildLocationPopup(loc) {
  var html = '<div class="popup-content">'
    + '<h3>📍 ' + escHtml(loc.name) + '</h3>'
    + '<p>📅 ' + loc.date + '</p>';
  if (loc.description) {
    html += '<p>' + escHtml(truncate(loc.description, 200)) + '</p>';
  }
  if (loc.fee) {
    html += '<p class="fee">💰 ' + escHtml(loc.fee) + '</p>';
  }
  var wikiUrl = loc.canonicalUrl || loc.wikiUrl;
  if (wikiUrl) {
    html += '<p>🔗 <a href="' + wikiUrl + '" target="_blank" rel="noopener">Wikipedia</a></p>';
  }
  html += openInMapsHtml(loc.lat, loc.lng, loc.name)
    + '</div>';
  return html;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(str, max) {
  if (str.length <= max) return str;
  return str.slice(0, max) + '…';
}

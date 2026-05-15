import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getDatabase, ref, get, child, push, update } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

// --- FIREBASE SETUP ---
const firebaseConfig = { 
  apiKey: "AIzaSyB12w_rz613qgUI1G9N0JeHpkqs5FC1T-g", 
  authDomain: "quickgov-ph.firebaseapp.com", 
  databaseURL: "https://quickgov-ph-default-rtdb.asia-southeast1.firebasedatabase.app", 
  projectId: "quickgov-ph", 
  storageBucket: "quickgov-ph.firebasestorage.app", 
  messagingSenderId: "370121513915", 
  appId: "1:370121513915:web:a9cad3a4af0f18a063429e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// --- GLOBAL UI FUNCTIONS ---
window.navigateTo = function(url) {
  document.getElementById('pageTransition').classList.remove('hidden');
  setTimeout(() => { window.location.href = url; }, 350);
}

window.toggleMenu = function() {
  document.getElementById('sidebar').classList.toggle('expanded');
  document.getElementById('mobileOverlay').classList.toggle('active');
}

window.toggleInfoPanel = function() {
  const panel = document.getElementById('infoPanel'); 
  const openBtn = document.getElementById('openPanelFab');
  if(panel.classList.contains('hidden')) { 
    panel.classList.remove('hidden'); 
    openBtn.style.display = 'none'; 
  } else { 
    panel.classList.add('hidden'); 
    openBtn.style.display = 'flex'; 
  }
}

window.switchTab = function(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById(tabId).classList.add('active');
}

setInterval(() => { 
  const now = new Date(); 
  document.getElementById('localTime').innerText = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); 
}, 1000);

// --- MAP & LAYERS INITIALIZATION ---
let map, userMarker, searchRadiusCircle, routingControl;
let currentLat, currentLng;
let currentAQI = null;
let currentHeatIndex = null;
let placesData = [];
 
let placesMarkers = L.markerClusterGroup({ disableClusteringAtZoom: 16, maxClusterRadius: 40 });
let boundariesLayer = L.featureGroup();
let hazardLayer = L.featureGroup();
let heatLayer = null; 
 
let heatIndexLayer = L.featureGroup();
let aqiLayer = L.featureGroup();
let outageLayer = L.featureGroup();

const lightTileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const satelliteUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const terrainUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
 
let currentTileLayer;
let mapMode = 0; 

const phBounds = [[4.5, 116.9], [21.3, 126.6]];

// Dito mangyayari ang auto-location sa pag load ng DOM
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  setTimeout(() => {
    document.getElementById('mapHint').classList.add('show');
    setTimeout(() => document.getElementById('mapHint').classList.remove('show'), 6000);
  }, 1500);

  document.getElementById('gisSearch').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') geocodeSearch(this.value);
  });
});

function initMap() {
  map = L.map('map', { 
      zoomControl: false, 
      maxBounds: phBounds, 
      maxBoundsViscosity: 1.0,
      minZoom: 6
  }).setView([14.2750, 120.7350], 13);
  
  L.control.zoom({ position: 'topright' }).addTo(map);
  currentTileLayer = L.tileLayer(lightTileUrl, { attribution: '© OpenStreetMap & CartoDB' }).addTo(map);

  const miniMapLayer = L.tileLayer(lightTileUrl, {minZoom: 0, maxZoom: 13});
  new L.Control.MiniMap(miniMapLayer, { toggleDisplay: true, position: 'bottomright', width: 120, height: 120 }).addTo(map);

  map.addLayer(placesMarkers);
  map.addLayer(boundariesLayer);
  map.addLayer(hazardLayer);
  map.addLayer(heatIndexLayer);
  map.addLayer(aqiLayer);
  map.addLayer(outageLayer);

  // FIX: Dito inayos yung click problem
  map.on('click', function(e) { 
      document.getElementById('pageTransition').classList.remove('hidden');
      document.getElementById('loader-text').innerText = "Scanning New Location...";
      processLocationData(e.latlng.lat, e.latlng.lng, true); // true param will center map
  });

  // FEATURE: Automatic getting location
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      position => {
        processLocationData(position.coords.latitude, position.coords.longitude, true);
      },
      error => {
        console.warn("Location denied or unavailable, using fallback.");
        processLocationData(14.2750, 120.7350, true);
      }, 
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  } else {
    processLocationData(14.2750, 120.7350, true);
  }
}

// Global functions for map controls
window.toggleMapType = function() {
  mapMode = (mapMode + 1) % 3;
  map.removeLayer(currentTileLayer);
  if (mapMode === 1) {
    currentTileLayer = L.tileLayer(satelliteUrl, { attribution: 'Tiles © Esri'}).addTo(map);
  } else if (mapMode === 2) {
    currentTileLayer = L.tileLayer(terrainUrl, { attribution: 'Tiles © Esri'}).addTo(map);
  } else {
    currentTileLayer = L.tileLayer(lightTileUrl).addTo(map);
  }
}

window.requestLocation = function() {
  document.getElementById('pageTransition').classList.remove('hidden');
  document.getElementById('loader-text').innerText = "Getting Current Location...";
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      position => processLocationData(position.coords.latitude, position.coords.longitude, true),
      error => {
        document.getElementById('pageTransition').classList.add('hidden');
        alert("Location access denied or unavailable.");
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }
}

async function geocodeSearch(query) {
  if(!query) return;
  document.getElementById('pageTransition').classList.remove('hidden');
  document.getElementById('loader-text').innerText = "Searching Location...";
  try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Philippines')}&format=json&limit=1`);
      const data = await res.json();
      if(data && data.length > 0) {
          processLocationData(parseFloat(data[0].lat), parseFloat(data[0].lon), true);
      } else {
          alert("Location not found in the Philippines.");
          document.getElementById('pageTransition').classList.add('hidden');
      }
  } catch(e) { document.getElementById('pageTransition').classList.add('hidden'); }
}

async function processLocationData(lat, lng, centerMap = false) {
  currentLat = lat; currentLng = lng;
  if(userMarker) map.removeLayer(userMarker);
  if(searchRadiusCircle) map.removeLayer(searchRadiusCircle);

  const customIcon = L.divIcon({ className: 'gps-marker', iconSize: [16, 16], iconAnchor: [8, 8] });
  userMarker = L.marker([lat, lng], {icon: customIcon, zIndexOffset: 1000}).addTo(map);
  
  // Draw 8KM search boundary
  searchRadiusCircle = L.circle([lat, lng], { radius: 8000, color: 'var(--accent)', fillColor: 'var(--accent)', fillOpacity: 0.05, weight: 1, dashArray: '5,5' }).addTo(map);
  if (centerMap) map.setView([lat, lng], 14);
  
  document.getElementById('coordDisplay').innerText = `Lat: ${lat.toFixed(5)} | Lng: ${lng.toFixed(5)}`;
  document.getElementById('placesContainer').innerHTML = `<div class="skeleton" style="height: 60px; width:100%; margin-bottom:10px;"></div><div class="skeleton" style="height: 60px; width:100%;"></div>`;

  // 1. Reverse Geocode Location
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
    const data = await response.json();
    
    let cityName = "", brgyName = "";
    if(data && data.address) {
      const addr = data.address;
      brgyName = addr.village || addr.suburb || addr.neighbourhood || addr.hamlet || "";
      cityName = addr.city || addr.town || addr.municipality || "";
      const prov = addr.state || addr.province || addr.region || "";
      document.getElementById('zipDisplay').innerText = addr.postcode || "N/A";
      
      let fullAddress = [brgyName, cityName, prov].filter(Boolean).join(", ");
      document.getElementById('addressDisplay').innerText = fullAddress || data.display_name;
      document.getElementById('nearbySubtitle').innerText = cityName ? `Facilities in/around ${cityName}` : "Facilities in this area";

      const hash = Math.abs(lat * lng).toString().substr(3,5);
      document.getElementById('popDisplay').innerText = `Est. Pop: ${parseInt(hash).toLocaleString()}`;

      if (cityName) fetchBoundaries(cityName, brgyName);
    }
  } catch (e) { document.getElementById('addressDisplay').innerText = "Address unavailable."; }

  // 2. Fetch AQI
  try {
    const aqiRes = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi`);
    const aqiData = await aqiRes.json();
    currentAQI = aqiData.current.us_aqi;
  } catch(e) { currentAQI = null; }

  // 3. Fetch Weather & Heat Index
  try {
    const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,apparent_temperature`);
    const wData = await wRes.json();
    document.getElementById('weatherTemp').innerText = `${wData.current.temperature_2m}°C`;
    currentHeatIndex = wData.current.apparent_temperature;
  } catch(e) { currentHeatIndex = null; }

  // Re-render toggles
  toggleHazard();
  toggleHeatIndex();
  toggleAQI();
  toggleOutage();

  // 4. Fetch Nearby Places via Overpass API
  await fetchFacilities(lat, lng);
  document.getElementById('pageTransition').classList.add('hidden');
}

async function fetchBoundaries(city, brgy) {
    if(!document.getElementById('layerBrgy').checked) return;
    boundariesLayer.clearLayers();
    
    try {
      const query = encodeURIComponent(`${city}, Philippines`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&polygon_geojson=1&format=json&limit=1`);
      const data = await res.json();
      if (data && data[0]?.geojson) {
          L.geoJSON(data[0].geojson, { style: { color: 'var(--accent)', weight: 3, opacity: 0.8, fillColor: 'var(--accent)', fillOpacity: 0.05, dashArray: '10, 10' } }).addTo(boundariesLayer);
      }
    } catch(e) {}

    if(brgy) {
        try {
            const bQuery = `[out:json][timeout:10];relation["name"~"${brgy}",i]["admin_level"="10"];out geom;`;
            const bRes = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: bQuery });
            const bData = await bRes.json();
            if(bData.elements.length > 0) {
                const bounds = bData.elements[0].bounds;
                L.rectangle([[bounds.minlat, bounds.minlon], [bounds.maxlat, bounds.maxlon]], {color: 'var(--success)', weight: 2, fillOpacity: 0.1}).addTo(boundariesLayer);
            }
        } catch(e) {}
    }
}

async function fetchFacilities(lat, lng) {
  const radius = 8000;
  const query = `
    [out:json][timeout:30];
    (
      node["amenity"~"school|college|university|hospital|clinic|pharmacy|police|fire_station|townhall"](around:${radius},${lat},${lng});
      way["amenity"~"school|college|university|hospital|clinic|pharmacy|police|fire_station|townhall"](around:${radius},${lat},${lng});
      node["shop"~"mall|supermarket|convenience"](around:${radius},${lat},${lng});
      way["shop"~"mall|supermarket|convenience"](around:${radius},${lat},${lng});
      node["emergency"~"ambulance_station|water_rescue"](around:${radius},${lat},${lng});
      way["emergency"~"ambulance_station|water_rescue"](around:${radius},${lat},${lng});
    );
    out center;
  `;

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: query });
    const data = await response.json();
    
    placesData = data.elements.filter(e => e.tags && e.tags.name).map(e => {
      const amenity = e.tags.amenity || '';
      const shop = e.tags.shop || '';
      const emerg = e.tags.emergency || '';
      let type = 'other';
      
      if (amenity.match(/hospital|clinic|pharmacy/)) type = 'health';
      else if (amenity.match(/police|fire_station/) || emerg) type = 'emergency';
      else if (amenity.match(/school|college|university/)) type = 'school';
      else if (amenity.match(/townhall/)) type = 'gov';
      else if (shop.match(/mall|supermarket|convenience/)) type = 'commercial';
      
      let pLat = e.lat || (e.center ? e.center.lat : null);
      let pLon = e.lon || (e.center ? e.center.lon : null);

      return {
        id: e.id, name: e.tags.name, type: type, lat: pLat, lon: pLon,
        distance: (pLat && pLon) ? map.distance([lat, lng], [pLat, pLon]) : 999999
      };
    }).filter(p => p.lat !== null).sort((a, b) => a.distance - b.distance);

    document.getElementById('facilityCount').innerText = placesData.length;
    renderPlacesList('all'); // Show all by default
    generateMockHeatmap(placesData);
  } catch (e) {
    document.getElementById('placesContainer').innerHTML = `<div class="status-msg" style="color:var(--danger)">Network error fetching GIS data.</div>`;
  }
}

window.filterPlaces = function(type) {
  document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  event.target.classList.add('active');
  renderPlacesList(type);
}

function renderPlacesList(filterType) {
  const container = document.getElementById('placesContainer');
  placesMarkers.clearLayers();
  container.innerHTML = '';

  const filtered = placesData.filter(p => filterType === 'all' || p.type === filterType);

  if(filtered.length === 0) {
    container.innerHTML = `<div class="status-msg">No structured GIS data found for this category in an 8km radius.</div>`;
    return;
  }

  filtered.forEach(place => {
    let iconSvg = '<circle cx="12" cy="12" r="3"></circle>';
    let pinColor = '#5b8782';
    
    if (place.type === 'health') { iconSvg = '<path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>'; pinColor = '#ff6b6b'; } 
    else if (place.type === 'emergency') { iconSvg = '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>'; pinColor = '#ff6b6b'; } 
    else if (place.type === 'school') { iconSvg = '<path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path>'; pinColor = '#ffb84d'; } 
    else if (place.type === 'gov') { iconSvg = '<path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"></path>'; pinColor = '#0fbfa8'; }
    else if (place.type === 'commercial') { iconSvg = '<circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>'; pinColor = '#34a853'; }

    const distKm = (place.distance/1000).toFixed(1);
    const timeEst = Math.ceil(distKm * 3);
    
    const card = document.createElement('div');
    card.className = 'place-card';
    card.innerHTML = `
      <div class="place-card-top" onclick="flyToPlace(${place.lat}, ${place.lon})">
          <div class="place-icon" style="color:${pinColor}; background:${pinColor}20">${iconSvg}</div>
          <div class="place-details">
              <h4>${place.name}</h4>
              <p>${distKm} km away • ~${timeEst} min drive</p>
          </div>
      </div>
      <div class="place-actions">
          <button class="action-btn primary" onclick="routeTo(${place.lat}, ${place.lon})">
              <svg class="icon" style="width:14px;height:14px;" viewBox="0 0 24 24"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg> Navigate
          </button>
          <button class="action-btn" onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=$${place.lat},${place.lon}')">
              <svg class="icon" style="width:14px;height:14px;" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg> G-Maps
          </button>
      </div>
    `;
    container.appendChild(card);

    const mapIcon = L.divIcon({
      className: 'custom-pin',
      html: `<div style="background:${pinColor}; width:16px; height:16px; border-radius:50%; border:2px solid #fff; box-shadow:0 2px 5px rgba(0,0,0,0.3)"></div>`,
      iconSize: [16,16], iconAnchor: [8,8]
    });
    
    L.marker([place.lat, place.lon], {icon: mapIcon})
      .bindPopup(`
        <div style="font-family:'Plus Jakarta Sans',sans-serif; padding:4px;">
          <strong style="font-size:13px; color:var(--text);">${place.name}</strong><br>
          <span style="font-size:11px; color:var(--muted);">${distKm} km</span><br>
          <button onclick="routeTo(${place.lat}, ${place.lon})" style="display:inline-block; margin-top:8px; padding:6px 12px; background:var(--accent); color:#fff; border:none; border-radius:8px; font-weight:700; font-size:11px; cursor:pointer;">Route Here</button>
        </div>
      `)
      .addTo(placesMarkers);
  });
}

window.flyToPlace = function(lat, lng) {
    map.setView([lat, lng], 16);
    if(window.innerWidth <= 768) {
        document.querySelector('.side-panel').style.maxHeight = '20vh';
        setTimeout(() => document.querySelector('.side-panel').style.maxHeight = '60vh', 3000);
    }
}

window.routeTo = function(destLat, destLng) {
    if(!currentLat || !currentLng) return alert("Current origin point not set.");
    window.clearRouting();
    
    document.getElementById('pageTransition').classList.remove('hidden');
    document.getElementById('loader-text').innerText = "Calculating Route...";

    routingControl = L.Routing.control({
        waypoints: [ L.latLng(currentLat, currentLng), L.latLng(destLat, destLng) ],
        routeWhileDragging: false,
        addWaypoints: false,
        fitSelectedRoutes: true,
        showAlternatives: false,
        lineOptions: { styles: [{color: 'var(--accent)', opacity: 0.8, weight: 5}] },
        createMarker: function() { return null; }
    }).on('routesfound', function(e) {
        document.getElementById('pageTransition').classList.add('hidden');
        document.getElementById('clearRouteBtn').style.display = 'flex';
    }).on('routingerror', function(e) {
        document.getElementById('pageTransition').classList.add('hidden');
        alert("Routing engine failed. Try Google Maps option.");
    }).addTo(map);
}

window.clearRouting = function() {
    if(routingControl) { 
        map.removeControl(routingControl); 
        routingControl = null; 
    }
    document.getElementById('clearRouteBtn').style.display = 'none';
}

window.toggleBoundaries = function() {
    if(document.getElementById('layerBrgy').checked) { map.addLayer(boundariesLayer); } 
    else { map.removeLayer(boundariesLayer); }
}

window.toggleHazard = function() {
    hazardLayer.clearLayers();
    if(document.getElementById('layerHazard').checked && currentLat) {
        L.circle([currentLat, currentLng], {radius: 3500, color: 'var(--danger)', fillColor: 'var(--danger)', fillOpacity: 0.2, stroke: false})
         .bindTooltip("Flood Hazard Zone (Demo)", {permanent: true, direction: "center", className: 'heat-tooltip'})
         .addTo(hazardLayer);
    }
}

function generateMockHeatmap(places) {
    if(heatLayer) map.removeLayer(heatLayer);
    const heatPoints = places.map(p => [p.lat, p.lon, 1]);
    heatLayer = L.heatLayer(heatPoints, {radius: 40, blur: 25, gradient: {0.4: 'blue', 0.65: 'lime', 1: 'red'}});
    if(document.getElementById('layerHeat').checked) map.addLayer(heatLayer);
}

window.toggleHeatmap = function() {
    if(!heatLayer) return;
    if(document.getElementById('layerHeat').checked) map.addLayer(heatLayer);
    else map.removeLayer(heatLayer);
}

window.toggleHeatIndex = function() {
    heatIndexLayer.clearLayers();
    if(document.getElementById('layerHeatIndex').checked && currentLat && currentHeatIndex !== null) {
        let color = '#34a853'; let label = "Safe";
        if(currentHeatIndex > 32) { color = '#ffb84d'; label = "Extreme Caution"; }
        if(currentHeatIndex > 39) { color = '#ff4d4d'; label = "Danger"; }
        
        L.circle([currentLat, currentLng], {radius: 4000, color: 'transparent', fillColor: color, fillOpacity: 0.3, stroke: false})
         .bindTooltip(`Real-time Heat Index: ${currentHeatIndex}°C (${label})`, {permanent: true, direction: "center", className: 'heat-tooltip'})
         .addTo(heatIndexLayer);
    } else if (document.getElementById('layerHeatIndex').checked && !currentHeatIndex && currentLat) {
        L.circle([currentLat, currentLng], {radius: 4000, color: 'transparent', fillColor: '#ffb84d', fillOpacity: 0.2, stroke: false})
         .bindTooltip(`Heat Index: Fetching...`, {permanent: true, direction: "center", className: 'heat-tooltip'})
         .addTo(heatIndexLayer);
    }
}

window.toggleAQI = function() {
    aqiLayer.clearLayers();
    if(document.getElementById('layerAQI').checked && currentLat && currentAQI !== null) {
        let color = '#34a853'; let label = "Good";
        if(currentAQI > 50) { color = '#ffb84d'; label = "Moderate"; }
        if(currentAQI > 100) { color = '#ff4d4d'; label = "Unhealthy"; }

        L.circle([currentLat, currentLng], {radius: 4000, color: 'transparent', fillColor: color, fillOpacity: 0.3, stroke: false})
         .bindTooltip(`Real-time AQI: ${currentAQI} (${label})`, {permanent: true, direction: "center", className: 'aqi-tooltip'})
         .addTo(aqiLayer);
    } else if (document.getElementById('layerAQI').checked && !currentAQI && currentLat) {
        L.circle([currentLat, currentLng], {radius: 4000, color: 'transparent', fillColor: '#34a853', fillOpacity: 0.2, stroke: false})
         .bindTooltip(`AQI: Fetching...`, {permanent: true, direction: "center", className: 'aqi-tooltip'})
         .addTo(aqiLayer);
    }
}

window.toggleOutage = function() {
    outageLayer.clearLayers();
    if(document.getElementById('layerOutage').checked && currentLat) {
        L.circle([currentLat + 0.005, currentLng + 0.005], {radius: 3000, color: 'transparent', fillColor: '#000000', fillOpacity: 0.5, stroke: false})
         .bindTooltip("Warning: Unscheduled Line Outage (Demo)", {permanent: true, direction: "center", className: 'outage-tooltip'})
         .addTo(outageLayer);
    }
}

window.triggerSOS = async function() {
    if(confirm("EMERGENCY: Do you want to broadcast your location to nearest LGU units and authorities?")) {
        if(!currentLat || !currentLng) {
           alert("Error: Location coordinates not acquired yet.");
           return;
        }
        document.getElementById('pageTransition').classList.remove('hidden');
        document.getElementById('loader-text').innerText = "Transmitting SOS Signal...";
        
        let success = false;
        if (window.sendSOSToFirebase) {
          success = await window.sendSOSToFirebase(currentLat, currentLng);
        }

        setTimeout(() => {
            document.getElementById('pageTransition').classList.add('hidden');
            if(success) {
                alert("SOS Transmitted. Authorities and Admin have been alerted with your name and exact coordinates.");
            } else {
                alert("Broadcast sent via local signal, but Firebase sync failed. Please call 911.");
            }
        }, 2000);
    }
}

// --- FIREBASE AUTH & USER DATA ---
window.sendSOSToFirebase = async function(lat, lng) {
  try {
    const user = auth.currentUser;
    if (!user) return false;
    
    const snapshot = await get(child(ref(db), `users/${user.uid}`));
    if (!snapshot.exists()) return false;

    const userData = snapshot.val();
    const fullName = userData.fullName || user.displayName || "Unknown Resident";

    const sosData = {
      userId: user.uid,
      userName: fullName,
      location: { lat: lat, lng: lng },
      timestamp: Date.now(),
      status: "active"
    };

    const newSosKey = push(child(ref(db), 'emergencies')).key;
    const updates = {};
    updates[`emergencies/${newSosKey}`] = sosData;

    if (userData.province && userData.municipality && userData.barangay) {
      updates[`directory/${userData.province}/${userData.municipality}/${userData.barangay}/emergencies/${newSosKey}`] = sosData;
    }

    await update(ref(db), updates);
    return true;

  } catch(err) {
    console.error(err);
    return false;
  }
};

window.logoutUser = async function() {
  if(confirm("Are you sure you want to sign out?")) {
    document.getElementById('pageTransition').classList.remove('hidden');
    await signOut(auth);
    window.location.href = "login.html";
  }
};

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const snapshot = await get(child(ref(db), `users/${user.uid}`));
      const profileImgElem = document.getElementById('userProfileImage');
      const initialsElem = document.getElementById('userInitialsDisplay');

      if (snapshot.exists()) {
        const userData = snapshot.val();
        if (userData.status !== "approved") {
          await signOut(auth);
          window.location.href = "index.html";
          return;
        }
        const fullName = userData.fullName || user.displayName || "User";
        document.getElementById('userNameDisplay').textContent = fullName;
        document.getElementById('userAddressDisplay').textContent = userData.address || "✓ Verified Resident";
        
        if (userData.profileImage || user.photoURL) {
          profileImgElem.src = userData.profileImage || user.photoURL;
          profileImgElem.style.display = 'block';
          initialsElem.style.display = 'none';
        } else {
          initialsElem.textContent = fullName.split(" ")[0][0].toUpperCase();
        }
      }
    } catch (error) { console.error("Auth error:", error); }
  } else {
    window.location.href = "index.html";
  }
});

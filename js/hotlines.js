import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getDatabase, ref, get, child } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

// --- GLOBAL UI NAVIGATION ---
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => { document.getElementById('pageTransition').classList.add('hidden'); }, 300);
});

window.navigateTo = function(url) {
  document.getElementById('pageTransition').classList.remove('hidden');
  setTimeout(() => { window.location.href = url; }, 350);
}

window.toggleMenu = function() {
  document.getElementById('sidebar').classList.toggle('expanded');
  document.getElementById('mobileOverlay').classList.toggle('active');
}

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

// --- HOTLINES DATABASE ---
const hotlinesDb = {
  "tanza": {
    "displayName": "Tanza, Cavite",
    "contacts": [
      { "type": "Police Station", "number": "0905-330-0756", "icon": "fa-shield-halved", "color": "#4285f4", "bg": "rgba(66,133,244,0.1)" },
      { "type": "Fire Department", "number": "0945-175-8652", "icon": "fa-fire-extinguisher", "color": "#ff6b6b", "bg": "rgba(255,107,107,0.1)" },
      { "type": "MDRRMO / Rescue", "number": "0977-345-5035", "icon": "fa-truck-medical", "color": "#f5a623", "bg": "rgba(245,166,35,0.1)" },
      { "type": "Coast Guard", "number": "0916-793-2511", "icon": "fa-life-ring", "color": "#0fbfa8", "bg": "rgba(15,191,168,0.1)" },
      { "type": "Rural Health Unit", "number": "(046) 485 0244", "icon": "fa-hospital", "color": "#0fbfa8", "bg": "rgba(15,191,168,0.1)" }
    ]
  },
  "maragondon": {
    "displayName": "Maragondon, Cavite",
    "contacts": [
      { "type": "Police Station", "number": "0977-388-3439", "icon": "fa-shield-halved", "color": "#4285f4", "bg": "rgba(66,133,244,0.1)" },
      { "type": "Fire Department", "number": "(046) 412 1911", "icon": "fa-fire-extinguisher", "color": "#ff6b6b", "bg": "rgba(255,107,107,0.1)" },
      { "type": "MDRRMO / Rescue", "number": "0906-568-0500", "icon": "fa-truck-medical", "color": "#f5a623", "bg": "rgba(245,166,35,0.1)" },
      { "type": "Rural Health Unit", "number": "0917-823-1249", "icon": "fa-hospital", "color": "#0fbfa8", "bg": "rgba(15,191,168,0.1)" }
    ]
  },
  "general trias": {
    "displayName": "General Trias, Cavite",
    "contacts": [
      { "type": "Police Station", "number": "0916-726-5908", "icon": "fa-shield-halved", "color": "#4285f4", "bg": "rgba(66,133,244,0.1)" },
      { "type": "Fire Department", "number": "0967-429-0363", "icon": "fa-fire-extinguisher", "color": "#ff6b6b", "bg": "rgba(255,107,107,0.1)" },
      { "type": "CDRRMO", "number": "0919-077-1760", "icon": "fa-truck-medical", "color": "#f5a623", "bg": "rgba(245,166,35,0.1)" },
      { "type": "City Health Office", "number": "(046) 509 5289", "icon": "fa-hospital", "color": "#0fbfa8", "bg": "rgba(15,191,168,0.1)" }
    ]
  },
  "rosario": {
    "displayName": "Rosario, Cavite",
    "contacts": [
      { "type": "Police Station", "number": "(046) 438-1644", "icon": "fa-shield-halved", "color": "#4285f4", "bg": "rgba(66,133,244,0.1)" },
      { "type": "Fire Department", "number": "(046) 438-1296", "icon": "fa-fire-extinguisher", "color": "#ff6b6b", "bg": "rgba(255,107,107,0.1)" },
      { "type": "MDRRMO", "number": "0923-280-9285", "icon": "fa-truck-medical", "color": "#f5a623", "bg": "rgba(245,166,35,0.1)" },
      { "type": "Health Office", "number": "(046) 438 2011", "icon": "fa-hospital", "color": "#0fbfa8", "bg": "rgba(15,191,168,0.1)" }
    ]
  },
  "naic": {
    "displayName": "Naic, Cavite",
    "contacts": [
      { "type": "Police Station", "number": "(046) 412-0545", "icon": "fa-shield-halved", "color": "#4285f4", "bg": "rgba(66,133,244,0.1)" },
      { "type": "Fire Department", "number": "(046) 412-0453", "icon": "fa-fire-extinguisher", "color": "#ff6b6b", "bg": "rgba(255,107,107,0.1)" },
      { "type": "MDRRMO", "number": "0916-291-7649", "icon": "fa-truck-medical", "color": "#f5a623", "bg": "rgba(245,166,35,0.1)" },
      { "type": "Rural Health Unit", "number": "(046) 412 0013", "icon": "fa-hospital", "color": "#0fbfa8", "bg": "rgba(15,191,168,0.1)" }
    ]
  },
  "dasmarinas": {
    "displayName": "Dasmariñas, Cavite",
    "contacts": [
      { "type": "Police Station", "number": "(046) 416-2580", "icon": "fa-shield-halved", "color": "#4285f4", "bg": "rgba(66,133,244,0.1)" },
      { "type": "Fire Department", "number": "(046) 416-0875", "icon": "fa-fire-extinguisher", "color": "#ff6b6b", "bg": "rgba(255,107,107,0.1)" },
      { "type": "CDRRMO", "number": "0917-508-3011", "icon": "fa-truck-medical", "color": "#f5a623", "bg": "rgba(245,166,35,0.1)" },
      { "type": "Pagamutang Bayan", "number": "(046) 416 0095", "icon": "fa-hospital", "color": "#0fbfa8", "bg": "rgba(15,191,168,0.1)" }
    ]
  }
};

window.pingLocation = function() {
  const radarBox = document.getElementById('radarStatusBox');
  const statusText = document.getElementById('locStatusText');
  const locText = document.getElementById('yourLocText');
  const locCoords = document.getElementById('locCoords');
  const container = document.getElementById('hotlinesContainer');

  // UI Reset / Scanning State
  radarBox.className = 'radar-status';
  statusText.textContent = "Scanning GPS Signal...";
  locText.textContent = "Detecting Location...";
  locCoords.innerHTML = `<i class="fa-solid fa-satellite-dish fa-beat"></i> Obtaining coordinates...`;
  
  container.innerHTML = `
    <div class="empty-state">
      <i class="fa-solid fa-satellite-dish fa-beat" style="color: var(--accent);"></i>
      <h4>Locating Responders</h4>
      <p>Please wait while we secure your connection.</p>
    </div>`;

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      locCoords.innerHTML = `<i class="fa-solid fa-location-crosshairs"></i> ${lat.toFixed(5)}, ${lon.toFixed(5)}`;

      try {
        statusText.textContent = "Reverse Geocoding...";
        
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
        const data = await res.json();
        
        const city = data.address.city || data.address.town || data.address.municipality || "Unknown Area";
        const brgy = data.address.village || data.address.suburb || data.address.neighbourhood || "";
        
        if(brgy && city !== "Unknown Area") locText.textContent = `${brgy}, ${city}`;
        else locText.textContent = city;

        // Success UI
        radarBox.className = 'radar-status success';
        statusText.textContent = "GPS Locked";

        renderHotlines(city.toLowerCase());

      } catch (e) {
        radarBox.className = 'radar-status error';
        statusText.textContent = "Network Error";
        locText.textContent = "API Request Failed";
      }

    }, (error) => {
      radarBox.className = 'radar-status error';
      statusText.textContent = "Access Denied";
      locText.textContent = "Enable Location Services";
      locCoords.innerHTML = `<i class="fa-solid fa-ban"></i> Blocked`;
      
      container.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-location-crosshairs" style="color: var(--coral);"></i>
          <h4>Location Blocked</h4>
          <p>Please allow browser location permissions to see local hotlines.</p>
        </div>`;
    }, { enableHighAccuracy: true });
  } else {
    locText.textContent = "Browser Unsupported";
  }
}

function renderHotlines(cityKey) {
  const container = document.getElementById('hotlinesContainer');
  const title = document.getElementById('hotlineAreaTitle');
  
  let matchedData = null;
  for (const key in hotlinesDb) {
    if (cityKey.includes(key) || key.includes(cityKey)) {
      matchedData = hotlinesDb[key];
      break;
    }
  }

  if (matchedData) {
    title.textContent = `Hotlines for ${matchedData.displayName}`;
    container.innerHTML = '';
    
    matchedData.contacts.forEach(c => {
      container.innerHTML += `
        <div class="premium-hotline-card group">
          <div class="phc-top">
            <div>
              <h4 class="phc-type">${c.type}</h4>
              <p class="phc-number">${c.number}</p>
            </div>
            <div class="phc-icon" style="color: ${c.color}; background: ${c.bg};">
              <i class="fa-solid ${c.icon}"></i>
            </div>
          </div>
          <a href="tel:${c.number.replace(/[^0-9]/g, '')}" class="phc-btn">
            <i class="fa-solid fa-phone"></i> Dial Now
          </a>
        </div>
      `;
    });
  } else {
    title.textContent = "Area Not Supported";
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-house-circle-xmark" style="color: var(--coral);"></i>
        <h4>Out of Coverage</h4>
        <p>We currently do not have the hotlines for your area in our database.</p>
      </div>`;
  }
}

// --- AUTH STATE & AUTO INITIALIZATION ---
window.logoutUser = async function() {
  if(confirm("Are you sure you want to sign out?")) {
    document.getElementById('pageTransition').classList.remove('hidden');
    await signOut(auth);
    window.location.href = "index.html";
  }
};

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const snapshot = await get(child(ref(db), `users/${user.uid}`));
      if (snapshot.exists()) {
        const userData = snapshot.val();
        
        if (userData.status !== "approved") {
          await signOut(auth);
          window.location.href = "index.html";
          return;
        }

        const fullName = userData.fullName || "User";
        document.getElementById('userNameDisplay').textContent = fullName;
        document.getElementById('userAddressDisplay').textContent = userData.address || "✓ Verified Resident";

        if (userData.profileImage) {
          document.getElementById('userProfileImage').src = userData.profileImage;
          document.getElementById('userProfileImage').style.display = 'block';
          document.getElementById('userInitialsDisplay').style.display = 'none';
        } else {
          document.getElementById('userInitialsDisplay').textContent = fullName[0].toUpperCase();
        }

        document.getElementById('pageTransition').classList.add('hidden');
        
        // This triggers the auto-fetch for the location and hotlines!
        window.pingLocation();

      } else { window.location.href = "index"; }
    } catch (error) { console.error(error); }
  } else { window.location.href = "index"; }
});

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getDatabase, ref, get, update, child, onValue, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

// --- GLOBAL UI FUNCTIONS ---
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => { document.getElementById('pageTransition').classList.add('hidden'); }, 300);
});

window.navigateTo = function(url) {
  document.getElementById('pageTransition').classList.remove('hidden');
  setTimeout(() => { window.location.href = url; }, 350);
};

window.toggleMenu = function() {
  document.getElementById('sidebar').classList.toggle('expanded');
  document.getElementById('mobileOverlay').classList.toggle('active');
};

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

let allRequests = [];
let currentTab = 'active';
let currentUserData = null; 

window.switchTab = function(tabName) {
  currentTab = tabName;
  document.getElementById('tab-active').classList.toggle('active', tabName === 'active');
  document.getElementById('tab-successful').classList.toggle('active', tabName === 'successful');
  renderRequests();
};

window.confirmReceipt = async function(reqId) {
  if(confirm("Have you successfully received your requested document?")) {
    try {
      const updates = {};
      updates[`requests/${reqId}/status`] = "Completed";
      if (currentUserData && currentUserData.province && currentUserData.municipality && currentUserData.barangay) {
        updates[`directory/${currentUserData.province}/${currentUserData.municipality}/${currentUserData.barangay}/requests/${reqId}/status`] = "Completed";
      }
      await update(ref(db), updates);
    } catch(e) {
      alert("Error confirming receipt: " + e.message);
    }
  }
};

function renderRequests() {
  const container = document.getElementById('myRequestsContainer');
  container.innerHTML = '';

  const filteredReqs = allRequests.filter(req => {
    const stat = (req.status || "").toLowerCase();
    const isCompleted = stat.includes('complet') || stat.includes('receiv');
    if (currentTab === 'active') return !isCompleted;
    return isCompleted; 
  });

  if (filteredReqs.length === 0) {
    container.innerHTML = `<div class="empty-state">No ${currentTab} document requests found.</div>`;
    return;
  }

  filteredReqs.forEach(req => {
    const dateOptions = { month: 'long', day: 'numeric', year: 'numeric' };
    const dateStr = new Date(req.createdAt).toLocaleDateString('en-US', dateOptions);
    
    let statusClass = "pending";
    let badgeText = "PENDING";
    let dbStatus = (req.status || "").toLowerCase();

    if (dbStatus.includes('process')) { 
      statusClass = "processing"; 
      badgeText = "ON PROCESS"; 
    } else if (dbStatus.includes('ready') || dbStatus.includes('pickup')) { 
      statusClass = "ready"; 
      badgeText = "READY FOR PICKUP"; 
    } else if (dbStatus.includes('complet') || dbStatus.includes('receiv')) { 
      statusClass = "completed"; 
      badgeText = "COMPLETED"; 
    }

    const cardHTML = `
      <div class="req-card ${statusClass}">
        <div class="rc-header">
          <div>
            <h3>${req.docType}</h3>
            <p>Requested on ${dateStr}</p>
          </div>
          <div class="rc-badge">${badgeText}</div>
        </div>
        
        <div class="rc-body">
          <strong>Purpose:</strong> ${req.purpose}
        </div>

        <div class="stepper-wrap">
          <div class="stepper-track"></div>
          <div class="stepper-fill"></div>
          <div class="stepper-steps">
            <div class="step-item">
              <div class="step-dot"></div>
              <div class="step-label">PENDING</div>
            </div>
            <div class="step-item">
              <div class="step-dot"></div>
              <div class="step-label">ON PROCESS</div>
            </div>
            <div class="step-item">
              <div class="step-dot"></div>
              <div class="step-label">READY</div>
            </div>
          </div>
        </div>

        <div class="action-row">
          <button class="confirm-btn" onclick="confirmReceipt('${req.id}')">
            <svg class="icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Confirm Receipt
          </button>
          <span class="completed-text">
            <svg class="icon" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            Document Received and Completed
          </span>
        </div>
      </div>
    `;
    
    container.innerHTML += cardHTML;
  });
}

function loadRequestsTracker(uid, province, municipality, barangay) {
  let requestsQuery;
  if (province && municipality && barangay) {
    requestsQuery = query(ref(db, `directory/${province}/${municipality}/${barangay}/requests`), orderByChild('userId'), equalTo(uid));
  } else {
    requestsQuery = query(ref(db, 'requests'), orderByChild('userId'), equalTo(uid));
  }

  onValue(requestsQuery, (snapshot) => {
    allRequests = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => { allRequests.push({id: child.key, ...child.val()}); });
      allRequests.sort((a,b) => b.createdAt - a.createdAt);
    }
    renderRequests();
  });
}

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
        currentUserData = snapshot.val();
        if (currentUserData.status !== "approved") {
          await signOut(auth);
          window.location.href = "index";
          return;
        }

        const fullName = currentUserData.fullName || user.displayName || "User";
        document.getElementById('userNameDisplay').textContent = fullName;
        document.getElementById('userAddressDisplay').textContent = currentUserData.address || "✓ Verified Resident";

        if (currentUserData.profileImage || user.photoURL) {
          profileImgElem.src = currentUserData.profileImage || user.photoURL;
          profileImgElem.style.display = 'block';
          initialsElem.style.display = 'none';
        } else {
          initialsElem.textContent = fullName.split(" ")[0][0].toUpperCase();
        }

        loadRequestsTracker(user.uid, currentUserData.province, currentUserData.municipality, currentUserData.barangay);
      }
    } catch (error) { console.error("Auth error:", error); }
  } else {
    window.location.href = "index";
  }
});

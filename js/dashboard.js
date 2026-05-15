import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getDatabase, ref, get, child, onValue, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

window.toggleMenu = function() {
  document.getElementById('sidebar').classList.toggle('expanded');
  document.getElementById('mobileOverlay').classList.toggle('active');
};

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

window.logoutUser = async function() {
  if(confirm("Are you sure you want to sign out?")) {
    document.getElementById('pageTransition').classList.remove('hidden');
    await signOut(auth);
    window.location.href = "login";
  }
};

const officeStatusRef = ref(db, 'adminSettings/officeStatus');
onValue(officeStatusRef, (snapshot) => {
  const statusElem = document.getElementById('officeStatusDisplay');
  if (snapshot.exists()) {
    const status = snapshot.val();
    statusElem.textContent = status;
    statusElem.style.color = status.toLowerCase() === 'closed' ? 'var(--coral)' : 'var(--accent-dark)';
  } else {
    statusElem.textContent = "Open";
  }
});

const avgProcessingRef = ref(db, 'adminSettings/avgProcessingDays');
onValue(avgProcessingRef, (snapshot) => {
  document.getElementById('stat-processing').textContent = snapshot.exists() ? snapshot.val() : "2";
});

function loadUserStats(uid) {
  const requestsQuery = query(ref(db, 'requests'), orderByChild('userId'), equalTo(uid));
  onValue(requestsQuery, (snapshot) => {
    let activeCount = 0;
    let completedCount = 0;

    if (snapshot.exists()) {
      snapshot.forEach(child => {
        const req = child.val();
        const stat = (req.status || "").toLowerCase();
        if (stat.includes('ready') || stat.includes('completed') || stat.includes('pickup')) {
          completedCount++;
        } else {
          activeCount++;
        }
      });
    }
    document.getElementById('stat-active').textContent = activeCount;
    document.getElementById('stat-completed').textContent = completedCount;
  });
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const snapshot = await get(child(ref(db), `users/${user.uid}`));
      const profileImgElem = document.getElementById('userProfileImage');
      const initialsElem = document.getElementById('userInitialsDisplay');

      if (snapshot.exists()) {
        const userData = snapshot.val();
        
        if (userData.status !== "approved") {
          alert("Your account is pending review or restricted. You cannot access the dashboard.");
          await signOut(auth);
          window.location.href = "login";
          return;
        }

        // Format Name
        const fullName = userData.fullName || user.displayName || "User";
        const nameParts = fullName.split(" ");
        let initials = nameParts[0][0];
        if (nameParts.length > 1) {
          initials += nameParts[nameParts.length - 1][0];
        }

        document.getElementById('userNameDisplay').textContent = fullName;
        document.getElementById('welcomeNameDisplay').textContent = nameParts[0]; 
        document.getElementById('userAddressDisplay').textContent = userData.address || "✓ Verified Resident";

        // DYNAMIC LOCATION TAG & SESSION STORAGE
        if(userData.municipality && userData.province) {
          document.getElementById('userLocationTag').innerHTML = `
            <svg class="icon" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            ${userData.municipality}, ${userData.province}
          `;
          
          // Save location to session storage for request.html routing
          sessionStorage.setItem('residentProvince', userData.province);
          sessionStorage.setItem('residentMunicipality', userData.municipality);
          sessionStorage.setItem('residentBarangay', userData.barangay);
        }

        // Profile Image Logic
        const profileImageUrl = userData.profileImage || user.photoURL;
        if (profileImageUrl) {
          profileImgElem.src = profileImageUrl;
          profileImgElem.style.display = 'block';
          initialsElem.style.display = 'none';
        } else {
          profileImgElem.style.display = 'none';
          initialsElem.style.display = 'block';
          initialsElem.textContent = initials.toUpperCase();
        }

        // Trigger fetch for dashboard numbers
        loadUserStats(user.uid);
        
        // Hide Loader
        document.getElementById('pageTransition').classList.add('hidden');
        
      } else {
        // No user data found
        await signOut(auth);
        window.location.href = "index.html";
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  } else {
    window.location.href = "index";
  }
});

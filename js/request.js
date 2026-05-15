import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getDatabase, ref, get, child, push, update, onValue, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

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
let currentUser = null;
let currentUserData = null;
let selectedFiles = []; 

// --- FILE UPLOAD LOGIC ---
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); });
dropZone.addEventListener('drop', (e) => {
  e.preventDefault(); dropZone.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', (e) => {
  handleFiles(e.target.files);
});

function handleFiles(files) {
  if (files.length > 2) {
    alert("You can only select exactly 2 images (Front and Back).");
  }
  selectedFiles = Array.from(files).slice(0, 2);
  updateLocalPreviews();
}

function updateLocalPreviews() {
  const boxF = document.getElementById('boxFront');
  const txtF = document.getElementById('txtFront');
  const boxB = document.getElementById('boxBack');
  const txtB = document.getElementById('txtBack');

  if(selectedFiles.length > 0) {
    boxF.style.display = 'flex';
    txtF.innerText = selectedFiles[0].name;
  } else {
    boxF.style.display = 'none';
  }

  if(selectedFiles.length > 1) {
    boxB.style.display = 'flex';
    txtB.innerText = selectedFiles[1].name;
  } else {
    boxB.style.display = 'none';
  }
}

async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'valid_id'); 
  const res = await fetch('https://api.cloudinary.com/v1_1/dlmnmuizk/image/upload', {
      method: 'POST',
      body: formData
  });
  if(!res.ok) throw new Error("Image upload failed");
  const data = await res.json();
  return data.secure_url;
}

document.getElementById('submitRequestBtn').addEventListener('click', async () => {
  if(!currentUser || !currentUserData) return alert("You must be logged in to submit a request.");
  
  const type = document.getElementById('docType').value;
  const purpose = document.getElementById('docPurpose').value.trim();
  if (!type) return alert("Please select a document type.");
  if (!purpose) return alert("Purpose of request is required.");

  if (selectedFiles.length !== 2) {
    return alert("You must upload exactly 2 photos (Front & Back) of your Valid ID.");
  }

  const btn = document.getElementById('submitRequestBtn');
  btn.disabled = true;
  btn.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; gap:8px;">Uploading IDs securely...</div>`;

  try {
    const url1 = await uploadToCloudinary(selectedFiles[0]);
    const url2 = await uploadToCloudinary(selectedFiles[1]);
    const finalImageUrls = [url1, url2];

    btn.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; gap:8px;">Saving request...</div>`;
    
    const reqRef = push(child(ref(db), 'requests')).key;
    
    const reqData = {
      userId: currentUser.uid,
      userName: currentUserData.fullName || currentUser.displayName,
      province: currentUserData.province || "",
      municipality: currentUserData.municipality || "",
      barangay: currentUserData.barangay || "",
      address: currentUserData.address || "",
      docType: type,
      purpose: purpose,
      idImages: finalImageUrls,
      status: "Pending",
      createdAt: Date.now()
    };

    const updates = {};
    // 1. Save to the main pool
    updates[`requests/${reqRef}`] = reqData;
    
    // 2. Save to the exact locational directory
    if (currentUserData.province && currentUserData.municipality && currentUserData.barangay) {
      updates[`directory/${currentUserData.province}/${currentUserData.municipality}/${currentUserData.barangay}/requests/${reqRef}`] = reqData;
    }

    await update(ref(db), updates);

    alert("Request Submitted Successfully!");
    document.getElementById('docPurpose').value = '';
    document.getElementById('docType').selectedIndex = 0;
    selectedFiles = [];
    updateLocalPreviews();

  } catch (e) {
    alert("Error submitting request: " + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" style="margin-right: 4px;"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Review & Submit`;
  }
});

// --- LISTENER ---
function listenToMyRequests(uid) {
  const listContainer = document.getElementById('myRequestsList');
  const requestsQuery = query(ref(db, 'requests'), orderByChild('userId'), equalTo(uid));
  
  onValue(requestsQuery, (snapshot) => {
    listContainer.innerHTML = ''; 
    if (!snapshot.exists()) {
      listContainer.innerHTML = '<div class="empty-state">You have no active requests.</div>';
      return;
    }

    const reqs = [];
    snapshot.forEach(child => { reqs.push({id: child.key, ...child.val()}); });
    reqs.sort((a,b) => b.createdAt - a.createdAt);

    reqs.forEach(req => {
      const dateStr = new Date(req.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      let statusClass = "status-pending";
      if(req.status.toLowerCase().includes('process')) statusClass = "status-processing";
      if(req.status.toLowerCase().includes('ready') || req.status.toLowerCase().includes('completed') || req.status.toLowerCase().includes('pickup')) statusClass = "status-ready";

      const iconPath = req.docType.includes('Cedula') 
        ? '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>'
        : '<line x1="3" y1="22" x2="21" y2="22"></line><line x1="6" y1="18" x2="6" y2="11"></line><polygon points="12 2 20 7 4 7 12 2"></polygon>';

      listContainer.innerHTML += `
        <div class="req-row">
          <div class="req-icon"><svg class="icon" viewBox="0 0 24 24">${iconPath}</svg></div>
          <div class="req-info">
            <h4>${req.docType}</h4>
            <p>Purpose: ${req.purpose} · ${dateStr}</p>
          </div>
          <div class="status-badge ${statusClass}">${req.status.toUpperCase()}</div>
        </div>
      `;
    });
  });
}

// --- AUTH STATE ---
window.logoutUser = async function() {
  if(confirm("Are you sure you want to sign out?")) {
    document.getElementById('pageTransition').classList.remove('hidden');
    await signOut(auth);
    window.location.href = "login";
  }
};

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    try {
      const snapshot = await get(child(ref(db), `users/${user.uid}`));
      const profileImgElem = document.getElementById('userProfileImage');
      const initialsElem = document.getElementById('userInitialsDisplay');

      if (snapshot.exists()) {
        currentUserData = snapshot.val();
        if (currentUserData.status !== "approved") {
          await signOut(auth);
          window.location.href = "index.html";
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

        listenToMyRequests(user.uid);
      }
    } catch (error) { console.error("Auth error:", error); }
  } else {
    window.location.href = "index.html";
  }
});

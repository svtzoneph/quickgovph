import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getDatabase, ref, get, child, update } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

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
let newProfilePicUrl = null;

// --- GLOBAL UI NAVIGATION ---
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

window.switchSetting = function(panelName) {
  document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  document.getElementById(`panel-${panelName}`).classList.add('active');
  event.currentTarget.classList.add('active');
};

// --- LOCATION API CACHING ---
let allProvinces = [];
let allMunicipalities = [];
let allBarangays = [];

async function initPSGC() {
  try {
    const res = await fetch('https://psgc.gitlab.io/api/provinces');
    allProvinces = await res.json();
    allProvinces.push({ code: "NCR", name: "Metro Manila (NCR)" });
    allProvinces.sort((a, b) => a.name.localeCompare(b.name));
    
    const provSelect = document.getElementById('editProv');
    allProvinces.forEach(p => {
      provSelect.innerHTML += `<option value="${p.code}">${p.name}</option>`;
    });
  } catch(e) { console.error("Error loading PSGC"); }
}

window.loadMunicipalities = async function(preselectName = null) {
  const provCode = document.getElementById('editProv').value;
  const munSelect = document.getElementById('editMun');
  munSelect.innerHTML = '<option value="" disabled selected>Loading...</option>';
  
  try {
    const url = provCode === "NCR" ? `https://psgc.gitlab.io/api/regions/130000000/cities-municipalities` : `https://psgc.gitlab.io/api/provinces/${provCode}/cities-municipalities`;
    const res = await fetch(url);
    allMunicipalities = await res.json();
    allMunicipalities.sort((a, b) => a.name.localeCompare(b.name));

    munSelect.innerHTML = '<option value="" disabled>Select Municipality</option>';
    allMunicipalities.forEach(m => {
      const selected = (m.name === preselectName) ? 'selected' : '';
      munSelect.innerHTML += `<option value="${m.code}" ${selected}>${m.name}</option>`;
    });
    
    if(preselectName) window.loadBarangays(currentUserData.barangay);
  } catch(e) {}
};

window.loadBarangays = async function(preselectName = null) {
  const munCode = document.getElementById('editMun').value;
  const brgySelect = document.getElementById('editBrgy');
  brgySelect.innerHTML = '<option value="" disabled selected>Loading...</option>';

  try {
    const res = await fetch(`https://psgc.gitlab.io/api/cities-municipalities/${munCode}/barangays`);
    allBarangays = await res.json();
    allBarangays.sort((a, b) => a.name.localeCompare(b.name));

    brgySelect.innerHTML = '<option value="" disabled>Select Barangay</option>';
    allBarangays.forEach(b => {
      const selected = (b.name === preselectName) ? 'selected' : '';
      brgySelect.innerHTML += `<option value="${b.code}" ${selected}>${b.name}</option>`;
    });
  } catch(e) {}
};

function setDropdownByText(selectId, textVal) {
  const sel = document.getElementById(selectId);
  for (let i = 0; i < sel.options.length; i++) {
      if (sel.options[i].text === textVal) {
          sel.selectedIndex = i;
          return sel.value;
      }
  }
  return null;
}

async function populateProfileForm() {
  document.getElementById('editName').value = currentUserData.fullName || "";
  document.getElementById('editEmail').value = currentUserData.email || "";

  if (currentUserData.profileImage) {
    document.getElementById('profilePreview').src = currentUserData.profileImage;
    document.getElementById('profilePreview').style.display = 'block';
    newProfilePicUrl = currentUserData.profileImage;
  }

  await initPSGC();
  const pCode = setDropdownByText('editProv', currentUserData.province);
  if(pCode) await window.loadMunicipalities(currentUserData.municipality);
}

// --- CLOUDINARY UPLOAD ---
document.getElementById('picInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if(!file) return;

  const statusText = document.getElementById('uploadStatusText');
  statusText.innerText = "Uploading image...";

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'valid_id'); 

  try {
    const res = await fetch('https://api.cloudinary.com/v1_1/dlmnmuizk/image/upload', { method: 'POST', body: formData });
    const data = await res.json();
    newProfilePicUrl = data.secure_url;
    
    document.getElementById('profilePreview').src = newProfilePicUrl;
    document.getElementById('profilePreview').style.display = 'block';
    statusText.innerText = "Upload complete! Click 'Save Changes'.";
    statusText.style.color = "var(--success)";
  } catch (err) {
    statusText.innerText = "Upload failed. Try again.";
    statusText.style.color = "var(--coral)";
  }
});

// --- SEND PASSWORD RESET ---
window.sendPasswordReset = async function() {
  if(!currentUser || !currentUserData.email) return;
  const btn = document.getElementById('resetPassBtn');
  btn.disabled = true;
  btn.innerText = "Sending...";
  
  try {
    await sendPasswordResetEmail(auth, currentUserData.email);
    alert("A password reset link has been sent to your email address.");
  } catch(e) {
    alert("Error: " + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> Send Reset Link`;
  }
};

// --- SAVE PROFILE CHANGES ---
document.getElementById('saveProfileBtn').addEventListener('click', async () => {
  const newName = document.getElementById('editName').value.trim();
  
  const provSelect = document.getElementById('editProv');
  const munSelect = document.getElementById('editMun');
  const brgySelect = document.getElementById('editBrgy');

  const newProv = provSelect.options[provSelect.selectedIndex].text;
  const newMun = munSelect.options[munSelect.selectedIndex].text;
  const newBrgy = brgySelect.options[brgySelect.selectedIndex].text;

  if(!newName || !newProv || !newMun || !newBrgy || provSelect.value === "" || munSelect.value === "" || brgySelect.value === "") {
    return alert("All fields are required and must be properly selected.");
  }

  const btn = document.getElementById('saveProfileBtn');
  btn.innerHTML = `Saving...`;
  btn.disabled = true;

  try {
    const updates = {};
    const newAddress = `${newBrgy}, ${newMun}, ${newProv}`;

    const updatedData = {
      ...currentUserData,
      fullName: newName,
      province: newProv,
      municipality: newMun,
      barangay: newBrgy,
      address: newAddress,
      profileImage: newProfilePicUrl
    };

    updates[`users/${currentUser.uid}`] = updatedData;

    const oldProv = currentUserData.province;
    const oldMun = currentUserData.municipality;
    const oldBrgy = currentUserData.barangay;

    if (oldProv && oldMun && oldBrgy) {
      if (oldProv !== newProv || oldMun !== newMun || oldBrgy !== newBrgy) {
         updates[`directory/${oldProv}/${oldMun}/${oldBrgy}/users/${currentUser.uid}`] = null;
      }
    }
    
    updates[`directory/${newProv}/${newMun}/${newBrgy}/users/${currentUser.uid}`] = updatedData;

    await update(ref(db), updates);
    
    currentUserData = updatedData;
    document.getElementById('userNameDisplay').innerText = newName;
    document.getElementById('userAddressDisplay').innerText = newAddress;
    
    if(newProfilePicUrl) {
       document.getElementById('userProfileImage').src = newProfilePicUrl;
       document.getElementById('userProfileImage').style.display = 'block';
       document.getElementById('userInitialsDisplay').style.display = 'none';
    } else {
       document.getElementById('userInitialsDisplay').innerText = newName[0].toUpperCase();
    }

    alert("Profile updated successfully!");

  } catch (e) {
    alert("Failed to save changes: " + e.message);
  } finally {
    btn.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Save Changes`;
    btn.disabled = false;
  }
});

// --- AUTH STATE LOGIC ---
window.logoutUser = async function() {
  if(confirm("Are you sure you want to sign out?")) {
    document.getElementById('pageTransition').classList.remove('hidden');
    await signOut(auth);
    window.location.href = "login.html";
  }
};

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    try {
      const snapshot = await get(child(ref(db), `users/${user.uid}`));
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
          document.getElementById('userProfileImage').src = currentUserData.profileImage || user.photoURL;
          document.getElementById('userProfileImage').style.display = 'block';
          document.getElementById('userInitialsDisplay').style.display = 'none';
        } else {
          document.getElementById('userInitialsDisplay').textContent = fullName.split(" ")[0][0].toUpperCase();
        }

        populateProfileForm();
      }
    } catch (error) { console.error("Auth error:", error); }
  } else {
    window.location.href = "index.html";
  }
});

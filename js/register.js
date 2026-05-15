import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut, sendEmailVerification } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getDatabase, ref, update } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

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

// --- PHILIPPINE LOCATION API (PSGC) ---
document.addEventListener("DOMContentLoaded", () => { window.loadProvinces(); });

window.loadProvinces = async function() {
  const provSelect = document.getElementById('regProv');
  try {
    const response = await fetch('https://psgc.gitlab.io/api/provinces');
    const provinces = await response.json();
    provinces.push({ code: "NCR", name: "Metro Manila (NCR)" });
    provinces.sort((a, b) => a.name.localeCompare(b.name));

    provSelect.innerHTML = '<option value="" disabled selected>Select Province...</option>';
    provinces.forEach(prov => { provSelect.innerHTML += `<option value="${prov.code}">${prov.name}</option>`; });
  } catch (error) { provSelect.innerHTML = '<option value="" disabled selected>Error loading</option>'; }
};

window.loadMunicipalities = async function() {
  const provCode = document.getElementById('regProv').value;
  const munSelect = document.getElementById('regMun');
  const brgySelect = document.getElementById('regBrgy');

  munSelect.innerHTML = '<option value="" disabled selected>Loading...</option>'; munSelect.disabled = true;
  brgySelect.innerHTML = '<option value="" disabled selected>Select Municipality First</option>'; brgySelect.disabled = true;

  try {
    const url = provCode === "NCR" ? `https://psgc.gitlab.io/api/regions/130000000/cities-municipalities` : `https://psgc.gitlab.io/api/provinces/${provCode}/cities-municipalities`;
    const response = await fetch(url);
    const municipalities = await response.json();
    municipalities.sort((a, b) => a.name.localeCompare(b.name));

    munSelect.innerHTML = '<option value="" disabled selected>Select City/Mun...</option>';
    municipalities.forEach(mun => { munSelect.innerHTML += `<option value="${mun.code}">${mun.name}</option>`; });
    munSelect.disabled = false;
  } catch (error) { munSelect.innerHTML = '<option value="" disabled selected>Error loading</option>'; }
};

window.loadBarangays = async function() {
  const munCode = document.getElementById('regMun').value;
  const brgySelect = document.getElementById('regBrgy');

  brgySelect.innerHTML = '<option value="" disabled selected>Loading...</option>'; brgySelect.disabled = true;

  try {
    const response = await fetch(`https://psgc.gitlab.io/api/cities-municipalities/${munCode}/barangays`);
    const barangays = await response.json();
    barangays.sort((a, b) => a.name.localeCompare(b.name));

    brgySelect.innerHTML = '<option value="" disabled selected>Select Barangay...</option>';
    barangays.forEach(brgy => { brgySelect.innerHTML += `<option value="${brgy.code}">${brgy.name}</option>`; });
    brgySelect.disabled = false;
  } catch (error) { brgySelect.innerHTML = '<option value="" disabled selected>Error loading</option>'; }
};

// --- AUTH & REGISTRATION ---
function showLoader(msg) {
  document.getElementById('loader').style.display = 'flex';
  document.getElementById('loader-text').innerText = msg;
}

function hideLoader() { 
  document.getElementById('loader').style.display = 'none'; 
}

window.registerResident = async () => {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pass = document.getElementById('regPass').value;
  const passConfirm = document.getElementById('regPassConfirm').value;
  
  const provSelect = document.getElementById('regProv');
  const munSelect = document.getElementById('regMun');
  const brgySelect = document.getElementById('regBrgy');

  if(!name || !email || !pass || !passConfirm || provSelect.value === "" || munSelect.value === "" || brgySelect.value === "") {
    return alert("Please fill out all fields and select your complete location.");
  }
  const nameRegex = /^[a-zA-ZñÑ\s\-\.]+$/;
  if (!nameRegex.test(name)) return alert("Name cannot contain numbers or special characters.");
  if (pass !== passConfirm) return alert("Passwords do not match!");

  const provName = provSelect.options[provSelect.selectedIndex].text;
  const munName = munSelect.options[munSelect.selectedIndex].text;
  const brgyName = brgySelect.options[brgySelect.selectedIndex].text;

  showLoader("Creating Account...");
  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, pass);
    await sendEmailVerification(userCred.user);

    const fullAddress = `${brgyName}, ${munName}, ${provName}`;
    
    const userData = {
      fullName: name, email: email, province: provName, municipality: munName, barangay: brgyName, address: fullAddress,
      role: "resident", status: "pending", authMethod: "email_password", createdAt: Date.now()
    };

    const updates = {};
    updates[`users/${userCred.user.uid}`] = userData;
    updates[`directory/${provName}/${munName}/${brgyName}/users/${userCred.user.uid}`] = userData;
    await update(ref(db), updates);

    hideLoader();
    await signOut(auth); 
    alert("Registration successful! Verify your email using the link sent to you, then wait for Admin approval.");
    window.location.href = "login";
    
  } catch(err) {
    hideLoader();
    alert("Error: " + err.message);
  }
};

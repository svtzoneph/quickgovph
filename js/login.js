import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getDatabase, ref, get, child } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

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

function showLoader(msg) {
  document.getElementById('loader').style.display = 'flex';
  document.getElementById('loader-text').innerText = msg;
}
function hideLoader() { document.getElementById('loader').style.display = 'none'; }

// AUTO-LOGIN LOGIC
onAuthStateChanged(auth, async (user) => {
  if (user) {
    showLoader("Verifying account...");
    
    if (user.emailVerified) {
      const snapshot = await get(child(ref(db), `users/${user.uid}`));
      if (snapshot.exists()) {
        if (snapshot.val().status === "approved") {
          window.location.href = "dashboard.html"; // Success Auto-login
        } else {
          await signOut(auth);
          hideLoader();
        }
      } else {
        // Might be an admin trying to login via resident portal, sign them out here
        await signOut(auth);
        hideLoader();
      }
    } else {
      await signOut(auth);
      hideLoader();
    }
  } else {
    hideLoader();
  }
});

window.forgotPassword = async () => {
  const email = document.getElementById('logEmail').value;
  if(!email) return alert("Please type your email address in the field first.");
  showLoader("Sending Reset Link...");
  try {
    await sendPasswordResetEmail(auth, email);
    hideLoader();
    alert("Password reset link sent! Check your inbox.");
  } catch(err) {
    hideLoader();
    alert("Error: " + err.message);
  }
};

window.loginResident = async () => {
  const e = document.getElementById('logEmail').value;
  const p = document.getElementById('logPass').value;
  if(!e || !p) return alert("Please fill all fields.");
  
  showLoader("Signing In...");
  try {
    const userCred = await signInWithEmailAndPassword(auth, e, p);
    const user = userCred.user;

    if (!user.emailVerified) {
      hideLoader();
      await signOut(auth);
      return alert("Your email is not verified yet. Please check your inbox.");
    }

    const snapshot = await get(child(ref(db), `users/${user.uid}`));
    if (snapshot.exists()) {
      if (snapshot.val().status === "approved") {
        window.location.href = "dashboard";
      } else {
        hideLoader();
        await signOut(auth);
        alert("Account is verified but awaiting Admin approval.");
      }
    } else {
      hideLoader();
      await signOut(auth);
      alert("Account records not found.");
    }
  } catch(err) {
    hideLoader();
    alert("Login Failed: Incorrect email or password.");
  }
};

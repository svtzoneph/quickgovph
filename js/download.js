// Function to hide the loader
function hideLoadingScreen() {
  const loader = document.getElementById('pageTransition');
  if (loader) {
    loader.classList.add('hidden');
  }
}

// Check if page is already loaded, otherwise wait for it
if (document.readyState === 'loading') {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(hideLoadingScreen, 300);
  });
} else {
  setTimeout(hideLoadingScreen, 300);
}

// Show loader on navigating away (e.g. clicking Back to Home)
window.showLoader = function(e, url) {
  e.preventDefault();
  document.getElementById('pageTransition').classList.remove('hidden');
  setTimeout(() => { window.location.href = url; }, 350);
}

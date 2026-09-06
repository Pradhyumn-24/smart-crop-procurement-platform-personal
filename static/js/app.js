/**
 * अपनी BAARI (Apni Baari) - Core Application Logic
 * Bilingual i18n, Accessibility, Tab Navigation & Global State
 */

const AppState = {
  lang: 'hi', // default Hindi for Indian farmer accessibility
  currentTab: 'farmer',
  fontSize: 16,
  isHighContrast: false,
  activeTokenId: 'AB-2026-0101', // Pre-selected active token for instant demonstration
  selectedMandiId: 'MANDI-KRN',
  isOffline: false,
  offlineQueue: []
};

// Bilingual Dictionary
const i18n = {
  hi: {
    portalName: 'अपनी BAARI',
    portalTagline: 'ई-उपार्जन कतार व टोकन प्रबंधन प्रणाली',
    govTitle: 'भारत सरकार | कृषि एवं किसान कल्याण मंत्रालय',
    deptTitle: 'खाद्य एवं सार्वजनिक वितरण विभाग | राष्ट्रीय ई-उपार्जन मिशन',
    navFarmer: '🌾 किसान सेवा (Farmer Portal)',
    navOfficer: '🏢 मंडी अधिकारी डैशबोर्ड (Officer Dashboard)',
    navAnalytics: '🗺️ राज्य निगरानी व हीटमैप (State Analytics)',
    navSmart: '💡 स्मार्ट व नवाचार (Smart & WOW Demos)',
    bookSlotBtn: 'नया स्लॉट / टोकन बुक करें',
    trackTokenBtn: 'अपनी बारी ट्रैक करें',
    geoCheckinBtn: '📍 भू-स्थान चेक-इन (Gate Arrival)',
    callNextBtn: '🔔 अगला किसान बुलाएं',
    activeTokenTitle: 'आपका सक्रिय टोकन',
    queuePosition: 'कतार में स्थान',
    tokensAhead: 'आपसे आगे वाहन',
    estWaitTime: 'अनुमानित प्रतीक्षा',
    stage1: 'स्लॉट आरक्षित',
    stage2: 'मंडी आगमन',
    stage3: 'सकल वजन (तौल)',
    stage4: 'गुणवत्ता जांच',
    stage5: 'उतराई शेड',
    stage6: 'अंतिम तौल व जे-फॉर्म'
  },
  en: {
    portalName: 'APNI BAARI',
    portalTagline: 'Smart Grain Procurement & Queue Management System',
    govTitle: 'Government of India | Ministry of Agriculture & Farmers Welfare',
    deptTitle: 'Department of Food & Public Distribution | National e-Upārjan Mission',
    navFarmer: '🌾 Farmer Portal',
    navOfficer: '🏢 Mandi Officer Dashboard',
    navAnalytics: '🗺️ State Analytics & Heatmap',
    navSmart: '💡 Smart & WOW Demos',
    bookSlotBtn: 'Book Procurement Slot',
    trackTokenBtn: 'Track My Queue Position',
    geoCheckinBtn: '📍 Geo-fenced Gate Arrival',
    callNextBtn: '🔔 Call Next Farmer',
    activeTokenTitle: 'Your Active Token',
    queuePosition: 'Queue Position',
    tokensAhead: 'Vehicles Ahead',
    estWaitTime: 'Estimated Wait Time',
    stage1: 'Slot Booked',
    stage2: 'Mandi Arrival',
    stage3: 'Gross Weight',
    stage4: 'Quality Check',
    stage5: 'Yard Unloading',
    stage6: 'Tare & J-Form'
  }
};

// Language switcher
function setLanguage(lang) {
  AppState.lang = lang;
  document.querySelectorAll('.lang-switch-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  // Update text for marked elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (i18n[lang] && i18n[lang][key]) {
      el.textContent = i18n[lang][key];
    }
  });

  // Re-render components with translated dynamic text
  if (window.renderLiveTokenCard) window.renderLiveTokenCard();
  if (window.loadMandiOfficerQueue) window.loadMandiOfficerQueue();
}

// Accessibility font scaling
function adjustFontSize(delta) {
  if (delta === 0) {
    AppState.fontSize = 16;
  } else {
    AppState.fontSize = Math.max(12, Math.min(22, AppState.fontSize + delta));
  }
  document.documentElement.style.setProperty('--font-base', `${AppState.fontSize}px`);
}

// High contrast mode toggle
function toggleHighContrast() {
  AppState.isHighContrast = !AppState.isHighContrast;
  document.body.classList.toggle('high-contrast', AppState.isHighContrast);
}

// Tab navigation
function switchTab(tabId) {
  AppState.currentTab = tabId;
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `tab-${tabId}`);
  });

  // Refresh tab-specific data
  if (tabId === 'farmer') {
    if (window.refreshFarmerDashboard) window.refreshFarmerDashboard();
  } else if (tabId === 'officer') {
    if (window.loadMandiOfficerQueue) window.loadMandiOfficerQueue();
  } else if (tabId === 'analytics') {
    if (window.initAnalyticsAndMap) window.initAnalyticsAndMap();
  } else if (tabId === 'smart') {
    if (window.initAIScanner) window.initAIScanner();
  }
}

// Text-to-Speech Voice Announcement
function speakAnnouncement(textHi, textEn) {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported');
    return;
  }
  window.speechSynthesis.cancel();
  const text = AppState.lang === 'hi' ? textHi : textEn;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  utterance.lang = AppState.lang === 'hi' ? 'hi-IN' : 'en-IN';
  window.speechSynthesis.speak(utterance);
}

// Toast notification display
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-item ${type}`;
  toast.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px;">
      <span>${type === 'success' ? '✅' : (type === 'warning' ? '⚠️' : '📢')}</span>
      <span>${message}</span>
    </div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// Document Ready
document.addEventListener('DOMContentLoaded', () => {
  // Navigation listeners
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(btn.dataset.tab);
    });
  });

  // Language buttons
  document.querySelectorAll('.lang-switch-btn').forEach(btn => {
    btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
  });

  // Fetch initial marquee updates
  fetch('/api/crops')
    .then(r => r.json())
    .then(crops => {
      const ticker = document.getElementById('msp-ticker-content');
      if (ticker) {
        ticker.innerHTML = crops.map(c => `
          <span class="ticker-item">
            <span class="badge badge-green">MSP</span>
            <strong>${c.name_hi}:</strong> ₹${c.msp_per_quintal.toLocaleString('en-IN')}/क्विंटल
          </span>
        `).join('');
      }
    })
    .catch(err => console.error('Error fetching crops:', err));

  // Initialize farmer dashboard
  if (window.initFarmerModule) window.initFarmerModule();
});

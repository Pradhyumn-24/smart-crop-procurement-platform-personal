/**
 * अपनी BAARI (Apni Baari) - State Heatmap, Charts & Offline Sync Engine
 */

let leafletMap = null;
let procurementChart = null;
let waitTimeChart = null;

function initAnalyticsAndMap() {
  fetch('/api/analytics')
    .then(r => r.json())
    .then(data => {
      renderAnalyticsMetrics(data);
      renderProcurementCharts(data);
    });

  fetch('/api/mandis')
    .then(r => r.json())
    .then(mandis => {
      initMandiMap(mandis);
    });
}

function renderAnalyticsMetrics(data) {
  const tEl = document.getElementById('stat-total-tokens');
  const mEl = document.getElementById('stat-metric-tons');
  const pEl = document.getElementById('stat-total-payout');
  const wEl = document.getElementById('stat-wait-reduction');

  if (tEl) tEl.textContent = data.total_tokens_issued.toLocaleString('en-IN');
  if (mEl) mEl.textContent = data.total_metric_tons.toLocaleString('en-IN') + ' MT';
  if (pEl) pEl.textContent = '₹' + (data.total_payout_inr / 10000000).toFixed(2) + ' Cr';
  if (wEl) wEl.textContent = '95% (42m vs 14h)';
}

function initMandiMap(mandis) {
  const mapContainer = document.getElementById('mandi-leaflet-map');
  if (!mapContainer) return;

  if (leafletMap) {
    leafletMap.invalidateSize();
    return;
  }

  // Centered over Northern/Central India (Haryana / Delhi / Punjab)
  leafletMap = L.map('mandi-leaflet-map').setView([28.6139, 77.2090], 6);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap contributors | e-Upārjan'
  }).addTo(leafletMap);

  mandis.forEach(m => {
    // Congestion colors
    let color = '#22c55e'; // green
    if (m.congestion_index > 0.7) color = '#ef4444'; // red
    else if (m.congestion_index > 0.45) color = '#f59e0b'; // yellow/orange

    const circle = L.circleMarker([m.lat, m.lng], {
      radius: 12 + (m.congestion_index * 10),
      fillColor: color,
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8
    }).addTo(leafletMap);

    const popupContent = `
      <div style="font-family:sans-serif; min-width:180px;">
        <h4 style="margin:0; color:#0b4582;">${m.name_hi}</h4>
        <div style="font-size:0.8rem; color:#555;">${m.name_en} (${m.state})</div>
        <hr style="margin:6px 0; border:0; border-top:1px solid #ddd;">
        <div style="font-size:0.82rem;">
          <strong>कतार में वाहन:</strong> ${m.live_queue_count || 4} वाहन<br>
          <strong>अनुमानित प्रतीक्षा:</strong> ${m.live_ewt_mins || 35} मिनट<br>
          <strong>सक्रिय धर्मकांटे:</strong> ${m.active_weighbridges}<br>
          <strong>मौसम:</strong> ${m.weather_status} (${m.weather_temp}°C)
        </div>
      </div>
    `;

    circle.bindPopup(popupContent);
  });
}

function renderProcurementCharts(data) {
  const ctxTons = document.getElementById('chart-procurement-tons');
  const ctxWait = document.getElementById('chart-wait-time');

  if (ctxTons && !procurementChart) {
    procurementChart = new Chart(ctxTons, {
      type: 'bar',
      data: {
        labels: data.state_breakdown.map(s => s.state),
        datasets: [{
          label: 'उपार्जित खाद्यान्न (Metric Tons)',
          data: data.state_breakdown.map(s => s.tons),
          backgroundColor: '#0b4582',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  if (ctxWait && !waitTimeChart) {
    waitTimeChart = new Chart(ctxWait, {
      type: 'doughnut',
      data: {
        labels: ['अपनी बारी द्वारा बचाया गया समय (Saved Time)', 'वर्तमान औसत प्रतीक्षा (Current Wait: 42m)'],
        datasets: [{
          data: [798, 42],
          backgroundColor: ['#15803d', '#f37021']
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  }
}

// ----------------- OFFLINE SYNC ENGINE -----------------

function toggleOfflineMode(forceState) {
  AppState.isOffline = forceState !== undefined ? forceState : !AppState.isOffline;
  
  const bar = document.getElementById('offline-notification-bar');
  if (bar) {
    bar.classList.toggle('active', AppState.isOffline);
  }

  const btn = document.getElementById('offline-toggle-btn');
  if (btn) {
    btn.textContent = AppState.isOffline ? '📡 इंटरनेट पुनः कनेक्ट करें (Go Online)' : '📴 ऑफ़लाइन मोड अनुकरण (Simulate Offline)';
    btn.className = AppState.isOffline ? 'btn-gov btn-gov-green' : 'btn-gov btn-gov-outline';
  }

  if (AppState.isOffline) {
    showToast('ऑफ़लाइन मोड सक्रिय! इंटरनेट न होने पर भी टोकन स्थानीय रूप से सुरक्षित होंगे।', 'warning');
  } else {
    showToast('इंटरनेट पुनः कनेक्ट हुआ! स्थानीय टोकन सिंक हो रहे हैं...', 'success');
    syncOfflineTokensToServer();
  }
}

function saveTokenOffline(data) {
  const offlineId = `OFFLINE-${Date.now()}`;
  const item = {
    offline_id: offlineId,
    mandi_id: data.mandi_id,
    farmer_name: data.farmer_name,
    farmer_mobile: data.farmer_mobile,
    crop_id: data.crop_id,
    quantity_quintals: data.quantity_quintals,
    vehicle_type: data.vehicle_type,
    vehicle_number: data.vehicle_number,
    timestamp: new Date().toISOString()
  };

  AppState.offlineQueue.push(item);
  closeModal('booking-modal');

  showToast(`[ऑफ़लाइन टोकन सुरक्षित] टोकन ${offlineId} डिवाइस में सेव हो गया है। नेटवर्क आते ही स्वचालित रूप से सिंक होगा।`, 'info');
  updateOfflineCountBadge();
}

function updateOfflineCountBadge() {
  const badge = document.getElementById('offline-queue-count');
  if (badge) {
    badge.textContent = `${AppState.offlineQueue.length} टोकन कतार में`;
  }
}

function syncOfflineTokensToServer() {
  if (AppState.offlineQueue.length === 0) return;

  const payload = [...AppState.offlineQueue];
  fetch('/api/tokens/bulk-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(r => r.json())
  .then(res => {
    if (res.success) {
      AppState.offlineQueue = [];
      updateOfflineCountBadge();
      showToast(`सफलता! ${res.synced_count} ऑफ़लाइन टोकन सर्वर पर सिंक हो गए हैं।`, 'success');
      loadPaymentStatusTable();
    }
  });
}

window.initAnalyticsAndMap = initAnalyticsAndMap;
window.toggleOfflineMode = toggleOfflineMode;
window.syncOfflineTokensToServer = syncOfflineTokensToServer;
window.saveTokenOffline = saveTokenOffline;

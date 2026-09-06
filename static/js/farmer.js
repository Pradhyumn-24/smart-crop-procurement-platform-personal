/**
 * अपनी BAARI (Apni Baari) - Farmer Module
 * Slot Booking, Live Queue Tracking, Geo-Checkin, Token Pass & DBT Status
 */

let liveCountdownInterval = null;
let currentWaitSeconds = 25 * 60;

function initFarmerModule() {
  loadMandisList();
  loadCropsList();
  loadLiveTokenData(AppState.activeTokenId);
  setupFormListeners();
  loadPaymentStatusTable();
}

// Load Mandis for booking selector
function loadMandisList() {
  fetch('/api/mandis')
    .then(r => r.json())
    .then(mandis => {
      const selectEl = document.getElementById('book-mandi');
      const trackSelect = document.getElementById('quick-mandi-select');
      
      if (selectEl) {
        selectEl.innerHTML = mandis.map(m => `
          <option value="${m.id}" data-weather="${m.weather_status}" data-rain="${m.rain_probability}">
            ${m.name_hi} (${m.name_en}) - ${m.district}
          </option>
        `).join('');
      }

      if (trackSelect) {
        trackSelect.innerHTML = mandis.map(m => `
          <option value="${m.id}">${m.name_hi} (${m.name_en})</option>
        `).join('');
        trackSelect.value = AppState.selectedMandiId;
      }
    });
}

// Load Crops for booking selector
function loadCropsList() {
  fetch('/api/crops')
    .then(r => r.json())
    .then(crops => {
      const selectEl = document.getElementById('book-crop');
      if (selectEl) {
        selectEl.innerHTML = crops.map(c => `
          <option value="${c.id}" data-msp="${c.msp_per_quintal}">
            ${c.name_hi} - MSP: ₹${c.msp_per_quintal}/क्विंटल
          </option>
        `).join('');
      }
      updateEstimatedPayment();
    });
}

// Calculate provisional payout in booking modal
function updateEstimatedPayment() {
  const cropSelect = document.getElementById('book-crop');
  const qtyInput = document.getElementById('book-qty');
  const previewBox = document.getElementById('booking-payout-preview');
  
  if (!cropSelect || !qtyInput || !previewBox) return;
  
  const selectedOption = cropSelect.options[cropSelect.selectedIndex];
  const msp = selectedOption ? parseFloat(selectedOption.dataset.msp || 2425) : 2425;
  const qty = parseFloat(qtyInput.value) || 0;
  const total = qty * msp;
  
  previewBox.innerHTML = `
    <div style="background: #e8f5e9; border:1px solid #c8e6c9; border-radius:6px; padding:10px; margin-top:10px;">
      <div style="font-size:0.85rem; color:#2e7d32; font-weight:700;">अनुमानित सरकारी एमएसपी मूल्य (Provisional MSP Payout):</div>
      <div style="font-size:1.35rem; color:#1b5e20; font-weight:800;">₹${total.toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
      <div style="font-size:0.75rem; color:#388e3c;">*अंतिम भुगतान धर्मकांटा तौल व गुणवत्ता जांच के उपरांत सीधे बैंक खाते (DBT) में होगा।</div>
    </div>
  `;
}

// Fetch live token data and update UI
function loadLiveTokenData(tokenId) {
  if (!tokenId) return;

  fetch(`/api/tokens/${tokenId}`)
    .then(r => {
      if (!r.ok) throw new Error('Token not found');
      return r.json();
    })
    .then(token => {
      AppState.activeTokenData = token;
      renderLiveTokenCard(token);
    })
    .catch(err => {
      console.warn('Could not load active token:', err);
    });
}

// Render token details and stage progression
function renderLiveTokenCard(token) {
  token = token || AppState.activeTokenData;
  if (!token) return;

  const card = document.getElementById('live-token-container');
  if (!card) return;

  const isHi = AppState.lang === 'hi';
  const stage = token.stage_index || 1;
  const waitMins = token.estimated_wait_minutes || 25;
  currentWaitSeconds = waitMins * 60;

  // Build 6 stages
  const stages = [
    { titleHi: 'स्लॉट आरक्षित', titleEn: 'Booked', icon: '1' },
    { titleHi: 'मंडी आगमन', titleEn: 'Yard Arrived', icon: '2' },
    { titleHi: 'सकल तौल (Gross)', titleEn: 'Gross Weight', icon: '3' },
    { titleHi: 'गुणवत्ता परख', titleEn: 'Quality Inspection', icon: '4' },
    { titleHi: 'उतराई शेड', titleEn: 'Unloading Shed', icon: '5' },
    { titleHi: 'अंतिम तौल व जे-फॉर्म', titleEn: 'J-Form & Payment', icon: '6' }
  ];

  const stepperHtml = stages.map((st, idx) => {
    const stepNum = idx + 1;
    let cls = 'step-item';
    if (stepNum < stage) cls += ' completed';
    else if (stepNum === stage) cls += ' active';

    return `
      <div class="${cls}">
        <div class="step-circle">${stepNum < stage ? '✓' : stepNum}</div>
        <div class="step-label">${isHi ? st.titleHi : st.titleEn}</div>
      </div>
    `;
  }).join('');

  // Status badge
  const statusLabels = {
    'BOOKED': { hi: 'स्लॉट आरक्षित (ऑन द वे)', en: 'Slot Booked (On the Way)', cls: 'status-booked' },
    'ARRIVED': { hi: 'मंडी परिसर में उपस्थित (लाइन में)', en: 'Arrived at Mandi Yard', cls: 'status-arrived' },
    'WEIGHBRIDGE_GROSS': { hi: 'धर्मकांटा 1 पर सकल तौल जारी', en: 'At Weighbridge (Gross Weight)', cls: 'status-weighbridge' },
    'QUALITY_CHECK': { hi: 'गुणवत्ता व नमी जांच डेस्क', en: 'Quality & Moisture Inspection', cls: 'status-quality' },
    'UNLOADING': { hi: 'शेड में फसल उतराई जारी', en: 'Grain Unloading in Progress', cls: 'status-unloading' },
    'COMPLETED': { hi: 'उपार्जन पूर्ण (जे-फॉर्म जारी)', en: 'Procurement Complete (J-Form Issued)', cls: 'status-completed' }
  };

  const curStatus = statusLabels[token.status] || { hi: token.status, en: token.status, cls: 'status-booked' };

  card.innerHTML = `
    <div class="token-hero-card">
      <div class="token-hero-header">
        <div>
          <div style="font-size:0.85rem; color:var(--gov-text-muted); font-weight:700;">
            ${isHi ? 'ई-उपार्जन डिजिटल टोकन (e-Procurement Token)' : 'Digital Procurement Token'}
          </div>
          <div class="token-big-id">
            <span>🎫 ${token.id}</span>
            <span class="status-pill ${curStatus.cls}">${isHi ? curStatus.hi : curStatus.en}</span>
          </div>
          <div style="font-size:0.9rem; color:var(--gov-blue); font-weight:600; margin-top:4px;">
            🏢 ${isHi ? token.mandi_name_hi : token.mandi_name_en} | 📍 ${token.shed_assigned}
          </div>
        </div>

        <div style="text-align:right;">
          <button class="btn-gov btn-gov-outline" style="border-color:var(--gov-blue); color:var(--gov-blue); padding:6px 14px; font-size:0.85rem;" onclick="speakCurrentTokenAnnouncement()">
            🔊 ${isHi ? 'आवाज में सुनें' : 'Audio Announcement'}
          </button>
          <button class="btn-gov btn-gov-blue" style="padding:6px 14px; font-size:0.85rem; margin-left:6px;" onclick="openTokenPassModal('${token.id}')">
            🖨️ ${isHi ? 'टोकन पर्ची देखें' : 'View Token Pass'}
          </button>
        </div>
      </div>

      <!-- 6-Stage Visual Stepper -->
      <div class="queue-stepper">
        ${stepperHtml}
      </div>

      <!-- Live Dynamic Metric Grid -->
      <div class="token-hero-details-grid">
        <div class="token-detail-box">
          <div class="detail-title">${isHi ? 'किसान का नाम' : 'Farmer Name'}</div>
          <div class="detail-value">${token.farmer_name}</div>
          <div style="font-size:0.75rem; color:var(--gov-text-muted);">📱 ${token.farmer_mobile}</div>
        </div>

        <div class="token-detail-box">
          <div class="detail-title">${isHi ? 'फसल व मात्रा' : 'Crop & Quantity'}</div>
          <div class="detail-value">${isHi ? token.crop_name_hi : token.crop_name_en}</div>
          <div style="font-size:0.75rem; color:var(--gov-green); font-weight:700;">⚖️ ${token.quantity_quintals} क्विंटल (Quintals)</div>
        </div>

        <div class="token-detail-box">
          <div class="detail-title">${isHi ? 'वाहन प्रकार व नंबर' : 'Vehicle & Reg No'}</div>
          <div class="detail-value">🚜 ${token.vehicle_number}</div>
          <div style="font-size:0.75rem; color:var(--gov-text-muted);">${token.vehicle_type}</div>
        </div>

        <div class="token-detail-box">
          <div class="detail-title">${isHi ? 'आपसे आगे वाहन' : 'Vehicles Ahead'}</div>
          <div class="detail-value" style="color:var(--gov-saffron); font-size:1.4rem;">
            ${token.tokens_ahead} <span style="font-size:0.85rem; font-weight:normal;">${isHi ? 'वाहन' : 'vehicles'}</span>
          </div>
          <div style="font-size:0.75rem; color:var(--gov-text-muted);">कतार में क्रम: #${token.queue_position || 1}</div>
        </div>

        <div class="token-detail-box" style="background:#fff3e0; border-radius:6px; padding:10px;">
          <div class="detail-title" style="color:#e65100;">${isHi ? 'अनुमानित प्रतीक्षा समय' : 'Estimated Waiting Time'}</div>
          <div class="detail-value" style="color:#d84315; font-size:1.4rem;" id="countdown-timer-display">
            ~${waitMins} मिनट
          </div>
          <div style="font-size:0.72rem; color:#bf360c;">*धर्मकांटा व शेड गति के आधार पर लाइव अपडेट</div>
        </div>
      </div>

      <!-- Interactive Gate Arrival & Weather Callout Bar -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-top:1px solid #eef2f6; padding-top:14px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:1.4rem;">🌧️</span>
          <div>
            <div style="font-size:0.85rem; font-weight:700; color:var(--gov-blue-dark);">
              ${isHi ? 'मौसम अनुकूल शेड प्रबंधन:' : 'Weather-Aware Shed Allocation:'}
            </div>
            <div style="font-size:0.8rem; color:var(--gov-text-muted);">
              ${token.rain_probability > 30 ? 'बारिश के कारण आपको कवर्ड शेड (Covered Shed) आवंटित किया गया है।' : 'खुले यार्ड शेड में तेज गति से उतराई हो रही है।'}
            </div>
          </div>
        </div>

        <div>
          ${token.stage_index === 1 ? `
            <button class="btn-gov btn-gov-green" onclick="triggerGeoCheckin('${token.id}')">
              📍 ${isHi ? 'मैं मंडी गेट पहुंच गया हूँ (चेक-इन)' : 'I Have Reached Mandi (Check-in)'}
            </button>
          ` : `
            <span style="color:var(--gov-green); font-weight:700; font-size:0.9rem;">
              ✅ ${isHi ? 'मंडी आगमन सत्यापित (Gate Arrival Verified)' : 'Gate Arrival Verified'}
            </span>
          `}
        </div>
      </div>
    </div>
  `;

  startCountdownTimer();
}

// Countdown timer loop
function startCountdownTimer() {
  if (liveCountdownInterval) clearInterval(liveCountdownInterval);

  liveCountdownInterval = setInterval(() => {
    if (currentWaitSeconds > 0) {
      currentWaitSeconds--;
      const el = document.getElementById('countdown-timer-display');
      if (el) {
        const m = Math.floor(currentWaitSeconds / 60);
        const s = currentWaitSeconds % 60;
        el.textContent = `${m} मिनट ${s < 10 ? '0' : ''}${s} सेकंड`;
      }
    }
  }, 1000);
}

// Speak Token Status using Web Speech API
function speakCurrentTokenAnnouncement() {
  const t = AppState.activeTokenData;
  if (!t) return;

  const hi = `ध्यान दें! टोकन संख्या ${t.id}, किसान ${t.farmer_name}, फसल ${t.crop_name_hi}। आपसे आगे ${t.tokens_ahead} वाहन हैं। कृपया ${t.shed_assigned} के पास तैयार रहें।`;
  const en = `Attention please! Token number ${t.id}, farmer ${t.farmer_name}. There are ${t.tokens_ahead} vehicles ahead of you. Please be ready near ${t.shed_assigned}.`;

  speakAnnouncement(hi, en);
  showToast(AppState.lang === 'hi' ? 'आवाज में घोषणा चलाई जा रही है...' : 'Playing voice announcement...', 'info');
}

// Geo-fenced Check-in action
function triggerGeoCheckin(tokenId) {
  tokenId = tokenId || AppState.activeTokenId;
  showToast('GPS भू-स्थान सत्यापित किया जा रहा है...', 'info');

  fetch(`/api/tokens/${tokenId}/geo-checkin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat: 29.6857, lng: 76.9905 })
  })
  .then(r => r.json())
  .then(res => {
    showToast(res.message, 'success');
    loadLiveTokenData(tokenId);
    speakAnnouncement(
      'भू-स्थान सत्यापन सफल! मंडी गेट में प्रवेश अधिकृत। कृपया होल्डिंग यार्ड गेट 2 पर जाएं।',
      'Geo-checkin verified! Gate entry authorized. Please proceed to holding yard gate 2.'
    );
  })
  .catch(err => {
    showToast('चेक-इन में त्रुटि: ' + err.message, 'warning');
  });
}

// Setup form submit & event listeners
function setupFormListeners() {
  const form = document.getElementById('slot-booking-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const bookingData = {
        mandi_id: document.getElementById('book-mandi').value,
        farmer_name: document.getElementById('book-name').value,
        farmer_mobile: document.getElementById('book-mobile').value,
        farmer_aadhaar: document.getElementById('book-aadhaar').value,
        farmer_village: document.getElementById('book-village').value,
        crop_id: document.getElementById('book-crop').value,
        quantity_quintals: parseFloat(document.getElementById('book-qty').value),
        vehicle_type: document.getElementById('book-vehicle-type').value,
        vehicle_number: document.getElementById('book-vehicle-no').value,
        slot_date: document.getElementById('book-date').value,
        slot_time: document.getElementById('book-time').value
      };

      // Check if offline simulation is active
      if (AppState.isOffline) {
        saveTokenOffline(bookingData);
        return;
      }

      fetch('/api/tokens/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData)
      })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          closeModal('booking-modal');
          AppState.activeTokenId = res.token_id;
          loadLiveTokenData(res.token_id);
          showToast(`टोकन ${res.token_id} सफलतापूर्वक आरक्षित हुआ!`, 'success');
          openTokenPassModal(res.token_id);
          
          if (res.weather_alert) {
            showToast('मौसम अलर्ट: बारिश की संभावना को देखते हुए कवर्ड शेड आवंटित किया गया।', 'warning');
          }
        }
      })
      .catch(err => {
        showToast('बुकिंग में त्रुटि: ' + err.message, 'warning');
      });
    });
  }

  // Quick mobile search tracker
  const searchBtn = document.getElementById('search-token-btn');
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      const q = document.getElementById('search-token-input').value.trim();
      if (!q) return;

      if (q.startsWith('AB-')) {
        AppState.activeTokenId = q;
        loadLiveTokenData(q);
      } else {
        // Search by mobile
        fetch(`/api/tokens/track/mobile/${q}`)
          .then(r => r.json())
          .then(tokens => {
            if (tokens.length > 0) {
              AppState.activeTokenId = tokens[0].id;
              loadLiveTokenData(tokens[0].id);
              showToast(`मोबाइल नंबर के लिए टोकन ${tokens[0].id} मिला।`, 'success');
            } else {
              showToast('कोई टोकन नहीं मिला। कृपया सही टोकन संख्या दर्ज करें।', 'warning');
            }
          });
      }
    });
  }
}

// Open Digital Token Pass Modal
function openTokenPassModal(tokenId) {
  fetch(`/api/tokens/${tokenId}`)
    .then(r => r.json())
    .then(token => {
      const modal = document.getElementById('token-pass-modal');
      const container = document.getElementById('token-pass-content');
      if (!modal || !container) return;

      container.innerHTML = `
        <div style="border:2px solid var(--gov-blue); padding:20px; border-radius:8px; background:#fff; position:relative;">
          <!-- Tricolor Strip on Pass -->
          <div style="height:4px; background:linear-gradient(90deg, #FF9933 33.3%, #FFFFFF 33.3%, #FFFFFF 66.6%, #138808 66.6%); margin:-20px -20px 16px -20px;"></div>

          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #0b4582; padding-bottom:12px; margin-bottom:14px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <img src="/static/images/logo.png" style="height:48px;" alt="अपनी BAARI">
              <div>
                <h4 style="color:#0b4582; margin:0; font-size:1.1rem;">राष्ट्रीय ई-उपार्जन डिजिटल पास</h4>
                <span style="font-size:0.75rem; color:#555;">National e-Procurement Gate Pass | Govt. of India</span>
              </div>
            </div>
            <div style="text-align:right;">
              <div style="background:#e8f5e9; color:#1b5e20; padding:3px 8px; border-radius:4px; font-size:0.75rem; font-weight:700;">अधिकृत टोकन</div>
              <div style="font-size:0.75rem; color:#666;">दिनांक: ${token.slot_date}</div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 2fr 1fr; gap:16px; align-items:center;">
            <div>
              <div style="font-size:1.8rem; font-weight:800; color:#b71c1c; letter-spacing:1px; margin-bottom:8px;">
                ${token.id}
              </div>
              <table style="width:100%; font-size:0.88rem; border-collapse:collapse;">
                <tr>
                  <td style="padding:4px 0; color:#666;"><strong>किसान का नाम:</strong></td>
                  <td style="padding:4px 0; font-weight:700;">${token.farmer_name}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; color:#666;"><strong>मोबाइल / आधार:</strong></td>
                  <td style="padding:4px 0;">${token.farmer_mobile} (${token.farmer_aadhaar_masked})</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; color:#666;"><strong>मंडी व शेड:</strong></td>
                  <td style="padding:4px 0; color:#0b4582; font-weight:700;">${token.mandi_name_hi} - ${token.shed_assigned}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; color:#666;"><strong>फसल व मात्रा:</strong></td>
                  <td style="padding:4px 0;">${token.crop_name_hi} - <strong>${token.quantity_quintals} क्विंटल</strong></td>
                </tr>
                <tr>
                  <td style="padding:4px 0; color:#666;"><strong>वाहन संख्या:</strong></td>
                  <td style="padding:4px 0; font-weight:700;">🚜 ${token.vehicle_number} (${token.vehicle_type})</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; color:#666;"><strong>आरक्षित स्लॉट:</strong></td>
                  <td style="padding:4px 0; color:#d84315; font-weight:700;">${token.slot_time}</td>
                </tr>
              </table>
            </div>

            <!-- Simulated SVG QR Code -->
            <div style="text-align:center; padding:10px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px;">
              <svg viewBox="0 0 100 100" width="100" height="100">
                <rect width="100" height="100" fill="#ffffff"/>
                <!-- Outer Corners -->
                <rect x="5" y="5" width="28" height="28" fill="#000"/>
                <rect x="9" y="9" width="20" height="20" fill="#fff"/>
                <rect x="13" y="13" width="12" height="12" fill="#000"/>

                <rect x="67" y="5" width="28" height="28" fill="#000"/>
                <rect x="71" y="9" width="20" height="20" fill="#fff"/>
                <rect x="75" y="13" width="12" height="12" fill="#000"/>

                <rect x="5" y="67" width="28" height="28" fill="#000"/>
                <rect x="9" y="71" width="20" height="20" fill="#fff"/>
                <rect x="13" y="75" width="12" height="12" fill="#000"/>

                <!-- Simulated data blocks -->
                <rect x="42" y="10" width="8" height="8" fill="#000"/>
                <rect x="52" y="18" width="6" height="6" fill="#000"/>
                <rect x="40" y="40" width="20" height="20" fill="#0b4582"/>
                <circle cx="50" cy="50" r="4" fill="#fff"/>
                <rect x="15" y="45" width="12" height="6" fill="#000"/>
                <rect x="75" y="45" width="14" height="6" fill="#000"/>
                <rect x="45" y="75" width="12" height="12" fill="#000"/>
                <rect x="70" y="70" width="8" height="16" fill="#000"/>
              </svg>
              <div style="font-size:0.68rem; color:#555; margin-top:4px; font-family:monospace;">गेट स्कैनर हेतु</div>
            </div>
          </div>

          <div style="margin-top:14px; padding-top:10px; border-top:1px dashed #ccc; display:flex; justify-content:space-between; font-size:0.75rem; color:#777;">
            <span>सुरक्षा कोड: SEC-2026-KRN-098</span>
            <span>हेल्पलाइन: 1800-180-1551 (टोल फ्री)</span>
          </div>
        </div>
      `;
      openModal('token-pass-modal');
    });
}

// Load DBT Payment Status Table
function loadPaymentStatusTable() {
  fetch('/api/tokens')
    .then(r => r.json())
    .then(tokens => {
      const tbody = document.getElementById('payment-table-body');
      if (!tbody) return;

      tbody.innerHTML = tokens.map(t => {
        const isPaid = t.payment_status === 'TRANSFERRED_TO_DBT';
        const isAppr = t.payment_status === 'APPROVED';

        return `
          <tr>
            <td><strong>${t.id}</strong></td>
            <td>${t.farmer_name}</td>
            <td>${t.crop_name_hi} (${t.quantity_quintals} Qtl)</td>
            <td><strong>₹${t.payment_amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong></td>
            <td>
              ${isPaid ? 
                '<span class="status-pill status-completed">✅ अंतरित (Transferred)</span>' : 
                (isAppr ? '<span class="status-pill status-arrived">⏳ स्वीकृत (Processing)</span>' : 
                '<span class="status-pill status-booked">तौल प्रतीक्षित</span>')}
            </td>
            <td><code style="font-size:0.8rem;">${t.dbt_utr || '—'}</code></td>
          </tr>
        `;
      }).join('');
    });
}

// Modal helper functions
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('open');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}

// Autofill demo data for ease of review
function autofillDemoBooking() {
  document.getElementById('book-name').value = 'रामेश्वर दयाल (Rameshwar Dayal)';
  document.getElementById('book-mobile').value = '9876543210';
  document.getElementById('book-aadhaar').value = 'XXXX-XXXX-8921';
  document.getElementById('book-village').value = 'तरावड़ी, करनाल (Taraori, Karnal)';
  document.getElementById('book-qty').value = '75.0';
  document.getElementById('book-vehicle-type').value = 'Tractor-Trolley';
  document.getElementById('book-vehicle-no').value = 'HR-05-AA-4589';
  document.getElementById('book-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('book-time').value = '10:00 AM - 12:00 PM';
  updateEstimatedPayment();
  showToast('डेमो किसान विवरण भर दिया गया है।', 'info');
}

window.initFarmerModule = initFarmerModule;
window.renderLiveTokenCard = renderLiveTokenCard;
window.refreshFarmerDashboard = () => {
  loadLiveTokenData(AppState.activeTokenId);
  loadPaymentStatusTable();
};
window.openTokenPassModal = openTokenPassModal;
window.triggerGeoCheckin = triggerGeoCheckin;
window.speakCurrentTokenAnnouncement = speakCurrentTokenAnnouncement;
window.autofillDemoBooking = autofillDemoBooking;
window.openModal = openModal;
window.closeModal = closeModal;

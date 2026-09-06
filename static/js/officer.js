/**
 * अपनी BAARI (Apni Baari) - Mandi Officer Dashboard
 * Queue Management, Calling Next Token, Weighbridge Entry, Quality Check & J-Form Issuance
 */

let selectedOfficerToken = null;

function loadMandiOfficerQueue() {
  const mandiId = AppState.selectedMandiId || 'MANDI-KRN';
  
  // Update Mandi selector if present
  const selectEl = document.getElementById('officer-mandi-select');
  if (selectEl && selectEl.options.length === 0) {
    fetch('/api/mandis')
      .then(r => r.json())
      .then(mandis => {
        selectEl.innerHTML = mandis.map(m => `
          <option value="${m.id}" ${m.id === mandiId ? 'selected' : ''}>
            ${m.name_hi} (${m.name_en})
          </option>
        `).join('');
        fetchOfficerQueueData(mandiId);
      });
  } else {
    fetchOfficerQueueData(mandiId);
  }
}

function fetchOfficerQueueData(mandiId) {
  fetch(`/api/tokens?mandi_id=${mandiId}`)
    .then(r => r.json())
    .then(tokens => {
      renderOfficerTable(tokens);
      updateOfficerMetrics(tokens);
    });

  fetch(`/api/weather/${mandiId}`)
    .then(r => r.json())
    .then(w => {
      renderOfficerWeatherBox(w);
    });
}

function renderOfficerTable(tokens) {
  const tbody = document.getElementById('officer-queue-tbody');
  if (!tbody) return;

  const isHi = AppState.lang === 'hi';

  if (tokens.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:#888;">इस मंडी में वर्तमान में कोई टोकन नहीं है।</td></tr>`;
    return;
  }

  tbody.innerHTML = tokens.map(t => {
    let actionButtons = '';

    if (t.status === 'ARRIVED') {
      actionButtons = `
        <button class="btn-gov btn-gov-blue" style="padding:4px 10px; font-size:0.8rem;" onclick="openWeighbridgeModal('${t.id}')">
          ⚖️ सकल तौल (Gross)
        </button>
      `;
    } else if (t.status === 'WEIGHBRIDGE_GROSS') {
      actionButtons = `
        <button class="btn-gov btn-gov-saffron" style="padding:4px 10px; font-size:0.8rem;" onclick="openQualityCheckModal('${t.id}')">
          🔬 गुणवत्ता परख (Quality)
        </button>
      `;
    } else if (t.status === 'QUALITY_CHECK') {
      actionButtons = `
        <button class="btn-gov btn-gov-blue" style="padding:4px 10px; font-size:0.8rem;" onclick="advanceToUnloading('${t.id}')">
          🚛 उतराई शेड भेजें
        </button>
      `;
    } else if (t.status === 'UNLOADING') {
      actionButtons = `
        <button class="btn-gov btn-gov-green" style="padding:4px 10px; font-size:0.8rem;" onclick="openTareWeightModal('${t.id}')">
          🏁 खाली तौल (Tare) व जे-फॉर्म
        </button>
      `;
    } else if (t.status === 'COMPLETED') {
      actionButtons = `
        <button class="btn-gov btn-gov-outline" style="border-color:#1b5e20; color:#1b5e20; padding:4px 10px; font-size:0.8rem;" onclick="openJFormModal('${t.id}')">
          📜 जे-फॉर्म देखें (J-Form)
        </button>
      `;
    } else {
      actionButtons = `
        <button class="btn-gov btn-gov-outline" style="border-color:#666; color:#666; padding:4px 10px; font-size:0.8rem;" onclick="triggerGeoCheckin('${t.id}')">
          गेट इन करें
        </button>
      `;
    }

    const statusBadge = `<span class="status-pill status-${t.status.toLowerCase()}">${t.status}</span>`;

    return `
      <tr>
        <td><strong>${t.id}</strong></td>
        <td>
          <div style="font-weight:700;">${t.farmer_name}</div>
          <div style="font-size:0.75rem; color:#666;">${t.farmer_mobile}</div>
        </td>
        <td>${t.crop_name_hi} <span style="color:#1b5e20; font-weight:700;">(${t.quantity_quintals} Qtl)</span></td>
        <td>🚜 ${t.vehicle_number} <br><small style="color:#888;">${t.vehicle_type}</small></td>
        <td><span style="font-weight:600; color:#0b4582;">${t.shed_assigned}</span></td>
        <td>${statusBadge}</td>
        <td>${t.slot_time}</td>
        <td>${actionButtons}</td>
      </tr>
    `;
  }).join('');
}

function updateOfficerMetrics(tokens) {
  const waiting = tokens.filter(t => ['BOOKED', 'ARRIVED'].includes(t.status)).length;
  const activeProcess = tokens.filter(t => ['WEIGHBRIDGE_GROSS', 'QUALITY_CHECK', 'UNLOADING'].includes(t.status)).length;
  const done = tokens.filter(t => t.status === 'COMPLETED').length;

  const wEl = document.getElementById('officer-waiting-count');
  const aEl = document.getElementById('officer-active-count');
  const dEl = document.getElementById('officer-done-count');

  if (wEl) wEl.textContent = waiting;
  if (aEl) aEl.textContent = activeProcess;
  if (dEl) dEl.textContent = done;
}

function renderOfficerWeatherBox(w) {
  const box = document.getElementById('officer-weather-card');
  if (!box) return;

  const isRain = w.advisory_severity === 'HIGH';
  box.className = `weather-advisory-box ${isRain ? 'rain-alert' : ''}`;
  box.innerHTML = `
    <div class="weather-info-left">
      <span class="weather-icon-large">${isRain ? '🌧️' : '☀️'}</span>
      <div>
        <div style="font-weight:700; color:var(--gov-blue-dark); font-size:0.95rem;">
          ${w.mandi_name}: ${w.condition} (${w.temp_c}°C) | वर्षा संभावना: ${w.rain_probability}%
        </div>
        <div style="font-size:0.85rem; color:#444; margin-top:2px;">
          ${AppState.lang === 'hi' ? w.advisory_hi : w.advisory_en}
        </div>
      </div>
    </div>
    <div>
      <span style="background:#fff; border:1px solid #ccc; padding:4px 10px; border-radius:4px; font-size:0.8rem; font-weight:700;">
        कवर्ड शेड उपलब्ध: ${w.covered_sheds_available}
      </span>
    </div>
  `;
}

// "Call Next Farmer" Trigger
function officerCallNextToken() {
  const mandiId = AppState.selectedMandiId || 'MANDI-KRN';

  fetch('/api/officer/call-next', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mandi_id: mandiId })
  })
  .then(r => r.json())
  .then(res => {
    if (res.success) {
      showToast(res.message, 'success');
      speakAnnouncement(
        `टोकन संख्या ${res.token_id}, किसान ${res.farmer_name}, वाहन ${res.vehicle_number}। कृपया तुरंत धर्मकांटा 1 पर पहुंचे।`,
        `Token number ${res.token_id}, farmer ${res.farmer_name}. Please proceed to Weighbridge 1 immediately.`
      );
      loadMandiOfficerQueue();
      AppState.activeTokenId = res.token_id;
      if (window.renderLiveTokenCard) window.renderLiveTokenCard();
    } else {
      showToast(res.message, 'warning');
    }
  });
}

// Open Weighbridge Gross Weight Modal
function openWeighbridgeModal(tokenId) {
  selectedOfficerToken = tokenId;
  fetch(`/api/tokens/${tokenId}`)
    .then(r => r.json())
    .then(t => {
      document.getElementById('wb-token-id').textContent = t.id;
      document.getElementById('wb-farmer-name').textContent = t.farmer_name;
      document.getElementById('wb-vehicle-no').textContent = t.vehicle_number;
      // Provide a realistic pre-filled gross weight (Tractor ~3000kg + 65 Qtl = ~9500kg)
      const estGross = Math.round(3200 + (t.quantity_quintals * 100));
      document.getElementById('wb-gross-weight').value = estGross;
      openModal('weighbridge-gross-modal');
    });
}

function submitGrossWeight() {
  const gross = parseFloat(document.getElementById('wb-gross-weight').value);
  if (!gross || gross <= 0) {
    showToast('कृपया मान्य सकल वजन दर्ज करें।', 'warning');
    return;
  }

  fetch('/api/officer/update-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token_id: selectedOfficerToken,
      status: 'WEIGHBRIDGE_GROSS',
      stage_index: 3,
      gross_weight_kg: gross
    })
  })
  .then(r => r.json())
  .then(res => {
    closeModal('weighbridge-gross-modal');
    showToast(`सकल वजन (${gross} किग्रा) दर्ज हुआ! टोकन गुणवत्ता जांच हेतु आगे बढ़ा।`, 'success');
    loadMandiOfficerQueue();
  });
}

// Open Quality Inspection Modal
function openQualityCheckModal(tokenId) {
  selectedOfficerToken = tokenId;
  fetch(`/api/tokens/${tokenId}`)
    .then(r => r.json())
    .then(t => {
      document.getElementById('qc-token-id').textContent = t.id;
      document.getElementById('qc-crop-name').textContent = t.crop_name_hi;
      document.getElementById('qc-moisture').value = (11.2 + (Math.random() * 1.2)).toFixed(1);
      document.getElementById('qc-grade').value = 'FAQ Grade A';
      openModal('quality-check-modal');
    });
}

function submitQualityCheck() {
  const moisture = parseFloat(document.getElementById('qc-moisture').value);
  const grade = document.getElementById('qc-grade').value;

  fetch('/api/officer/update-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token_id: selectedOfficerToken,
      status: 'QUALITY_CHECK',
      stage_index: 4,
      moisture_pct: moisture,
      quality_grade: grade
    })
  })
  .then(r => r.json())
  .then(res => {
    closeModal('quality-check-modal');
    showToast(`गुणवत्ता जांच सफल! नमी: ${moisture}%, ग्रेड: ${grade}`, 'success');
    loadMandiOfficerQueue();
  });
}

function advanceToUnloading(tokenId) {
  fetch('/api/officer/update-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token_id: tokenId,
      status: 'UNLOADING',
      stage_index: 5
    })
  })
  .then(r => r.json())
  .then(res => {
    showToast('वाहन को उतराई शेड आवंटित कर दिया गया है।', 'info');
    loadMandiOfficerQueue();
  });
}

// Open Tare Weight Modal & Complete J-Form
function openTareWeightModal(tokenId) {
  selectedOfficerToken = tokenId;
  fetch(`/api/tokens/${tokenId}`)
    .then(r => r.json())
    .then(t => {
      document.getElementById('tare-token-id').textContent = t.id;
      document.getElementById('tare-gross-val').textContent = `${t.gross_weight_kg || 9500} किग्रा`;
      
      const tareEst = 3200; // Empty tractor weight
      document.getElementById('tare-weight-input').value = tareEst;
      calculateNetGrain(t.gross_weight_kg || 9500, tareEst, t.msp_per_quintal || 2425);
      openModal('tare-weight-modal');
    });
}

function calculateNetGrain(gross, tare, msp) {
  const net = Math.max(0, gross - tare);
  const qtl = (net / 100).toFixed(2);
  const total = (qtl * msp).toFixed(2);

  const displayEl = document.getElementById('tare-calc-display');
  if (displayEl) {
    displayEl.innerHTML = `
      <div style="background:#e8f5e9; border:1px solid #c8e6c9; padding:10px; border-radius:6px; margin-top:10px;">
        <div><strong>शुद्ध फसल वजन (Net Grain):</strong> ${net} किग्रा (${qtl} क्विंटल)</div>
        <div style="color:#1b5e20; font-size:1.2rem; font-weight:800; margin-top:4px;">कुल किसान भुगतान: ₹${parseFloat(total).toLocaleString('en-IN')}</div>
      </div>
    `;
  }
}

function submitTareWeightAndComplete() {
  const tare = parseFloat(document.getElementById('tare-weight-input').value);
  if (!tare || tare <= 0) {
    showToast('कृपया मान्य खाली वजन (Tare weight) दर्ज करें।', 'warning');
    return;
  }

  fetch('/api/officer/update-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token_id: selectedOfficerToken,
      status: 'COMPLETED',
      stage_index: 6,
      tare_weight_kg: tare
    })
  })
  .then(r => r.json())
  .then(res => {
    closeModal('tare-weight-modal');
    showToast(`उपार्जन पूर्ण! जे-फॉर्म जारी हुआ। डीबीटी यूटीआर: ${res.dbt_utr}`, 'success');
    loadMandiOfficerQueue();
    openJFormModal(selectedOfficerToken);
  });
}

// Open Digital J-Form Print Preview
function openJFormModal(tokenId) {
  fetch(`/api/tokens/${tokenId}`)
    .then(r => r.json())
    .then(t => {
      const container = document.getElementById('jform-container');
      if (!container) return;

      const qtl = (t.net_weight_kg / 100).toFixed(2);
      const grossAmt = t.payment_amount;
      const mandiFee = grossAmt * 0.02;
      const rdf = grossAmt * 0.02;

      container.innerHTML = `
        <div class="jform-preview">
          <div class="jform-title">
            <h3 style="margin:0; text-transform:uppercase;">हरियाणा राज्य कृषि विपणन बोर्ड / Mandi Samiti</h3>
            <div style="font-weight:bold; font-size:1.1rem; margin:4px 0;">प्रपत्र 'जे' (FORM 'J') - विक्रय पर्ची</div>
            <div style="font-size:0.8rem;">[नियम 24(1) और 24(4) देखिए - The Punjab Agricultural Produce Markets Act, 1961]</div>
          </div>

          <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:0.85rem;">
            <div>
              <strong>जे-फॉर्म क्रमांक:</strong> J-${t.id.replace('AB-', '')}<br>
              <strong>ई-उपार्जन टोकन:</strong> ${t.id}<br>
              <strong>मंडी प्रांगण:</strong> ${t.mandi_name_hi} (${t.mandi_name_en})
            </div>
            <div style="text-align:right;">
              <strong>दिनांक:</strong> ${t.slot_date}<br>
              <strong>समय:</strong> ${new Date().toLocaleTimeString()}<br>
              <strong>भुगतान माध्यम:</strong> PFMS-DBT (Direct Bank Transfer)
            </div>
          </div>

          <hr style="border:0; border-top:1px solid #000; margin:8px 0;">

          <table style="width:100%; border-collapse:collapse; font-size:0.88rem; margin:10px 0;">
            <tr style="border-bottom:1px solid #000;">
              <th style="text-align:left; padding:4px;">विवरण (Description)</th>
              <th style="text-align:right; padding:4px;">माप / दर (Rate)</th>
              <th style="text-align:right; padding:4px;">राशि (₹ Amount)</th>
            </tr>
            <tr>
              <td style="padding:4px;"><strong>किसान का नाम:</strong> ${t.farmer_name} (आधार: ${t.farmer_aadhaar_masked})</td>
              <td style="text-align:right; padding:4px;">फसल: ${t.crop_name_hi}</td>
              <td style="text-align:right; padding:4px;">—</td>
            </tr>
            <tr>
              <td style="padding:4px;">सकल वजन (Gross Weight)</td>
              <td style="text-align:right; padding:4px;">${t.gross_weight_kg} किग्रा</td>
              <td style="text-align:right; padding:4px;">—</td>
            </tr>
            <tr>
              <td style="padding:4px;">खाली वाहन वजन (Tare Weight)</td>
              <td style="text-align:right; padding:4px;">${t.tare_weight_kg} किग्रा</td>
              <td style="text-align:right; padding:4px;">—</td>
            </tr>
            <tr style="font-weight:bold; background:#f0f0f0;">
              <td style="padding:4px;">शुद्ध उपार्जित फसल (Net Weight)</td>
              <td style="text-align:right; padding:4px;">${t.net_weight_kg} किग्रा (${qtl} क्विंटल)</td>
              <td style="text-align:right; padding:4px;">—</td>
            </tr>
            <tr>
              <td style="padding:4px;">सरकारी न्यूनतम समर्थन मूल्य (MSP)</td>
              <td style="text-align:right; padding:4px;">₹${t.msp_per_quintal} / क्विंटल</td>
              <td style="text-align:right; padding:4px;">₹${grossAmt.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
            </tr>
            <tr>
              <td style="padding:4px;">गुणवत्ता ग्रेड (Grade) व नमी (Moisture)</td>
              <td style="text-align:right; padding:4px;">${t.quality_grade} (${t.moisture_pct}%)</td>
              <td style="text-align:right; padding:4px;">स्वीकृत (FAQ Approved)</td>
            </tr>
            <tr style="border-top:2px solid #000; border-bottom:2px solid #000; font-weight:bold; font-size:1rem;">
              <td style="padding:6px;">कुल देय किसान भुगतान (Net Farmer Credit)</td>
              <td style="text-align:right; padding:6px;">DBT स्थिति: जारी</td>
              <td style="text-align:right; padding:6px;">₹${grossAmt.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
            </tr>
          </table>

          <div style="font-size:0.8rem; background:#f9f9f9; padding:8px; border:1px dashed #666; margin-top:10px;">
            <strong>डीबीटी ट्रांजेक्शन संदर्भ (PFMS UTR):</strong> ${t.dbt_utr || 'DBT-PFMS-98231045'}<br>
            <em>यह राशि सीधे किसान के आधार से जुड़े बैंक खाते में 24-48 घंटों में जमा हो जाएगी। किसी भी दलाल को कोई कमीशन देय नहीं है।</em>
          </div>

          <div style="display:flex; justify-content:space-between; margin-top:28px; font-size:0.82rem;">
            <div>
              ____________________<br>
              हस्ताक्षर किसान (Farmer Signature)
            </div>
            <div style="text-align:center;">
              [डिजिटल हस्ताक्षरित]<br>
              <strong>ई-उपार्जन मंडी सचिव</strong>
            </div>
            <div style="text-align:right;">
              ____________________<br>
              तौल प्रभारी (Weighbridge In-charge)
            </div>
          </div>
        </div>
      `;
      openModal('jform-modal');
    });
}

window.loadMandiOfficerQueue = loadMandiOfficerQueue;
window.officerCallNextToken = officerCallNextToken;
window.openWeighbridgeModal = openWeighbridgeModal;
window.submitGrossWeight = submitGrossWeight;
window.openQualityCheckModal = openQualityCheckModal;
window.submitQualityCheck = submitQualityCheck;
window.advanceToUnloading = advanceToUnloading;
window.openTareWeightModal = openTareWeightModal;
window.submitTareWeightAndComplete = submitTareWeightAndComplete;
window.openJFormModal = openJFormModal;

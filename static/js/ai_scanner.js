/**
 * अपनी BAARI (Apni Baari) - AI Grain Quality Scanner (Computer Vision Simulation)
 * Interactive Canvas Scanning, Moisture & Impurity Analysis, FAQ Certification
 */

let canvas, ctx;
let isScanning = false;
let currentCropType = 'WHEAT';

function initAIScanner() {
  canvas = document.getElementById('ai-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  
  drawSampleGrains(currentCropType);
}

function selectAISample(type) {
  currentCropType = type;
  drawSampleGrains(type);
  document.querySelectorAll('.ai-sample-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.crop === type);
  });
}

function drawSampleGrains(crop) {
  if (!ctx || !canvas) return;
  
  canvas.width = canvas.parentElement.clientWidth || 500;
  canvas.height = 340;

  // Background grain inspection tray (dark contrast blue/slate)
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Draw simulated realistic grain kernels
  const count = crop === 'MUSTARD' ? 120 : 65;
  const grainColor = crop === 'WHEAT' ? '#f59e0b' : (crop === 'MUSTARD' ? '#451a03' : '#fef08a');
  
  for (let i = 0; i < count; i++) {
    const x = 50 + (i * 29) % (canvas.width - 100) + (Math.sin(i) * 15);
    const y = 40 + (i * 19) % (canvas.height - 80) + (Math.cos(i) * 12);
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((i * 45 * Math.PI) / 180);

    ctx.fillStyle = (i === 12 || i === 28) ? '#78350f' : grainColor; // simulated broken/chaff grains
    ctx.beginPath();
    if (crop === 'MUSTARD') {
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
    } else {
      ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2);
    }
    ctx.fill();

    // Center crease line on wheat/paddy
    if (crop !== 'MUSTARD') {
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.lineTo(7, 0);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function startAIScan() {
  if (isScanning) return;
  isScanning = true;

  const laser = document.getElementById('scanner-laser');
  if (laser) laser.classList.add('scanning');

  playScanBeep();
  showToast('एआई कंप्यूटर विजन द्वारा दानों की जांच जारी...', 'info');

  const btn = document.getElementById('ai-scan-btn');
  if (btn) btn.disabled = true;

  fetch('/api/ai/scan-grain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ crop_id: currentCropType })
  })
  .then(r => r.json())
  .then(res => {
    setTimeout(() => {
      renderScanResults(res);
      isScanning = false;
      if (laser) laser.classList.remove('scanning');
      if (btn) btn.disabled = false;
    }, 2200);
  })
  .catch(err => {
    isScanning = false;
    if (laser) laser.classList.remove('scanning');
    if (btn) btn.disabled = false;
    showToast('स्कैन में त्रुटि: ' + err.message, 'warning');
  });
}

function renderScanResults(data) {
  // Draw bounding boxes on canvas
  if (ctx && data.detections) {
    data.detections.forEach(det => {
      const isSound = det.label.includes('Sound');
      ctx.strokeStyle = isSound ? '#22c55e' : (det.label.includes('Broken') ? '#eab308' : '#ef4444');
      ctx.lineWidth = 2;
      ctx.strokeRect(det.x, det.y, det.w, det.h);

      // Label background
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillRect(det.x, det.y - 18, det.w + 40, 16);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(`${det.label.split(' ')[0]} ${(det.conf * 100).toFixed(0)}%`, det.x + 3, det.y - 6);
    });
  }

  // Update statistics
  const isHi = AppState.lang === 'hi';
  const resContainer = document.getElementById('ai-results-container');
  if (resContainer) {
    resContainer.style.display = 'block';
    resContainer.innerHTML = `
      <div style="background:#ffffff; border:2px solid ${data.status === 'APPROVED' ? '#22c55e' : '#f59e0b'}; border-radius:8px; padding:18px; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:10px; margin-bottom:14px;">
          <div>
            <span style="font-size:0.8rem; color:#64748b; font-weight:700;">AI QUALITY CERTIFICATE</span>
            <h4 style="margin:0; color:var(--gov-blue-dark); font-size:1.2rem;">${data.quality_grade}</h4>
          </div>
          <div style="text-align:right;">
            <span class="status-pill ${data.status === 'APPROVED' ? 'status-completed' : 'status-arrived'}" style="font-size:0.85rem;">
              ${data.status === 'APPROVED' ? '✅ FAQ मानक उत्तीर्ण (Passed)' : '⚠️ सुधार आवश्यक'}
            </span>
          </div>
        </div>

        <div class="scanner-grid-box">
          <div class="ai-stat-card">
            <div class="val" style="color:${data.moisture_pct <= data.max_allowed_moisture ? '#15803d' : '#b91c1c'};">${data.moisture_pct}%</div>
            <div class="lbl">नमी मात्रा (Max: ${data.max_allowed_moisture}%)</div>
          </div>

          <div class="ai-stat-card">
            <div class="val" style="color:#1e40af;">${data.foreign_matter_pct}%</div>
            <div class="lbl">भूसी / बाहरी तत्व (Max: 1.0%)</div>
          </div>

          <div class="ai-stat-card">
            <div class="val" style="color:#b45309;">${data.broken_grains_pct}%</div>
            <div class="lbl">खंडित दाने (Max: 3.0%)</div>
          </div>

          <div class="ai-stat-card">
            <div class="val" style="color:#047857;">+₹${data.msp_incentive_per_qtl}</div>
            <div class="lbl">गुणवत्ता प्रोत्साहन (Bonus/Qtl)</div>
          </div>
        </div>

        <div style="background:#f8fafc; border-left:4px solid #22c55e; padding:10px 14px; border-radius:4px; margin-top:14px; font-size:0.85rem;">
          <strong>सलाह / Recommendation:</strong> ${isHi ? data.recommendation_hi : data.recommendation_en}
        </div>

        <div style="margin-top:14px; display:flex; justify-content:flex-end; gap:10px;">
          <button class="btn-gov btn-gov-blue" style="padding:6px 14px; font-size:0.85rem;" onclick="applyAIToMandiOfficer(${data.moisture_pct}, '${data.quality_grade}')">
            📋 मंडी अधिकारी फॉर्म में दर्ज करें (Apply to Officer Inspection)
          </button>
        </div>
      </div>
    `;
  }

  showToast('गुणवत्ता रिपोर्ट तैयार: ' + data.quality_grade, 'success');
}

function applyAIToMandiOfficer(moisture, grade) {
  const qcMoist = document.getElementById('qc-moisture');
  const qcGrade = document.getElementById('qc-grade');
  if (qcMoist) qcMoist.value = moisture;
  if (qcGrade) qcGrade.value = grade.includes('Grade A') ? 'FAQ Grade A' : 'FAQ Grade B';

  switchTab('officer');
  showToast('एआई गुणवत्ता परिणाम मंडी अधिकारी फॉर्म में स्थानांतरित कर दिए गए!', 'success');
}

// Audio tone generator for scanning effect
function playScanBeep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1400, audioCtx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } catch (e) {
    // Ignore audio context errors
  }
}

// Handle file upload
function handleGrainImageUpload(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        if (ctx && canvas) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          showToast('कस्टम फसल छवि लोड हो गई। अब स्कैन शुरू करें।', 'info');
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
  }
}

window.initAIScanner = initAIScanner;
window.startAIScan = startAIScan;
window.selectAISample = selectAISample;
window.applyAIToMandiOfficer = applyAIToMandiOfficer;
window.handleGrainImageUpload = handleGrainImageUpload;

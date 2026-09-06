/**
 * अपनी BAARI (Apni Baari) - Interactive WhatsApp & Voice IVR Bot Simulator
 */

function toggleWhatsAppDrawer() {
  const win = document.getElementById('whatsapp-window');
  if (!win) return;
  win.classList.toggle('open');

  const badge = document.getElementById('wa-unread-badge');
  if (badge) badge.style.display = 'none';

  // Scroll to bottom
  const container = document.getElementById('wa-messages');
  if (container) container.scrollTop = container.scrollHeight;
}

function sendWhatsAppMessage(text) {
  const input = document.getElementById('wa-user-input');
  const msgText = text || (input ? input.value.trim() : '');
  if (!msgText) return;

  if (input) input.value = '';

  const container = document.getElementById('wa-messages');
  if (!container) return;

  const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Append user message
  const userDiv = document.createElement('div');
  userDiv.className = 'wa-msg user';
  userDiv.innerHTML = `
    <div>${msgText}</div>
    <div class="wa-time">${nowTime} ✓✓</div>
  `;
  container.appendChild(userDiv);
  container.scrollTop = container.scrollHeight;

  // Show typing indicator
  const typingDiv = document.createElement('div');
  typingDiv.className = 'wa-msg bot';
  typingDiv.id = 'wa-typing';
  typingDiv.style.fontStyle = 'italic';
  typingDiv.style.color = '#777';
  typingDiv.textContent = 'टाइप कर रहे हैं... (typing...)';
  container.appendChild(typingDiv);
  container.scrollTop = container.scrollHeight;

  fetch('/api/whatsapp/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from_mobile: '9876543210',
      message_text: msgText
    })
  })
  .then(r => r.json())
  .then(res => {
    setTimeout(() => {
      const typing = document.getElementById('wa-typing');
      if (typing) typing.remove();

      // Convert *bold* to <strong> and newlines to <br>
      let formatted = res.reply
        .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
        .replace(/_(.*?)_/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');

      const botDiv = document.createElement('div');
      botDiv.className = 'wa-msg bot';
      botDiv.innerHTML = `
        <div>${formatted}</div>
        <div class="wa-time">${res.timestamp || nowTime}</div>
      `;
      container.appendChild(botDiv);
      container.scrollTop = container.scrollHeight;
    }, 600);
  });
}

// Voice IVR phone call simulation
function triggerIVRCall() {
  openModal('ivr-call-modal');
  playPhoneRing();

  setTimeout(() => {
    const statusEl = document.getElementById('ivr-call-status');
    if (statusEl) statusEl.textContent = 'कॉल कनेक्टेड (00:01)... बोल रहे हैं:';

    const ivrSpeech = 'नमस्ते! अपनी बारी किसान कॉल सेंटर में आपका स्वागत है। आपका टोकन नंबर ए-बी-2026-0101 कतार में पहले स्थान पर है। कृपया धर्मकांटा 1 पर पहुंचे। मुख्य मेनू के लिए 1 दबाएं।';
    speakAnnouncement(ivrSpeech, 'Welcome to Apni Baari Farmer Helpline. Your token is first in queue. Please proceed to weighbridge 1.');
  }, 2200);
}

function playPhoneRing() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 1.2);
  } catch (e) {
    // Ignore
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('wa-user-input');
  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendWhatsAppMessage();
    });
  }
});

window.toggleWhatsAppDrawer = toggleWhatsAppDrawer;
window.sendWhatsAppMessage = sendWhatsAppMessage;
window.triggerIVRCall = triggerIVRCall;

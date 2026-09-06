# अपनी BAARI (Apni Baari)
### ई-उपार्जन कतार व टोकन प्रबंधन प्रणाली (Smart Grain Procurement Token & Queue Management System)
**Under the aegis of the Ministry of Agriculture & Farmers Welfare, Government of India**

---

## 📌 Problem Statement Addressed
> *"Farmers often face long waiting times, lack of information regarding procurement schedules, and uncertainty about procurement status."*

During harvesting seasons in Indian Agricultural Produce Market Committees (APMC / Mandis), millions of farmers transport their produce (Wheat, Paddy, Mustard, Gram) via tractor-trolleys and trucks. Traditional procurement suffers from:
1. **Unregulated Influx & Traffic Jams**: Thousands of vehicles arrive at once, forcing farmers to sleep in tractor queues outside Mandi gates for 24 to 72 hours.
2. **Spoilage Due to Unpredictable Weather**: Sudden rain or thunderstorms ruin open-air grain heaps while waiting in yard queues.
3. **Information Asymmetry & Agent Exploitation**: Farmers lack real-time visibility into weighbridge queues, quality deductions, or DBT payment transfers.

**"अपनी BAARI"** solves this through intelligent digital slot scheduling, live queue position tracking, dynamic waiting time estimation, weather-aware shed allocation, and instant DBT payments.

---

## 🏗️ Architecture & Features

### 1. MUST WORK — Core System
- **Farmer Quick Access & Token Booking**: 3-step digital slot booking specifying Mandi, Crop, Quantity, Vehicle Type (Tractor-trolley vs. Truck), and Time Slot.
- **Dynamic Digital Token Pass**: Unique ID (`AB-2026-XXXX`) with QR Code, vehicle registration, and printable gate pass.
- **Live 6-Stage Visual Stepper**:
  1. `स्लॉट आरक्षित` (Booked & On the Way)
  2. `मंडी आगमन` (Yard Arrived / Gate Check-in)
  3. `सकल तौल` (Weighbridge Gross Weight Entry)
  4. `गुणवत्ता परख` (Moisture & Grain Inspection)
  5. `उतराई शेड` (Grain Unloading at Assigned Bay)
  6. `अंतिम तौल व जे-फॉर्म` (Tare Weight, Net Calculation & DBT Payment)
- **Dynamic Estimated Waiting Time (EWT)**: Automatically computes countdown based on vehicles ahead, active weighbridges, and vehicle unloading capacity.
- **Mandi Officer Dashboard**: Complete procurement console with a single-click "अगला किसान बुलाएं (Call Next Token)" with audio chimes and automated SMS triggers.
- **Digital J-Form Generator**: Generates statutory Form 'J' sales receipt compliant with State Agricultural Produce Markets Act, calculating MSP payout and generating PFMS-DBT transaction UTR codes.

### 2. SMART FEATURES — Competitive Differentiators
- 🌧️ **Weather-Aware Scheduling**: Integrated with live weather forecast for each Mandi (Karnal, Khanna, Bhopal, Kota, Nizamabad). If rain probability exceeds 40%, the system automatically diverts incoming tractors to **Covered Sheds** and offers penalty-free slot rescheduling.
- 🚛 **Vehicle & Load Throughput Estimation**: Differentiates throughput by vehicle class (Tractor-trolley ~18 mins, Mini-Truck ~25 mins, Multi-axle ~40 mins) to dynamically calculate queue pacing.
- 📍 **Geo-Fenced Gate Arrival (Check-in)**: 2 km GPS geo-fence simulation allowing farmers to tap *"मैं मंडी के पास पहुंच गया हूँ (Gate Check-in)"* to enter the active yard queue.
- 📊 **Government Heatmap & Congestion Analytics**: Interactive Leaflet map displaying Mandis color-coded by congestion level (Green: <30m, Yellow: 30-60m, Red: >60m).
- 🔄 **Queue Congestion Alleviation**: Staggers gate passes based on weighbridge throughput to eliminate highway tractor jams.

### 3. WOW FEATURES — High-Tech Demonstrations
- 🤖 **AI Grain-Quality Computer Vision Scanner**:
  - Interactive camera / sample inspection canvas.
  - Animated green laser scanning effect with audio synthesis.
  - Overlays bounding boxes on grain kernels identifying sound grains, broken grains, and foreign matter/chaff.
  - Delivers instant readout: Moisture % (e.g. 11.4%), Foreign Matter % (0.5%), Broken Grains % (1.2%), and certifies **FAQ Grade A** with 1-click transfer to Mandi Officer Inspection forms.
- 📱 **Interactive WhatsApp Bot & IVR Voice Assistant**:
  - Docked floating WhatsApp chat drawer simulating real-time bot responses for token status, slot booking, today's MSP, and weather alerts.
  - Toll-free IVR Voice Helpline simulation with realistic phone dialing and bilingual Hindi/English voice announcements via the Web Speech API.
- 📴 **Offline-First Synchronization**:
  - Simulates network disconnection in rural areas. Farmers can generate emergency offline tokens saved locally in the browser, which automatically sync to the server when reconnected.

### 4. FUTURE SCOPE & GOVERNMENT INTEGRATIONS
- **Live MSP Ticker**: Notified MSP for Rabi & Kharif crops 2025-26 (Wheat ₹2,425, Paddy ₹2,320, Mustard ₹5,950, Gram ₹5,650, etc.).
- **Direct Benefit Transfer (DBT) / PFMS Integration**: End-to-end payment status tracking showing bank credit status and transaction UTR numbers.

---

## 🎨 User Interface & Accessibility
Inspired by **`uidai.gov.in/hi`** and Indian National Web Guidelines:
- Tricolor bar (Saffron, White, Green) at the top.
- Accessibility controls: Font scaling (**A-**, **A**, **A+**), High Contrast Dark Mode toggle, and Screen Reader support.
- Bilingual Support: Instant 1-click toggle between **हिन्दी (Hindi)** and **English**.
- Official branding with the **अपनी BAARI** logo and Lion Capital Ashoka Emblem.

---

## 🚀 How to Run the Prototype

### Prerequisites
- Python 3.10+ (Python 3.13 / 3.14 recommended)
- Dependencies: `fastapi`, `uvicorn`, `pydantic` (already installed)

### 1-Click Launch (Windows)
Double-click:
```bat
run.bat
```

Or from PowerShell / Command Prompt:
```powershell
py -3 -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

Then open your browser at:
👉 **`http://127.0.0.1:8000`**


---------

# Future Scope
- Weather update using API
- Live Map Location
- MSP Price tracking
- Payment Status Tracking

# MUST WORK — core system
- Farmer login
- Slot/token booking
- Live queue
- Estimated waiting time
- Procurement-center dashboard
- Farmer status tracking
- Notifications/status updates

# SMART FEATURES — make the project stand out
- 🌧️ Weather-aware scheduling
- 🚛 Vehicle/load estimation
- 📍 Geo-fenced arrival/check-in
- 📊 Government heatmap + analytics
- 🔄 Dynamic queue prediction

# WOW FEATURES — demonstrate rather than fully build

- 🤖 AI grain-quality detection
- 📱 WhatsApp/SMS/voice interface
- 📴 Offline-first synchronization

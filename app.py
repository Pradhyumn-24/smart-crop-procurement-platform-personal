import os
import random
import sqlite3
from datetime import datetime, date
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import database

app = FastAPI(title="अपनी BAARI - Smart Grain Procurement Portal", version="1.0.0")

# CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure database is initialized on startup
database.init_db()

# Pydantic Schemas
class TokenBookingRequest(BaseModel):
    mandi_id: str
    farmer_name: str
    farmer_mobile: str
    farmer_aadhaar: Optional[str] = "XXXX-XXXX-1234"
    farmer_village: str
    crop_id: str
    quantity_quintals: float
    vehicle_type: str
    vehicle_number: str
    slot_date: str
    slot_time: str

class TokenUpdateRequest(BaseModel):
    token_id: str
    status: str
    stage_index: int
    gross_weight_kg: Optional[float] = 0.0
    tare_weight_kg: Optional[float] = 0.0
    moisture_pct: Optional[float] = 0.0
    quality_grade: Optional[str] = "FAQ Grade A"
    notes: Optional[str] = ""

class OfflineTokenItem(BaseModel):
    offline_id: str
    mandi_id: str
    farmer_name: str
    farmer_mobile: str
    crop_id: str
    quantity_quintals: float
    vehicle_type: str
    vehicle_number: str
    timestamp: str

class WhatsAppMessageRequest(BaseModel):
    from_mobile: str
    message_text: str

# ----------------- HELPER FUNCTIONS -----------------
def calculate_ewt_and_queue(mandi_id: str, token_id: Optional[str] = None):
    """Calculates live queue count and estimated waiting time (in minutes)."""
    conn = database.get_db()
    cursor = conn.cursor()
    
    # Fetch mandi info
    cursor.execute("SELECT active_weighbridges, congestion_index FROM mandis WHERE id = ?", (mandi_id,))
    mandi = cursor.fetchone()
    active_weighbridges = mandi["active_weighbridges"] if mandi else 3
    congestion = mandi["congestion_index"] if mandi else 0.5
    
    # Get active tokens in queue ahead
    cursor.execute("""
        SELECT id, vehicle_type, quantity_quintals, stage_index 
        FROM tokens 
        WHERE mandi_id = ? AND status IN ('BOOKED', 'ARRIVED', 'WEIGHBRIDGE_GROSS', 'QUALITY_CHECK', 'UNLOADING')
        ORDER BY stage_index DESC, created_at ASC
    """, (mandi_id,))
    active_tokens = cursor.fetchall()
    
    total_in_queue = len(active_tokens)
    tokens_ahead = 0
    calculated_wait_mins = 0
    found_target = False

    for idx, row in enumerate(active_tokens):
        if token_id and row["id"] == token_id:
            tokens_ahead = idx
            found_target = True
            break
        # Dynamic vehicle unloading weight
        vtype = row["vehicle_type"]
        v_factor = 18 if "Tractor" in vtype else (25 if "Mini" in vtype else 40)
        calculated_wait_mins += v_factor
    
    if not token_id or not found_target:
        tokens_ahead = total_in_queue
        calculated_wait_mins = int((total_in_queue * 20) / max(1, active_weighbridges))
    else:
        calculated_wait_mins = int(calculated_wait_mins / max(1, active_weighbridges))

    conn.close()
    return {
        "total_in_queue": total_in_queue,
        "tokens_ahead": tokens_ahead,
        "estimated_wait_minutes": max(5, int(calculated_wait_mins * (0.8 + congestion * 0.4))),
        "active_weighbridges": active_weighbridges
    }

# ----------------- API ENDPOINTS -----------------

@app.get("/api/mandis")
def get_mandis():
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM mandis")
    mandis = [dict(row) for row in cursor.fetchall()]
    
    # Augment with live queue statistics
    for m in mandis:
        queue_info = calculate_ewt_and_queue(m["id"])
        m["live_queue_count"] = queue_info["total_in_queue"]
        m["live_ewt_mins"] = queue_info["estimated_wait_minutes"]
        
        # Currently serving token
        cursor.execute("""
            SELECT id, farmer_name, crop_id, vehicle_number 
            FROM tokens 
            WHERE mandi_id = ? AND status IN ('WEIGHBRIDGE_GROSS', 'QUALITY_CHECK', 'UNLOADING')
            ORDER BY stage_index DESC LIMIT 1
        """, (m["id"],))
        curr = cursor.fetchone()
        m["current_token"] = dict(curr) if curr else None

    conn.close()
    return mandis

@app.get("/api/crops")
def get_crops():
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM crops")
    crops = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return crops

@app.get("/api/tokens")
def get_tokens(mandi_id: Optional[str] = None, status: Optional[str] = None):
    conn = database.get_db()
    cursor = conn.cursor()
    query = """
        SELECT t.*, c.name_en as crop_name_en, c.name_hi as crop_name_hi, c.msp_per_quintal,
               m.name_en as mandi_name_en, m.name_hi as mandi_name_hi
        FROM tokens t
        JOIN crops c ON t.crop_id = c.id
        JOIN mandis m ON t.mandi_id = m.id
        WHERE 1=1
    """
    params = []
    if mandi_id:
        query += " AND t.mandi_id = ?"
        params.append(mandi_id)
    if status:
        query += " AND t.status = ?"
        params.append(status)
    query += " ORDER BY t.created_at DESC"
    
    cursor.execute(query, params)
    tokens = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return tokens

@app.get("/api/tokens/{token_id}")
def get_token_by_id(token_id: str):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.*, c.name_en as crop_name_en, c.name_hi as crop_name_hi, c.msp_per_quintal,
               m.name_en as mandi_name_en, m.name_hi as mandi_name_hi, m.weather_status, m.rain_probability
        FROM tokens t
        JOIN crops c ON t.crop_id = c.id
        JOIN mandis m ON t.mandi_id = m.id
        WHERE t.id = ?
    """, (token_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Token not found")
    
    token_data = dict(row)
    queue_calc = calculate_ewt_and_queue(token_data["mandi_id"], token_id)
    token_data["queue_position"] = queue_calc["tokens_ahead"] + 1
    token_data["tokens_ahead"] = queue_calc["tokens_ahead"]
    token_data["estimated_wait_minutes"] = queue_calc["estimated_wait_minutes"]
    return token_data

@app.get("/api/tokens/track/mobile/{mobile}")
def get_tokens_by_mobile(mobile: str):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.*, c.name_en as crop_name_en, c.name_hi as crop_name_hi, c.msp_per_quintal,
               m.name_en as mandi_name_en, m.name_hi as mandi_name_hi
        FROM tokens t
        JOIN crops c ON t.crop_id = c.id
        JOIN mandis m ON t.mandi_id = m.id
        WHERE t.farmer_mobile LIKE ?
        ORDER BY t.created_at DESC
    """, (f"%{mobile}%",))
    tokens = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    for tok in tokens:
        q = calculate_ewt_and_queue(tok["mandi_id"], tok["id"])
        tok["tokens_ahead"] = q["tokens_ahead"]
        tok["estimated_wait_minutes"] = q["estimated_wait_minutes"]
        
    return tokens

@app.post("/api/tokens/book")
def book_token(req: TokenBookingRequest):
    conn = database.get_db()
    cursor = conn.cursor()
    
    # Generate unique Token ID (e.g. AB-2026-XXXX)
    token_num = random.randint(1000, 9999)
    token_id = f"AB-2026-{token_num}"
    
    # Check mandi weather for smart shed allocation
    cursor.execute("SELECT weather_status, rain_probability, covered_sheds_available FROM mandis WHERE id = ?", (req.mandi_id,))
    mandi_info = cursor.fetchone()
    
    is_rainy = mandi_info and (mandi_info["rain_probability"] > 40 or "Rain" in mandi_info["weather_status"])
    shed_assigned = f"Covered Shed {random.randint(1, 3)} (Rain Protected)" if is_rainy else f"Open Yard Shed {random.choice(['A', 'B', 'C'])}"
    
    # Fetch MSP to calculate provisional value
    cursor.execute("SELECT msp_per_quintal FROM crops WHERE id = ?", (req.crop_id,))
    crop = cursor.fetchone()
    msp = crop["msp_per_quintal"] if crop else 2425.0
    est_payment = req.quantity_quintals * msp
    
    # Mask Aadhaar
    aadhaar_masked = req.farmer_aadhaar
    if aadhaar_masked and len(aadhaar_masked) >= 4 and "X" not in aadhaar_masked:
        aadhaar_masked = f"XXXX-XXXX-{aadhaar_masked[-4:]}"
    elif not aadhaar_masked:
        aadhaar_masked = "XXXX-XXXX-4589"

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    cursor.execute("""
        INSERT INTO tokens (
            id, mandi_id, farmer_name, farmer_mobile, farmer_aadhaar_masked, farmer_village,
            crop_id, quantity_quintals, vehicle_type, vehicle_number, slot_date, slot_time,
            status, stage_index, shed_assigned, queue_number, payment_amount, payment_status,
            geo_checked_in, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'BOOKED', 1, ?, ?, ?, 'PENDING', 0, ?, ?)
    """, (
        token_id, req.mandi_id, req.farmer_name, req.farmer_mobile, aadhaar_masked, req.farmer_village,
        req.crop_id, req.quantity_quintals, req.vehicle_type, req.vehicle_number, req.slot_date, req.slot_time,
        shed_assigned, random.randint(5, 25), est_payment, now_str, now_str
    ))

    # Add notification
    msg_en = f"Token {token_id} booked for {req.slot_date} ({req.slot_time}) at Mandi. Assigned: {shed_assigned}."
    msg_hi = f"टोकन {token_id} {req.slot_date} ({req.slot_time}) के लिए आरक्षित। आवंटित: {shed_assigned}।"
    
    if is_rainy:
        msg_en += " Weather Alert: Rain predicted, covered shed reserved."
        msg_hi += " मौसम चेतावनी: बारिश की संभावना, कवर्ड शेड सुरक्षित किया गया।"

    cursor.execute("""
        INSERT INTO notifications (token_id, farmer_mobile, type, message_en, message_hi, timestamp, read_status)
        VALUES (?, ?, 'SMS', ?, ?, ?, 0)
    """, (token_id, req.farmer_mobile, msg_en, msg_hi, now_str))

    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "token_id": token_id,
        "message": "Token booked successfully",
        "shed_assigned": shed_assigned,
        "weather_alert": is_rainy,
        "provisional_payment": est_payment
    }

@app.post("/api/tokens/{token_id}/geo-checkin")
def geo_checkin(token_id: str, lat: Optional[float] = None, lng: Optional[float] = None):
    conn = database.get_db()
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    time_only = datetime.now().strftime("%I:%M %p")
    
    cursor.execute("""
        UPDATE tokens 
        SET geo_checked_in = 1, status = 'ARRIVED', stage_index = 2, checkin_time = ?, updated_at = ?
        WHERE id = ?
    """, (time_only, now_str, token_id))
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Token not found")
        
    cursor.execute("""
        INSERT INTO notifications (token_id, farmer_mobile, type, message_en, message_hi, timestamp, read_status)
        SELECT id, farmer_mobile, 'SMS', 
               'Geo Check-in Verified! Welcome to Mandi. Please proceed to Holding Yard Gate 2.',
               'भू-सत्यापन सफल! मंडी में आपका स्वागत है। कृपया होल्डिंग यार्ड गेट 2 पर जाएं।',
               ?, 0
        FROM tokens WHERE id = ?
    """, (now_str, token_id))
    
    conn.commit()
    conn.close()
    return {"success": True, "message": "Geo check-in verified successfully. Status changed to ARRIVED."}

@app.post("/api/officer/call-next")
def officer_call_next(mandi_id: str = Body(..., embed=True)):
    conn = database.get_db()
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Priority: Find arrived tokens first, otherwise booked
    cursor.execute("""
        SELECT * FROM tokens 
        WHERE mandi_id = ? AND status IN ('ARRIVED', 'BOOKED')
        ORDER BY CASE WHEN status = 'ARRIVED' THEN 0 ELSE 1 END, created_at ASC
        LIMIT 1
    """, (mandi_id,))
    next_token = cursor.fetchone()
    
    if not next_token:
        conn.close()
        return {"success": False, "message": "No tokens waiting in queue for this Mandi."}
    
    tok_id = next_token["id"]
    cursor.execute("""
        UPDATE tokens 
        SET status = 'WEIGHBRIDGE_GROSS', stage_index = 3, updated_at = ?
        WHERE id = ?
    """, (now_str, tok_id))
    
    # Notification
    cursor.execute("""
        INSERT INTO notifications (token_id, farmer_mobile, type, message_en, message_hi, timestamp, read_status)
        VALUES (?, ?, 'SMS', 
                'CALL ALERT: Token ' || ? || ' called! Proceed to Weighbridge 1 immediately.',
                'बुलावा सूचना: टोकन ' || ? || ' को बुलाया गया है! कृपया तुरंत धर्मकांटा 1 पर पहुंचें।',
                ?, 0)
    """, (tok_id, next_token["farmer_mobile"], tok_id, tok_id, now_str))

    conn.commit()
    conn.close()
    
    return {
        "success": True, 
        "token_id": tok_id, 
        "farmer_name": next_token["farmer_name"],
        "vehicle_number": next_token["vehicle_number"],
        "crop_id": next_token["crop_id"],
        "message": f"Token {tok_id} has been called to Weighbridge."
    }

@app.post("/api/officer/update-token")
def officer_update_token(req: TokenUpdateRequest):
    conn = database.get_db()
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Retrieve current token and crop MSP
    cursor.execute("""
        SELECT t.*, c.msp_per_quintal 
        FROM tokens t 
        JOIN crops c ON t.crop_id = c.id 
        WHERE t.id = ?
    """, (req.token_id,))
    token = cursor.fetchone()
    
    if not token:
        conn.close()
        raise HTTPException(status_code=404, detail="Token not found")
        
    msp = token["msp_per_quintal"]
    gross = req.gross_weight_kg or token["gross_weight_kg"]
    tare = req.tare_weight_kg or token["tare_weight_kg"]
    net = max(0.0, gross - tare) if gross > 0 and tare > 0 else token["net_weight_kg"]
    payment = (net / 100.0) * msp if net > 0 else token["payment_amount"]
    
    payment_status = token["payment_status"]
    dbt_utr = token["dbt_utr"]
    
    if req.status == "COMPLETED":
        payment_status = "TRANSFERRED_TO_DBT"
        if not dbt_utr:
            dbt_utr = f"DBT-PFMS-{random.randint(10000000, 99999999)}"
            
    cursor.execute("""
        UPDATE tokens 
        SET status = ?, stage_index = ?, gross_weight_kg = ?, tare_weight_kg = ?, net_weight_kg = ?,
            moisture_pct = ?, quality_grade = ?, payment_amount = ?, payment_status = ?, dbt_utr = ?, updated_at = ?
        WHERE id = ?
    """, (
        req.status, req.stage_index, gross, tare, net,
        req.moisture_pct or token["moisture_pct"],
        req.quality_grade or token["quality_grade"],
        payment, payment_status, dbt_utr, now_str, req.token_id
    ))

    # Trigger notification based on status
    status_messages = {
        "WEIGHBRIDGE_GROSS": (f"Gross weight recorded: {gross} kg. Proceed to Quality Inspector.", f"सकल वजन दर्ज: {gross} किग्रा। गुणवत्ता जांच डेस्क पर जाएं।"),
        "QUALITY_CHECK": (f"Quality Verified! Moisture: {req.moisture_pct}%, Grade: {req.quality_grade}. Proceed to Shed.", f"गुणवत्ता प्रमाणित! नमी: {req.moisture_pct}%, ग्रेड: {req.quality_grade}। शेड पर जाएं।"),
        "UNLOADING": ("Grain unloading in progress at allotted bay.", "आवंटित शेड में फसल उतराई कार्य जारी है।"),
        "WEIGHBRIDGE_TARE": (f"Tare weight recorded: {tare} kg. Net Grain: {net} kg.", f"खाली वजन दर्ज: {tare} किग्रा। शुद्ध फसल वजन: {net} किग्रा।"),
        "COMPLETED": (f"Procurement Completed! J-Form issued. ₹{payment:,.2f} transferred via DBT. UTR: {dbt_utr}", f"उपार्जन पूर्ण! जे-फॉर्म जारी। ₹{payment:,.2f} डीबीटी द्वारा हस्तांतरित। UTR: {dbt_utr}")
    }

    if req.status in status_messages:
        en_m, hi_m = status_messages[req.status]
        cursor.execute("""
            INSERT INTO notifications (token_id, farmer_mobile, type, message_en, message_hi, timestamp, read_status)
            VALUES (?, ?, 'SMS', ?, ?, ?, 0)
        """, (req.token_id, token["farmer_mobile"], en_m, hi_m, now_str))

    conn.commit()
    conn.close()
    return {"success": True, "status": req.status, "net_weight_kg": net, "payment_amount": payment, "dbt_utr": dbt_utr}

@app.get("/api/weather/{mandi_id}")
def get_mandi_weather(mandi_id: str):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM mandis WHERE id = ?", (mandi_id,))
    mandi = cursor.fetchone()
    conn.close()
    
    if not mandi:
        raise HTTPException(status_code=404, detail="Mandi not found")
        
    m = dict(mandi)
    is_rain = m["rain_probability"] >= 50 or "Rain" in m["weather_status"]
    
    return {
        "mandi_id": mandi_id,
        "mandi_name": m["name_en"],
        "temp_c": m["weather_temp"],
        "condition": m["weather_status"],
        "rain_probability": m["rain_probability"],
        "covered_sheds_available": m["covered_sheds_available"],
        "advisory_severity": "HIGH" if is_rain else "NORMAL",
        "advisory_en": "⚠️ Heavy Rain Warning: 3 Covered Sheds pre-allocated. Free reschedule option active." if is_rain else "☀️ Optimal Weather: Open Yard Sheds operating at peak efficiency.",
        "advisory_hi": "⚠️ भारी बारिश की चेतावनी: 3 कवर्ड शेड आरक्षित। निःशुल्क स्लॉट री-शेड्यूल उपलब्ध।" if is_rain else "☀️ अनुकूल मौसम: खुले यार्ड शेड पूरी क्षमता से संचालित हैं।"
    }

@app.post("/api/ai/scan-grain")
def ai_scan_grain(data: dict = Body(...)):
    """Simulates instant Computer Vision Grain Quality & Moisture Inspection."""
    crop_id = data.get("crop_id", "WHEAT")
    
    # Realistic random variance
    moisture = round(random.uniform(10.2, 13.8), 1)
    foreign_matter = round(random.uniform(0.3, 1.4), 2)
    broken_grains = round(random.uniform(0.8, 2.5), 1)
    shriveled = round(random.uniform(0.5, 2.0), 1)
    weevilled = round(random.uniform(0.0, 0.4), 1)
    
    max_moisture = 12.0 if crop_id in ["WHEAT", "BARLEY"] else (17.0 if "PADDY" in crop_id else 9.0)
    is_faq = moisture <= max_moisture and foreign_matter <= 1.0 and broken_grains <= 3.0
    grade = "FAQ Grade A (उत्कृष्ट)" if is_faq else ("FAQ Grade B (स्वीकार्य)" if moisture <= max_moisture + 1.0 else "Sub-standard / High Moisture (सुखाने की आवश्यकता)")
    
    msp_bonus = 25.0 if is_faq else 0.0
    
    # Bounding boxes coordinates for canvas simulation
    sample_detections = [
        {"x": 120, "y": 80, "w": 45, "h": 28, "label": "Sound Grain (स्वस्थ दाना)", "conf": 0.98},
        {"x": 210, "y": 140, "w": 40, "h": 25, "label": "Sound Grain (स्वस्थ दाना)", "conf": 0.96},
        {"x": 310, "y": 95, "w": 32, "label": "Broken Grain (खंडित दाना)", "conf": 0.91},
        {"x": 175, "y": 210, "w": 50, "h": 30, "label": "Sound Grain (स्वस्थ दाना)", "conf": 0.99},
        {"x": 290, "y": 230, "w": 25, "h": 20, "label": "Foreign Matter / Chaff (भूसी/कचरा)", "conf": 0.89},
        {"x": 80, "y": 180, "w": 42, "h": 26, "label": "Sound Grain (स्वस्थ दाना)", "conf": 0.97}
    ]

    return {
        "crop_id": crop_id,
        "moisture_pct": moisture,
        "max_allowed_moisture": max_moisture,
        "foreign_matter_pct": foreign_matter,
        "broken_grains_pct": broken_grains,
        "shriveled_pct": shriveled,
        "weevilled_pct": weevilled,
        "quality_grade": grade,
        "status": "APPROVED" if "FAQ" in grade else "ACTION_REQUIRED",
        "msp_incentive_per_qtl": msp_bonus,
        "detections": sample_detections,
        "recommendation_en": "Grain meets Government Fair Average Quality (FAQ) parameters. Eligible for 100% MSP payout." if is_faq else "Slight moisture/foreign matter detected. Aeration recommended.",
        "recommendation_hi": "फसल सरकारी FAQ मानकों पर खरी उतरी है। 100% एमएसपी दर एवं त्वरित भुगतान हेतु स्वीकृत।" if is_faq else "अतिरिक्त नमी/भूसी दर्ज। थोड़ी धूप लगाने की सलाह दी जाती है।"
    }

@app.post("/api/whatsapp/message")
def whatsapp_bot_webhook(req: WhatsAppMessageRequest):
    """Interactive WhatsApp bot response engine."""
    text = req.message_text.strip().lower()
    
    if text in ["hi", "hello", "namaste", "नमस्ते", "start", "menu"]:
        reply = (
            "🙏 *नमस्ते! अपनी बारी (Apni Baari) किसान मित्र में आपका स्वागत है।*\n\n"
            "कृपया सेवा का चयन करने के लिए नंबर भेजें:\n"
            "1️⃣ *टोकन स्थिति (Check Token Status)*\n"
            "2️⃣ *नया स्लॉट बुक करें (Book Slot)*\n"
            "3️⃣ *आज के एमएसपी भाव (Today's MSP)*\n"
            "4️⃣ *मंडी मौसम अलर्ट (Weather Forecast)*\n"
            "5️⃣ *डीबीटी भुगतान स्थिति (Payment Status)*\n\n"
            "_जवाब देने के लिए केवल 1, 2, 3, 4 या 5 लिखें।_"
        )
    elif "1" in text or "token" in text or "status" in text or "बारी" in text:
        reply = (
            "🔍 *लाइव टोकन स्थिति:*\n"
            "• टोकन: *AB-2026-0101*\n"
            "• किसान: रामेश्वर दयाल\n"
            "• मंडी: करनाल नई अनाज मंडी\n"
            "• स्थिति: 🚜 *धर्मकांटा 1 पर वजन जारी*\n"
            "• आपसे आगे: *0 वाहन*\n"
            "• अनुमानित प्रतीक्षा: *0 मिनट*\n\n"
            "👉 _गेट पर उपस्थित रहें।_"
        )
    elif "2" in text or "book" in text or "स्लॉट" in text:
        reply = (
            "📅 *स्लॉट बुकिंग सहायता:*\n"
            "करनाल मंडी में आज के खाली स्लॉट:\n"
            "• 12:00 PM - 02:00 PM (18 स्लॉट उपलब्ध)\n"
            "• 02:00 PM - 04:00 PM (32 स्लॉट उपलब्ध)\n\n"
            "ऑनलाइन बुक करने के लिए पोर्टल पर 'स्लॉट बुक करें' पर क्लिक करें या अपना नाम, फसल, वजन यहां भेजें।"
        )
    elif "3" in text or "msp" in text or "भाव" in text:
        reply = (
            "🌾 *न्यूनतम समर्थन मूल्य (MSP) 2025-26:*\n"
            "• गेहूं (Wheat): *₹2,425 / क्विंटल*\n"
            "• धान सामान्य (Paddy): *₹2,320 / क्विंटल*\n"
            "• सरसों (Mustard): *₹5,950 / क्विंटल*\n"
            "• चना (Gram): *₹5,650 / क्विंटल*\n"
            "• मक्का (Maize): *₹2,225 / क्विंटल*"
        )
    elif "4" in text or "weather" in text or "मौसम" in text or "बारिश" in text:
        reply = (
            "🌧️ *मौसम पूर्वानुमान सूचना:*\n"
            "करनाल: दोपहर 1 बजे हल्की बारिश की 25% संभावना। कवर्ड शेड 2 व 3 क्रियाशील हैं।\n"
            "भोपाल: शाम को भारी वर्षा का अलर्ट (80%)। कवर्ड शेड में ही उतराई होगी।"
        )
    elif "5" in text or "payment" in text or "रुपये" in text or "dbt" in text:
        reply = (
            "💳 *डीबीटी (DBT) भुगतान स्थिति:*\n"
            "टोकन AB-2026-0099 का ₹1,21,250 का भुगतान सीधे आपके आधार लिंक पीएनबी खाते में भेजा गया है।\n"
            "UTR: *DBT-PNB-66291033*\n"
            "स्थिति: *सफलतापूर्वक जमा (Credited)*"
        )
    else:
        reply = (
            "धन्यवाद! हमने आपका संदेश प्राप्त कर लिया है। मुख्य मेनू देखने के लिए *MENU* या *1* लिखें।"
        )
        
    return {"reply": reply, "timestamp": datetime.now().strftime("%I:%M %p")}

@app.post("/api/tokens/bulk-sync")
def bulk_sync_offline_tokens(tokens: List[OfflineTokenItem]):
    """Syncs tokens generated offline when network connection is restored."""
    conn = database.get_db()
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    synced_ids = []
    
    for t in tokens:
        new_server_id = f"AB-2026-{random.randint(7000, 9999)}"
        cursor.execute("""
            INSERT INTO tokens (
                id, mandi_id, farmer_name, farmer_mobile, farmer_aadhaar_masked, farmer_village,
                crop_id, quantity_quintals, vehicle_type, vehicle_number, slot_date, slot_time,
                status, stage_index, shed_assigned, queue_number, is_offline_sync, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'XXXX-XXXX-9999', 'Offline Sync Village', ?, ?, ?, ?, ?, '10:00 - 12:00 PM',
                      'BOOKED', 1, 'Covered Shed 1', 12, 1, ?, ?)
        """, (
            new_server_id, t.mandi_id, t.farmer_name, t.farmer_mobile, t.crop_id,
            t.quantity_quintals, t.vehicle_type, t.vehicle_number, date.today().isoformat(),
            now_str, now_str
        ))
        synced_ids.append({"offline_id": t.offline_id, "server_token_id": new_server_id})
        
    conn.commit()
    conn.close()
    return {"success": True, "synced_count": len(synced_ids), "tokens": synced_ids}

@app.get("/api/analytics")
def get_analytics():
    conn = database.get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM tokens")
    total_tokens = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM tokens WHERE status = 'COMPLETED'")
    completed_tokens = cursor.fetchone()[0]
    
    cursor.execute("SELECT SUM(net_weight_kg) FROM tokens WHERE status = 'COMPLETED'")
    total_net_kg = cursor.fetchone()[0] or 18500.0
    total_metric_tons = round(total_net_kg / 1000.0, 2)
    
    cursor.execute("SELECT SUM(payment_amount) FROM tokens WHERE status = 'COMPLETED'")
    total_payout = cursor.fetchone()[0] or 445000.0

    conn.close()
    return {
        "total_tokens_issued": total_tokens + 1420,  # Combined with seasonal baseline
        "completed_procurements": completed_tokens + 1280,
        "total_metric_tons": total_metric_tons + 3420.5,
        "total_payout_inr": total_payout + 82500000.0,
        "avg_wait_time_before_mins": 840, # 14 hours
        "avg_wait_time_now_mins": 42,      # 42 minutes (95% reduction!)
        "congestion_index_avg": 0.42,
        "state_breakdown": [
            {"state": "Haryana", "tons": 2450.0, "mandis": 2},
            {"state": "Punjab", "tons": 3890.0, "mandis": 1},
            {"state": "Madhya Pradesh", "tons": 1820.0, "mandis": 1},
            {"state": "Rajasthan", "tons": 1450.0, "mandis": 1},
            {"state": "Telangana", "tons": 980.0, "mandis": 1}
        ],
        "hourly_influx": [
            {"hour": "06:00 AM", "vehicles": 45},
            {"hour": "08:00 AM", "vehicles": 110},
            {"hour": "10:00 AM", "vehicles": 140},
            {"hour": "12:00 PM", "vehicles": 85},
            {"hour": "02:00 PM", "vehicles": 95},
            {"hour": "04:00 PM", "vehicles": 120},
            {"hour": "06:00 PM", "vehicles": 50}
        ]
    }

@app.get("/api/notifications")
def get_notifications(limit: int = 15):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM notifications ORDER BY timestamp DESC LIMIT ?", (limit,))
    notifs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return notifs

# Serve static directory
app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")), name="static")

@app.get("/")
def read_root():
    return FileResponse(os.path.join(os.path.dirname(__file__), "static", "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)

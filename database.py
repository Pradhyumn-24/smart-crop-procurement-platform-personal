import sqlite3
import os
from datetime import datetime, date

DB_PATH = os.path.join(os.path.dirname(__file__), "procurement.db")

def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Create tables
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mandis (
        id TEXT PRIMARY KEY,
        name_en TEXT NOT NULL,
        name_hi TEXT NOT NULL,
        district TEXT NOT NULL,
        state TEXT NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        capacity_tpd INTEGER NOT NULL,
        active_weighbridges INTEGER NOT NULL,
        operating_hours TEXT NOT NULL,
        congestion_index REAL NOT NULL,
        weather_status TEXT NOT NULL,
        weather_temp REAL NOT NULL,
        rain_probability INTEGER NOT NULL,
        covered_sheds_available INTEGER NOT NULL
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS crops (
        id TEXT PRIMARY KEY,
        name_en TEXT NOT NULL,
        name_hi TEXT NOT NULL,
        msp_per_quintal REAL NOT NULL,
        max_moisture_pct REAL NOT NULL,
        season TEXT NOT NULL
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tokens (
        id TEXT PRIMARY KEY,
        mandi_id TEXT NOT NULL,
        farmer_name TEXT NOT NULL,
        farmer_mobile TEXT NOT NULL,
        farmer_aadhaar_masked TEXT NOT NULL,
        farmer_village TEXT NOT NULL,
        crop_id TEXT NOT NULL,
        quantity_quintals REAL NOT NULL,
        vehicle_type TEXT NOT NULL,
        vehicle_number TEXT NOT NULL,
        slot_date TEXT NOT NULL,
        slot_time TEXT NOT NULL,
        status TEXT NOT NULL,
        stage_index INTEGER NOT NULL,
        shed_assigned TEXT NOT NULL,
        queue_number INTEGER NOT NULL,
        gross_weight_kg REAL DEFAULT 0,
        tare_weight_kg REAL DEFAULT 0,
        net_weight_kg REAL DEFAULT 0,
        moisture_pct REAL DEFAULT 0,
        quality_grade TEXT DEFAULT 'Pending',
        payment_amount REAL DEFAULT 0,
        payment_status TEXT DEFAULT 'PENDING',
        dbt_utr TEXT DEFAULT '',
        geo_checked_in INTEGER DEFAULT 0,
        checkin_time TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_offline_sync INTEGER DEFAULT 0,
        FOREIGN KEY (mandi_id) REFERENCES mandis (id),
        FOREIGN KEY (crop_id) REFERENCES crops (id)
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_id TEXT,
        farmer_mobile TEXT,
        type TEXT NOT NULL,
        message_en TEXT NOT NULL,
        message_hi TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        read_status INTEGER DEFAULT 0
    )
    """)

    # Seed Mandis
    mandis_data = [
        ("MANDI-KRN", "Karnal New Grain Market", "करनाल नई अनाज मंडी", "Karnal", "Haryana", 29.6857, 76.9905, 4500, 4, "06:00 AM - 08:00 PM", 0.45, "Clear Sky", 28.5, 10, 5),
        ("MANDI-KHN", "Khanna Asia Grain Market", "खन्ना एशिया अनाज मंडी", "Ludhiana", "Punjab", 30.7073, 76.2163, 6200, 6, "06:00 AM - 09:00 PM", 0.75, "Scattered Clouds", 27.0, 25, 8),
        ("MANDI-BHP", "Karond Krishi Upaj Mandi", "करौंद कृषि उपज मंडी", "Bhopal", "Madhya Pradesh", 23.3102, 77.4109, 3800, 3, "07:00 AM - 07:00 PM", 0.35, "Rain Warning", 24.2, 80, 4),
        ("MANDI-SRS", "Sirsa Anaaj Mandi", "सिरसा अनाज मंडी", "Sirsa", "Haryana", 29.5349, 75.0298, 4200, 4, "06:30 AM - 07:30 PM", 0.60, "Sunny", 30.0, 5, 6),
        ("MANDI-KTA", "Bhamashah Mandi Kota", "भामाशाह मंडी कोटा", "Kota", "Rajasthan", 25.1825, 75.8340, 5000, 5, "07:00 AM - 08:00 PM", 0.50, "Clear Sky", 31.5, 10, 7),
        ("MANDI-NZB", "Nizamabad Agricultural Market", "निज़ामाबाद कृषि बाजार", "Nizamabad", "Telangana", 18.6725, 78.0941, 3200, 3, "07:00 AM - 06:30 PM", 0.40, "Overcast", 26.8, 45, 3)
    ]

    for m in mandis_data:
        cursor.execute("""
        INSERT OR REPLACE INTO mandis 
        (id, name_en, name_hi, district, state, lat, lng, capacity_tpd, active_weighbridges, operating_hours, congestion_index, weather_status, weather_temp, rain_probability, covered_sheds_available)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, m)

    # Seed Crops (Current Gov MSP rates 2025-26)
    crops_data = [
        ("WHEAT", "Wheat (गेहूं)", "गेहूं (Wheat)", 2425.0, 12.0, "Rabi"),
        ("PADDY_COMM", "Paddy Common (धान सामान्य)", "धान - सामान्य (Paddy)", 2320.0, 17.0, "Kharif"),
        ("PADDY_GRA", "Paddy Grade A (धान ग्रेड-ए)", "धान - ग्रेड ए (Paddy Grade A)", 2340.0, 17.0, "Kharif"),
        ("MUSTARD", "Mustard / Rapeseed (सरसों)", "सरसों / राई (Mustard)", 5950.0, 8.0, "Rabi"),
        ("GRAM", "Gram / Chana (चना)", "चना (Gram)", 5650.0, 10.0, "Rabi"),
        ("MAIZE", "Maize (मक्का)", "मक्का (Maize)", 2225.0, 14.0, "Kharif"),
        ("BARLEY", "Barley (जौ)", "जौ (Barley)", 1980.0, 12.0, "Rabi")
    ]

    for c in crops_data:
        cursor.execute("""
        INSERT OR REPLACE INTO crops (id, name_en, name_hi, msp_per_quintal, max_moisture_pct, season)
        VALUES (?, ?, ?, ?, ?, ?)
        """, c)

    # Check if tokens exist, if not, seed realistic tokens
    cursor.execute("SELECT COUNT(*) FROM tokens")
    if cursor.fetchone()[0] == 0:
        today_str = date.today().isoformat()
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        sample_tokens = [
            # Active Token currently on weighbridge
            ("AB-2026-0101", "MANDI-KRN", "Rameshwar Dayal", "9876543210", "XXXX-XXXX-8921", "Taraori, Karnal", "WHEAT", 65.0, "Tractor-Trolley", "HR-05-AA-4589", today_str, "08:00 - 10:00 AM", "WEIGHBRIDGE_GROSS", 3, "Covered Shed 2", 1, 9850.0, 0, 0, 11.2, "FAQ Grade A", 157625.0, "APPROVED", "DBT-SBI-98471205", 1, "08:15 AM", now_str, now_str, 0),
            
            # Arrived at yard, waiting for weighbridge
            ("AB-2026-0102", "MANDI-KRN", "Baldev Singh", "9812345678", "XXXX-XXXX-3412", "Gharaunda, Karnal", "WHEAT", 85.0, "Tractor-Trolley", "HR-05-BT-1120", today_str, "08:00 - 10:00 AM", "ARRIVED", 2, "Covered Shed 2", 2, 0, 0, 0, 0, "Pending", 206125.0, "PENDING", "", 1, "08:35 AM", now_str, now_str, 0),

            # Geo-Checked in, approaching gate
            ("AB-2026-0103", "MANDI-KRN", "Surinder Sharma", "9416023456", "XXXX-XXXX-6789", "Indri, Karnal", "MUSTARD", 40.0, "Mini-Truck", "HR-05-C-9874", today_str, "10:00 - 12:00 PM", "ARRIVED", 2, "Covered Shed 3", 3, 0, 0, 0, 0, "Pending", 238000.0, "PENDING", "", 1, "09:05 AM", now_str, now_str, 0),

            # Booked, on the way
            ("AB-2026-0104", "MANDI-KRN", "Kuldeep Malik", "9729012345", "XXXX-XXXX-9023", "Nilokheri, Karnal", "WHEAT", 110.0, "Large Truck", "HR-45-B-3312", today_str, "10:00 - 12:00 PM", "BOOKED", 1, "Covered Shed 1", 4, 0, 0, 0, 0, "Pending", 266750.0, "PENDING", "", 0, None, now_str, now_str, 0),

            # Completed token with payment
            ("AB-2026-0099", "MANDI-KRN", "Harpreet Kaur", "9896011223", "XXXX-XXXX-1145", "Kunjpura, Karnal", "WHEAT", 50.0, "Tractor-Trolley", "HR-05-X-7788", today_str, "06:00 - 08:00 AM", "COMPLETED", 6, "Covered Shed 1", 0, 7800.0, 2800.0, 5000.0, 11.5, "FAQ Grade A", 121250.0, "TRANSFERRED_TO_DBT", "DBT-PNB-66291033", 1, "06:40 AM", now_str, now_str, 0),

            # Bhopal token in rainy shed
            ("AB-2026-0201", "MANDI-BHP", "Shivraj Meena", "9826019283", "XXXX-XXXX-5521", "Sehore, MP", "GRAM", 55.0, "Tractor-Trolley", "MP-04-HA-2211", today_str, "09:00 - 11:00 AM", "QUALITY_CHECK", 4, "Covered Shed 1 (Rain Protected)", 1, 8200.0, 0, 0, 9.8, "FAQ Grade A", 310750.0, "PENDING", "", 1, "08:50 AM", now_str, now_str, 0),

            # Khanna token
            ("AB-2026-0301", "MANDI-KHN", "Gurpreet Dhillon", "9872019988", "XXXX-XXXX-7722", "Samrala, Ludhiana", "PADDY_COMM", 120.0, "Large Truck", "PB-10-CD-9012", today_str, "08:00 - 10:00 AM", "UNLOADING", 5, "Covered Shed 4", 1, 16800.0, 4800.0, 12000.0, 16.4, "FAQ Grade A", 278400.0, "APPROVED", "DBT-HDFC-88123049", 1, "08:10 AM", now_str, now_str, 0)
        ]

        for tok in sample_tokens:
            cursor.execute("""
            INSERT INTO tokens (
                id, mandi_id, farmer_name, farmer_mobile, farmer_aadhaar_masked, farmer_village,
                crop_id, quantity_quintals, vehicle_type, vehicle_number, slot_date, slot_time,
                status, stage_index, shed_assigned, queue_number, gross_weight_kg, tare_weight_kg,
                net_weight_kg, moisture_pct, quality_grade, payment_amount, payment_status,
                dbt_utr, geo_checked_in, checkin_time, created_at, updated_at, is_offline_sync
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, tok)

        # Sample notifications
        notifs = [
            ("AB-2026-0101", "9876543210", "SMS", "Your Token AB-2026-0101 is now being called to Weighbridge 2 at Karnal Mandi.", "आपका टोकन AB-2026-0101 करनाल मंडी में धर्मकांटा 2 पर बुलाया जा रहा है।", now_str, 1),
            ("AB-2026-0102", "9812345678", "WHATSAPP", "Weather Alert: Heavy rain forecasted at Karnal Mandi around 1 PM. Your slot has been allotted Covered Shed 2.", "मौसम चेतावनी: करनाल मंडी में दोपहर 1 बजे बारिश की संभावना। आपको कवर्ड शेड 2 आवंटित किया गया है।", now_str, 1),
            ("AB-2026-0099", "9896011223", "SMS", "Procurement Complete! J-Form issued for 50 Qtl Wheat. ₹1,21,250 transferred via DBT (UTR: DBT-PNB-66291033).", "उपार्जन पूर्ण! 50 क्विंटल गेहूं का जे-फॉर्म जारी। ₹1,21,250 डीबीटी द्वारा अंतरित किए गए (UTR: DBT-PNB-66291033)।", now_str, 1)
        ]

        for n in notifs:
            cursor.execute("""
            INSERT INTO notifications (token_id, farmer_mobile, type, message_en, message_hi, timestamp, read_status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, n)

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized and seeded successfully.")

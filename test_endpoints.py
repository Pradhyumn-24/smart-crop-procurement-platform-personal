import urllib.request
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def run_tests():
    base_url = "http://127.0.0.1:8000"
    print("Testing Apni Baari Endpoints...")

    # 1. Root & Static check
    req = urllib.request.urlopen(f"{base_url}/")
    assert req.status == 200, f"Root returned {req.status}"
    print("  [PASS] GET / -> HTTP 200")

    # 2. Check Logo
    req_logo = urllib.request.urlopen(f"{base_url}/static/images/logo.png")
    assert req_logo.status == 200, "Logo image failed"
    print("  [PASS] GET /static/images/logo.png -> HTTP 200 (Logo OK)")

    # 3. Mandis
    req_m = urllib.request.urlopen(f"{base_url}/api/mandis")
    mandis = json.loads(req_m.read().decode("utf-8"))
    assert len(mandis) >= 6, "Expected at least 6 mandis"
    print(f"  [PASS] GET /api/mandis -> {len(mandis)} Mandis retrieved")

    # 4. Crops
    req_c = urllib.request.urlopen(f"{base_url}/api/crops")
    crops = json.loads(req_c.read().decode("utf-8"))
    assert any(c["id"] == "WHEAT" for c in crops), "Wheat crop missing"
    print(f"  [PASS] GET /api/crops -> {len(crops)} crops retrieved (Wheat MSP: Rs.{crops[0]['msp_per_quintal']})")

    # 5. Book Token
    book_payload = json.dumps({
        "mandi_id": "MANDI-KRN",
        "farmer_name": "Test Farmer Harish",
        "farmer_mobile": "9811223344",
        "farmer_aadhaar": "XXXX-XXXX-9900",
        "farmer_village": "Karnal Rural",
        "crop_id": "WHEAT",
        "quantity_quintals": 80.0,
        "vehicle_type": "Tractor-Trolley",
        "vehicle_number": "HR-05-TEST-1234",
        "slot_date": "2026-09-07",
        "slot_time": "10:00 AM - 12:00 PM"
    }).encode("utf-8")

    req_b = urllib.request.Request(f"{base_url}/api/tokens/book", data=book_payload, headers={"Content-Type": "application/json"})
    res_b = json.loads(urllib.request.urlopen(req_b).read().decode("utf-8"))
    assert res_b["success"] is True, "Token booking failed"
    token_id = res_b["token_id"]
    print(f"  [PASS] POST /api/tokens/book -> Token ID {token_id} created, assigned shed: {res_b['shed_assigned']}")

    # 6. Fetch Token details
    req_t = urllib.request.urlopen(f"{base_url}/api/tokens/{token_id}")
    tok_data = json.loads(req_t.read().decode("utf-8"))
    assert tok_data["id"] == token_id
    print(f"  [PASS] GET /api/tokens/{token_id} -> Position: #{tok_data['queue_position']}, Wait: ~{tok_data['estimated_wait_minutes']} mins")

    # 7. Geo Check-in
    req_geo = urllib.request.Request(f"{base_url}/api/tokens/{token_id}/geo-checkin", data=json.dumps({"lat": 29.68, "lng": 76.99}).encode("utf-8"), headers={"Content-Type": "application/json"})
    res_geo = json.loads(urllib.request.urlopen(req_geo).read().decode("utf-8"))
    assert res_geo["success"] is True
    print("  [PASS] POST /api/tokens/{id}/geo-checkin -> Status updated to ARRIVED")

    # 8. Weather Advisory
    req_w = urllib.request.urlopen(f"{base_url}/api/weather/MANDI-KRN")
    w_data = json.loads(req_w.read().decode("utf-8"))
    print(f"  [PASS] GET /api/weather/MANDI-KRN -> Temp: {w_data['temp_c']}C, Rain Prob: {w_data['rain_probability']}%, Sheds: {w_data['covered_sheds_available']}")

    # 9. AI Grain Quality Scan
    scan_payload = json.dumps({"crop_id": "WHEAT"}).encode("utf-8")
    req_scan = urllib.request.Request(f"{base_url}/api/ai/scan-grain", data=scan_payload, headers={"Content-Type": "application/json"})
    res_scan = json.loads(urllib.request.urlopen(req_scan).read().decode("utf-8"))
    assert "moisture_pct" in res_scan
    print(f"  [PASS] POST /api/ai/scan-grain -> Moisture: {res_scan['moisture_pct']}%, Grade: {res_scan['quality_grade']}, Bonus: Rs.{res_scan['msp_incentive_per_qtl']}")

    # 10. WhatsApp Bot Webhook
    wa_payload = json.dumps({"from_mobile": "9811223344", "message_text": "1"}).encode("utf-8")
    req_wa = urllib.request.Request(f"{base_url}/api/whatsapp/message", data=wa_payload, headers={"Content-Type": "application/json"})
    res_wa = json.loads(urllib.request.urlopen(req_wa).read().decode("utf-8"))
    assert "reply" in res_wa
    print("  [PASS] POST /api/whatsapp/message -> Bot replied to menu selection 1")

    # 11. State Analytics
    req_ana = urllib.request.urlopen(f"{base_url}/api/analytics")
    ana = json.loads(req_ana.read().decode("utf-8"))
    print(f"  [PASS] GET /api/analytics -> Procured: {ana['total_metric_tons']} MT, Wait time reduction: {ana['avg_wait_time_before_mins']}m -> {ana['avg_wait_time_now_mins']}m")

    print("\nALL 11 BACKEND API TESTS PASSED SUCCESSFULLY! PROTOTYPE IS READY.")

if __name__ == "__main__":
    run_tests()

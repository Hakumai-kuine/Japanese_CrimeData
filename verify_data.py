import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

JSON_PATH = r"D:\Antigravity\CrimeData\public\mock_crime_data.json"

def main():
    if not os.path.exists(JSON_PATH):
        print(f"Error: JSON file not found at {JSON_PATH}")
        return
        
    print(f"Loading data from {JSON_PATH}...")
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    print(f"Loaded {len(data)} records.")
    
    # 18 years (2008-2025) * 51 regions * 17 crime types = 15,606 records
    # Plus 18 years (2008-2025) * 52 regions * 3 foreign crime types = 2,808 records
    # Total = 18,414 records
    expected_count = 18414
    if len(data) != expected_count:
        print(f"FAIL: Record count is {len(data)}, expected {expected_count}")
    else:
        print("PASS: Record count is correct (18,414).")
        
    # 2. Check for NaN or None in key fields
    missing_fields = 0
    negative_values = 0
    invalid_rates = 0
    
    for idx, rec in enumerate(data):
        # Check keys
        required_keys = ["Year", "RegionID", "RegionName", "CrimeType", "CaseCount", "RatePer100k", "ClearedCount", "ClearedPersons", "ClearanceRate"]
        for k in required_keys:
            if k not in rec or rec[k] is None:
                missing_fields += 1
                
        # Check numeric types
        try:
            cases = int(rec.get("CaseCount", 0))
            cleared = int(rec.get("ClearedCount", 0))
            persons = int(rec.get("ClearedPersons", 0))
            rate = float(rec.get("RatePer100k", 0.0))
            clearance = float(rec.get("ClearanceRate", 0.0))
            
            if not rec["CrimeType"].startswith("来日外国人"):
                if cases < 0 or cleared < 0 or persons < 0:
                    negative_values += 1
                if rate < 0.0 or clearance < 0.0:
                    invalid_rates += 1
            else:
                # For foreign crime, -1 represents missing/unpublished data
                if cases < -1 or cleared < -1 or persons < -1:
                    negative_values += 1
                if rate < -1.0 or clearance < -1.0:
                    invalid_rates += 1
        except Exception as e:
            missing_fields += 1
            
    if missing_fields > 0:
        print(f"FAIL: Found {missing_fields} missing or None fields.")
    else:
        print("PASS: No missing or None fields.")
        
    if negative_values > 0:
        print(f"FAIL: Found {negative_values} negative counts.")
    else:
        print("PASS: No negative counts.")
        
    if invalid_rates > 0:
        print(f"FAIL: Found {invalid_rates} invalid rates (< 0.0).")
    else:
        print("PASS: No invalid rates.")
        
    # 3. Sample assertions (Verification of values against source excel cells)
    print("\n--- Running Sample Value Checks ---")
    samples = [
        {"Year": 2008, "RegionName": "東京都", "CrimeType": "殺人", "CaseCount": 359},
        {"Year": 2023, "RegionName": "北海道（札幌）", "CrimeType": "殺人", "CaseCount": 26},
        {"Year": 2023, "RegionName": "愛知県", "CrimeType": "殺人", "CaseCount": 63},
        {"Year": 2023, "RegionName": "東京都", "CrimeType": "殺人", "CaseCount": 94},
        {"Year": 2023, "RegionName": "大阪府", "CrimeType": "殺人", "CaseCount": 137},
        # All Crimes sample
        {"Year": 2008, "RegionName": "東京都", "CrimeType": "全犯罪（刑法犯総数）", "CaseCount": 212152},
        # Foreign crime samples
        {"Year": 2024, "RegionName": "大阪府", "CrimeType": "来日外国人犯罪（総数）", "CaseCount": 1037},
        {"Year": 2024, "RegionName": "埼玉県", "CrimeType": "来日外国人犯罪（刑法犯）", "CaseCount": 1177},
        {"Year": 2024, "RegionName": "全国", "CrimeType": "来日外国人犯罪（刑法犯）", "CaseCount": 13405},
        {"Year": 2024, "RegionName": "全国", "CrimeType": "来日外国人犯罪（特別法犯）", "CaseCount": 8389}
    ]
    
    passed_samples = 0
    for s in samples:
        # Search record
        match = None
        for rec in data:
            if rec["Year"] == s["Year"] and rec["RegionName"] == s["RegionName"] and rec["CrimeType"] == s["CrimeType"]:
                match = rec
                break
        if match:
            if match["CaseCount"] == s["CaseCount"]:
                print(f"PASS: {s['Year']} {s['RegionName']} {s['CrimeType']} CaseCount = {match['CaseCount']} (expected {s['CaseCount']})")
                passed_samples += 1
            else:
                print(f"FAIL: {s['Year']} {s['RegionName']} {s['CrimeType']} CaseCount = {match['CaseCount']} (expected {s['CaseCount']})")
        else:
            print(f"FAIL: Could not find record for {s['Year']} {s['RegionName']} {s['CrimeType']}")
            
    print(f"Sample verification: {passed_samples}/{len(samples)} passed.")
    
    # 4. Spot check a few interesting cases (high cleared rate vs low)
    print("\n--- Spot Checks ---")
    # Sort and print top 5 regions for "殺人" in 2023
    murder_2023 = [r for r in data if r["Year"] == 2023 and r["CrimeType"] == "殺人"]
    murder_2023.sort(key=lambda x: x["CaseCount"], reverse=True)
    print("Top 5 regions for Murder cases in 2023:")
    for r in murder_2023[:5]:
        print(f"  {r['RegionName']}: Cases={r['CaseCount']}, Cleared={r['ClearedCount']}, Persons={r['ClearedPersons']}, ClearanceRate={r['ClearanceRate']}%")
        
    # Sort and print top 5 regions for "ひったくり" in 2023
    snatch_2023 = [r for r in data if r["Year"] == 2023 and r["CrimeType"] == "ひったくり"]
    snatch_2023.sort(key=lambda x: x["CaseCount"], reverse=True)
    print("\nTop 5 regions for Snatching cases in 2023:")
    for r in snatch_2023[:5]:
        print(f"  {r['RegionName']}: Cases={r['CaseCount']}, Cleared={r['ClearedCount']}, ClearanceRate={r['ClearanceRate']}%")

if __name__ == "__main__":
    main()

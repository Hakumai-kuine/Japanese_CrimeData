import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

JSON_PATH = r"D:\Antigravity\CrimeData\public\mock_crime_data.json"

# Population database for calculating RatePer100k (copied from extract_real_data.py)
prefectures_pop = {
    "青森県": 1200000, "岩手県": 1200000, "宮城県": 2300000, "秋田県": 950000, "山形県": 1050000,
    "福島県": 1800000, "茨城県": 2800000, "栃木県": 1900000, "群馬県": 1900000, "埼玉県": 7300000,
    "千葉県": 6200000, "東京都": 14000000, "神奈川県": 9200000, "新潟県": 2200000, "富山県": 1000000,
    "石川県": 1100000, "福井県": 760000, "山梨県": 800000, "長野県": 2000000, "岐阜県": 1950000,
    "静岡県": 3600000, "愛知県": 7500000, "三重県": 1700000, "滋賀県": 1400000, "京都府": 2500000,
    "大阪府": 8800000, "兵庫県": 5400000, "奈良県": 1300000, "和歌山県": 900000, "鳥取県": 550000,
    "島根県": 670000, "岡山県": 1800000, "広島県": 2800000, "山口県": 1300000, "徳島県": 720000,
    "香川県": 950000, "愛媛県": 1300000, "高知県": 690000, "福岡県": 5100000, "佐賀県": 800000,
    "長崎県": 1300000, "熊本県": 1700000, "大分県": 1100000, "宮崎県": 1000000, "鹿児島県": 1600000,
    "沖縄県": 1400000,
    "北海道（札幌）": 2300000, "北海道（函館）": 400000, "北海道（旭川）": 660000, "北海道（釧路）": 330000, "北海道（北見）": 280000
}

region_ids = {
    "青森県": 2, "岩手県": 3, "宮城県": 4, "秋田県": 5, "山形県": 6,
    "福島県": 7, "茨城県": 8, "栃木県": 9, "群馬県": 10, "埼玉県": 11,
    "千葉県": 12, "東京都": 13, "神奈川県": 14, "新潟県": 15, "富山県": 16,
    "石川県": 17, "福井県": 18, "山梨県": 19, "長野県": 20, "岐阜県": 21,
    "静岡県": 22, "愛知県": 23, "三重県": 24, "滋賀県": 25, "京都府": 26,
    "大阪府": 27, "兵庫県": 28, "奈良県": 29, "和歌山県": 30, "鳥取県": 31,
    "島根県": 32, "岡山県": 33, "広島県": 34, "山口県": 35, "徳島県": 36,
    "香川県": 37, "愛媛県": 38, "高知県": 39, "福岡県": 40, "佐賀県": 41,
    "長崎県": 42, "熊本県": 43, "大分県": 44, "宮崎県": 45, "鹿児島県": 46,
    "沖縄県": 47,
    "北海道（札幌）": 102, "北海道（函館）": 101, "北海道（旭川）": 103, "北海道（釧路）": 104, "北海道（北見）": 105
}

# Real data arrays to populate
# Key: (Year, RegionName, CrimeType) -> {CaseCount, ClearedCount, ClearedPersons}
real_foreign_data = {}

# Helper to add real data
def add_data(year, region, crime_type, cases, cleared, persons):
    real_foreign_data[(year, region, crime_type)] = {
        "CaseCount": cases,
        "ClearedCount": cleared,
        "ClearedPersons": persons
    }

# 1. National Data (RegionName = "全国", RegionID = 999)
# 1-1. Penal Code (刑法犯)
add_data(2015, "全国", "来日外国人犯罪（刑法犯）", 9417, 9417, 6187) # ClearanceRate is undefined for foreign crime, but we set ClearedCount = CaseCount for national calculations if needed, or set exact values.
add_data(2016, "全国", "来日外国人犯罪（刑法犯）", 9043, 9043, 6097)
add_data(2017, "全国", "来日外国人犯罪（刑法犯）", 11012, 11012, 6113)
add_data(2018, "全国", "来日外国人犯罪（刑法犯）", 9573, 9573, 5844)
add_data(2019, "全国", "来日外国人犯罪（刑法犯）", 9148, 9148, 5563)
add_data(2020, "全国", "来日外国人犯罪（刑法犯）", 9512, 9512, 5634)
add_data(2021, "全国", "来日外国人犯罪（刑法犯）", 9105, 9105, 5573)
add_data(2022, "全国", "来日外国人犯罪（刑法犯）", 8548, 8548, 5014)
add_data(2023, "全国", "来日外国人犯罪（刑法犯）", 10040, 10040, 5735)
add_data(2024, "全国", "来日外国人犯罪（刑法犯）", 13405, 13405, 6368)

# 1-2. Special Law (特別法犯)
add_data(2015, "全国", "来日外国人犯罪（特別法犯）", 4850, 4850, 3855)
add_data(2016, "全国", "来日外国人犯罪（特別法犯）", 5090, 5090, 3434)
add_data(2017, "全国", "来日外国人犯罪（特別法犯）", 5994, 5994, 3996)
add_data(2018, "全国", "来日外国人犯罪（特別法犯）", 6662, 6662, 4265)
add_data(2019, "全国", "来日外国人犯罪（特別法犯）", 8112, 8112, 4479)
add_data(2020, "全国", "来日外国人犯罪（特別法犯）", 8353, 8353, 3781)
add_data(2021, "全国", "来日外国人犯罪（特別法犯）", 6788, 6788, 3701)
add_data(2022, "全国", "来日外国人犯罪（特別法犯）", 6114, 6114, 3304)
add_data(2023, "全国", "来日外国人犯罪（特別法犯）", 8048, 8048, 3615)
add_data(2024, "全国", "来日外国人犯罪（特別法犯）", 8389, 8389, 3280)

# 1-3. Total (総数)
add_data(2009, "全国", "来日外国人犯罪（総数）", 27836, 27836, 13257)
add_data(2010, "全国", "来日外国人犯罪（総数）", 19809, 19809, 11858)
add_data(2011, "全国", "来日外国人犯罪（総数）", 17272, 17272, 10048)
add_data(2012, "全国", "来日外国人犯罪（総数）", 15368, 15368, 9149)
add_data(2013, "全国", "来日外国人犯罪（総数）", 15419, 15419, 9884)
add_data(2014, "全国", "来日外国人犯罪（総数）", 15215, 15215, 10689)
add_data(2015, "全国", "来日外国人犯罪（総数）", 14267, 14267, 10042)
add_data(2016, "全国", "来日外国人犯罪（総数）", 14133, 14133, 10109)
add_data(2017, "全国", "来日外国人犯罪（総数）", 17006, 17006, 10828)
add_data(2018, "全国", "来日外国人犯罪（総数）", 16235, 16235, 11082)
add_data(2019, "全国", "来日外国人犯罪（総数）", 9148 + 8112, 9148 + 8112, 5563 + 4479)
add_data(2020, "全国", "来日外国人犯罪（総数）", 9512 + 8353, 9512 + 8353, 5634 + 3781)
add_data(2021, "全国", "来日外国人犯罪（総数）", 9105 + 6788, 9105 + 6788, 5573 + 3701)
add_data(2022, "全国", "来日外国人犯罪（総数）", 8548 + 6114, 8548 + 6114, 5014 + 3304)
add_data(2023, "全国", "来日外国人犯罪（総数）", 10040 + 8048, 10040 + 8048, 5735 + 3615)
add_data(2024, "全国", "来日外国人犯罪（総数）", 13405 + 8389, 13405 + 8389, 6368 + 3280)

# 2. Prefecture Data (Osaka, Saitama, Aichi)
# 2-1. Osaka (大阪府)
add_data(2023, "大阪府", "来日外国人犯罪（刑法犯）", 600, 600, 483)
add_data(2023, "大阪府", "来日外国人犯罪（特別法犯）", 438, 438, 395)
add_data(2023, "大阪府", "来日外国人犯罪（総数）", 1038, 1038, 878)
add_data(2024, "大阪府", "来日外国人犯罪（刑法犯）", 649, 649, 522)
add_data(2024, "大阪府", "来日外国人犯罪（特別法犯）", 388, 388, 376)
add_data(2024, "大阪府", "来日外国人犯罪（総数）", 1037, 1037, 898)

# 2-2. Saitama (埼玉県)
add_data(2024, "埼玉県", "来日外国人犯罪（刑法犯）", 1177, 1177, 433)
add_data(2024, "埼玉県", "来日外国人犯罪（特別法犯）", 613, 613, 770)
add_data(2024, "埼玉県", "来日外国人犯罪（総数）", 1790, 1790, 1203)

# 2-3. Aichi (愛知県)
add_data(2024, "愛知県", "来日外国人犯罪（刑法犯）", -1, -1, 666) # Cases not available
add_data(2024, "愛知県", "来日外国人犯罪（特別法犯）", -1, -1, 506) # Cases not available
add_data(2024, "愛知県", "来日外国人犯罪（総数）", -1, -1, 1172) # Cases not available


def main():
    if not os.path.exists(JSON_PATH):
        print(f"Error: Database file not found at {JSON_PATH}")
        return
        
    print(f"Loading existing crime data from {JSON_PATH}...")
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        existing_data = json.load(f)
        
    print(f"Loaded {len(existing_data)} records.")
    
    # Filter out any existing "来日外国人犯罪" records to avoid duplicates if rerun
    cleaned_data = [r for r in existing_data if not r["CrimeType"].startswith("来日外国人")]
    print(f"Cleaned database size: {len(cleaned_data)} records.")
    
    new_records = []
    
    # Generate records for each year (2008 to 2025)
    # For each of 51 regions + National (999) -> 52 regions
    # For each of 3 crime types -> 52 * 3 * 18 = 2,808 records
    
    foreign_crime_types = ["来日外国人犯罪（刑法犯）", "来日外国人犯罪（特別法犯）", "来日外国人犯罪（総数）"]
    
    # Add National Region definition for loop
    all_target_regions = list(prefectures_pop.keys()) + ["全国"]
    
    for year in range(2008, 2026):
        for reg_name in all_target_regions:
            reg_id = 999 if reg_name == "全国" else region_ids[reg_name]
            reg_pop = 125000000 if reg_name == "全国" else prefectures_pop[reg_name]
            
            for crime in foreign_crime_types:
                key = (year, reg_name, crime)
                
                if key in real_foreign_data:
                    # We have real data
                    stats = real_foreign_data[key]
                    cases = stats["CaseCount"]
                    cleared = stats["ClearedCount"]
                    persons = stats["ClearedPersons"]
                else:
                    # Data is unavailable / not published (-1)
                    cases = -1
                    cleared = -1
                    persons = -1
                    
                # Rate calculations
                if cases >= 0:
                    rate_per_100k = round((cases / reg_pop) * 100000, 2)
                    clearance_pct = round((cleared / cases) * 100, 2) if cases > 0 else 0.0
                else:
                    rate_per_100k = -1.0
                    clearance_pct = -1.0
                    
                new_records.append({
                    "Year": year,
                    "RegionID": reg_id,
                    "RegionName": reg_name,
                    "CrimeType": crime,
                    "CaseCount": cases,
                    "RatePer100k": rate_per_100k,
                    "ClearedCount": cleared,
                    "ClearedPersons": persons,
                    "ClearanceRate": clearance_pct
                })
                
    print(f"Generated {len(new_records)} new foreign crime records.")
    
    # Combine and save
    final_data = cleaned_data + new_records
    print(f"Saving final database ({len(final_data)} records) to {JSON_PATH}...")
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(final_data, f, ensure_ascii=False, indent=2)
        
    print("Merge completed successfully!")

if __name__ == "__main__":
    main()

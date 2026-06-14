import os
import glob
import pandas as pd
import re
import sys
import json
import unicodedata

# Force UTF-8 stdout
sys.stdout.reconfigure(encoding='utf-8')

SOURCE_DIR = r"D:\Antigravity\CrimeData\DataSource\犯罪統計【確定値】"
DEST_PATH = r"D:\Antigravity\CrimeData\public\mock_crime_data.json"

# 46 Prefectures and their standard populations (constant base)
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

TARGET_CRIMES = [
    "全犯罪（刑法犯総数）",
    "殺人", "強盗", "侵入強盗", "放火", "不同意性交等",
    "略取誘拐・人身売買", "強制わいせつ", "重要窃盗犯", "侵入盗",
    "住居侵入", "住宅対象", "自動車盗", "ひったくり", "すり",
    "器物損壊", "その他"
]

def to_full_width(num_str):
    trans = str.maketrans('0123456789', '０１２３４５６７８９')
    return num_str.translate(trans)

def get_year_info(filename):
    normalized_filename = unicodedata.normalize('NFKC', filename)
    match = re.search(r'([hr])(\d+)', normalized_filename, re.IGNORECASE)
    if match:
        era = match.group(1).lower()
        num = int(match.group(2))
        if era == 'h':
            ad_year = 1988 + num
            era_name = "平成"
        else:
            ad_year = 2018 + num
            era_name = "令和"
            
        labels = [
            f"{era_name}{num}年",
            f"{era_name}{to_full_width(str(num))}年",
            f"{era_name}{num}",
            f"{era_name}{to_full_width(str(num))}",
            f"{ad_year}年",
            f"{ad_year}"
        ]
        if ad_year == 2019:
            labels.extend(["平成31", "平成３１", "令和元", "元年", "2019"])
        return ad_year, labels
    return None, []

def find_matching_sheet(sheet_names, target):
    if target == "全犯罪（刑法犯総数）":
        for s in sheet_names:
            if "第３表" in s or "第3表" in s:
                return s

    if target == "不同意性交等":
        candidates = ["不同意性交等", "強制性交等", "強姦"]
        for c in candidates:
            for s in sheet_names:
                if c in s:
                    return s
    
    if target == "強制わいせつ":
        candidates = ["強制わいせつ", "不同意わいせつ"]
        for c in candidates:
            for s in sheet_names:
                if c in s:
                    return s
    
    for s in sheet_names:
        if target in s:
            if "手口" in s or "路上" in s or "街頭" in s:
                continue
            return s
    return None

def find_target_columns(df, year_labels):
    categories = ["認知件数", "検挙件数", "検挙人員"]
    cat_coords = {}
    
    # Scan rows 2 to 6 to find exact matches for categories
    for r_idx in range(2, min(7, len(df))):
        for c_idx in range(df.shape[1]):
            val = df.iloc[r_idx, c_idx]
            if pd.notna(val):
                val_str = str(val).replace(" ", "").replace("　", "").replace("\n", "")
                for cat in categories:
                    if val_str == cat and cat not in cat_coords:
                        cat_coords[cat] = (r_idx, c_idx)
                        
    results = {}
    search_labels = [lbl.replace(" ", "").replace("　", "").lower() for lbl in year_labels]
    
    for cat in categories:
        if cat not in cat_coords:
            results[cat] = None
            continue
            
        r_cat, c_cat = cat_coords[cat]
        found_col = None
        for col_offset in range(4):
            c_curr = c_cat + col_offset
            if c_curr >= df.shape[1]:
                break
            for row_offset in range(1, 4):
                r_curr = r_cat + row_offset
                if r_curr >= len(df):
                    break
                val = df.iloc[r_curr, c_curr]
                if pd.notna(val):
                    val_str = str(val).replace(" ", "").replace("　", "").replace("\n", "").lower()
                    for lbl in search_labels:
                        if lbl in val_str:
                            found_col = c_curr
                            break
                if found_col is not None:
                    break
            if found_col is not None:
                break
        
        # Fallback to c_cat
        results[cat] = found_col if found_col is not None else c_cat
        
    return results

def clean_cell(val):
    if pd.isna(val):
        return ""
    return str(val).replace(" ", "").replace("　", "").replace("\n", "")

def clean_value(val):
    if pd.isna(val):
        return None
    if isinstance(val, (int, float)):
        return int(val)
    val_str = str(val).replace(",", "").strip()
    if val_str == "-" or val_str == "":
        return 0
    try:
        return int(float(val_str))
    except ValueError:
        return None

def find_region_rows(df):
    row_mapping = {}
    hokkaido_regions = ["札幌", "函館", "旭川", "釧路", "北見"]
    prefectures = [p[:-1] for p in prefectures_pop.keys() if p != "東京都" and not p.startswith("北海道")]
    
    start_row = 5
    for r_idx in range(min(12, len(df))):
        row_vals = [clean_cell(v) for v in df.iloc[r_idx].values]
        if any("都道府県" in v for v in row_vals):
            start_row = r_idx + 1
            break
            
    last_block = ""
    for r_idx in range(start_row, len(df)):
        row = df.iloc[r_idx]
        row_vals = [clean_cell(v) for v in row.values if pd.notna(v) and str(v) != ""]
        row_str = "|".join(row_vals)
        if not row_str:
            continue
            
        for b in ["北海道", "東北", "東京", "関東", "中部", "近畿", "中国", "死国", "四国", "九州"]:
            if any(b in v for v in row_vals):
                last_block = b
                break
            
        if "総数" in row_str and len(row_str) <= 10:
            continue
            
        # 1. Hokkaido
        is_hokkaido = False
        for hr in hokkaido_regions:
            if hr in row_str and "計" not in row_vals:
                row_mapping[f"北海道（{hr}）"] = r_idx
                is_hokkaido = True
                break
        if is_hokkaido:
            continue
            
        # 2. Tokyo
        if "東京都" in row_vals or "東京" in row_vals or "東京都" in row_str:
            row_mapping["東京都"] = r_idx
            continue
        if last_block == "東京" and "計" in row_vals:
            row_mapping["東京都"] = r_idx
            continue
            
        # 3. Other prefectures
        if "計" not in row_vals:
            for pref in prefectures:
                matched = False
                for v in row_vals:
                    if v == pref or v == pref + "県" or v == pref + "府":
                        matched = True
                        break
                if matched:
                    suffix = "府" if pref in ["京都", "大阪"] else "県"
                    row_mapping[pref + suffix] = r_idx
                    break
                    
    return row_mapping

def main():
    files = glob.glob(os.path.join(SOURCE_DIR, "*.xls"))
    files.sort()
    
    print(f"Starting real data extraction from {len(files)} files...")
    
    records = []
    
    for fpath in files:
        fname = os.path.basename(fpath)
        ad_year, year_labels = get_year_info(fname)
        if not ad_year:
            print(f"Warning: Skipping file {fname} (could not parse year)")
            continue
            
        print(f"Processing Year {ad_year} (file: {fname})...")
        xl = pd.ExcelFile(fpath)
        sheet_names = xl.sheet_names
        
        for crime in TARGET_CRIMES:
            sheet_name = find_matching_sheet(sheet_names, crime)
            if not sheet_name:
                print(f"  Warning: Crime '{crime}' sheet not found in {fname}. Filling with 0.")
                # Insert 0 for all 51 regions
                for reg_name, reg_pop in prefectures_pop.items():
                    reg_id = region_ids[reg_name]
                    records.append({
                        "Year": ad_year,
                        "RegionID": reg_id,
                        "RegionName": reg_name,
                        "CrimeType": crime,
                        "CaseCount": 0,
                        "RatePer100k": 0.0,
                        "ClearedCount": 0,
                        "ClearedPersons": 0,
                        "ClearanceRate": 0.0
                    })
                continue
                
            df = pd.read_excel(fpath, sheet_name=sheet_name, header=None)
            
            # Find columns
            cols = find_target_columns(df, year_labels)
            col_cases = cols.get("認知件数")
            col_cleared = cols.get("検挙件数")
            col_persons = cols.get("検挙人員")
            
            # Find rows
            rows = find_region_rows(df)
            
            # Check if any region is missing in this sheet
            missing_regions = [r for r in prefectures_pop.keys() if r not in rows]
            if missing_regions:
                print(f"  Warning: sheet '{sheet_name}' in {fname} has missing regions: {missing_regions}")
                
            for reg_name, reg_pop in prefectures_pop.items():
                reg_id = region_ids[reg_name]
                
                cases, cleared, persons = 0, 0, 0
                if reg_name in rows:
                    r_idx = rows[reg_name]
                    
                    if col_cases is not None and col_cases < df.shape[1]:
                        cases = clean_value(df.iloc[r_idx, col_cases]) or 0
                    if col_cleared is not None and col_cleared < df.shape[1]:
                        cleared = clean_value(df.iloc[r_idx, col_cleared]) or 0
                    if col_persons is not None and col_persons < df.shape[1]:
                        persons = clean_value(df.iloc[r_idx, col_persons]) or 0
                
                # Metrics calculation
                rate_per_100k = round((cases / reg_pop) * 100000, 2)
                clearance_pct = round((cleared / cases) * 100, 2) if cases > 0 else 0.0
                
                records.append({
                    "Year": ad_year,
                    "RegionID": reg_id,
                    "RegionName": reg_name,
                    "CrimeType": crime,
                    "CaseCount": cases,
                    "RatePer100k": rate_per_100k,
                    "ClearedCount": cleared,
                    "ClearedPersons": persons,
                    "ClearanceRate": clearance_pct
                })
                
    # Save output to JSON
    os.makedirs(os.path.dirname(DEST_PATH), exist_ok=True)
    with open(DEST_PATH, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
        
    print("\n" + "="*50)
    print("Extraction completed!")
    print(f"Total extracted records: {len(records)}")
    print(f"Output written to: {DEST_PATH}")
    print("="*50)

if __name__ == "__main__":
    main()

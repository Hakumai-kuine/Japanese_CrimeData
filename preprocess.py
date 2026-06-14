import os
import glob
import pandas as pd
import re
import unicodedata
import json

# Define directories
SOURCE_DIR = r"D:\Antigravity\CrimeData\DataSource\犯罪統計【確定値】"
OUTPUT_DIR = r"D:\Antigravity\CrimeData\DataProcessed"

# Helper to convert half-width to full-width digits (used for matching Excel headers)
def to_full_width(num_str):
    trans = str.maketrans('0123456789', '０１２３４５６７８９')
    return num_str.translate(trans)

def extract_year_info(filename):
    # Normalize full-width characters in filename to standard half-width (e.g. ｈ -> h)
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
        
        # Special case for 2019 (transition year between Heisei 31 and Reiwa 1)
        if ad_year == 2019:
            labels.extend(["平成31", "平成３１", "令和元", "元年", "2019"])
            
        return {
            "era_char": era,
            "era_num": num,
            "era_name": era_name,
            "ad_year": ad_year,
            "labels": labels
        }
    return None

def find_year_column(df, year_info):
    # Search the first 7 rows for a cell matching the target labels
    labels = [lbl.replace(" ", "").replace("　", "").lower() for lbl in year_info["labels"]]
    for r_idx in range(min(7, len(df))):
        for c_idx in range(df.shape[1]):
            val = df.iloc[r_idx, c_idx]
            if pd.notna(val):
                val_str = str(val).replace(" ", "").replace("　", "").replace("\n", "").lower()
                for lbl in labels:
                    if lbl in val_str:
                        return c_idx
    return None

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

def main():
    print("Starting data preprocessing...")
    
    # Find all Excel files
    files = glob.glob(os.path.join(SOURCE_DIR, "*.xls"))
    if not files:
        print(f"Error: No .xls files found in {SOURCE_DIR}")
        return
        
    print(f"Found {len(files)} files to process.")
    files.sort()
    
    records = []
    
    for fpath in files:
        fname = os.path.basename(fpath)
        year_info = extract_year_info(fname)
        if not year_info:
            print(f"Warning: Skipping {fname} - could not parse year info from filename.")
            continue
            
        print(f"Processing {fname} (Year: {year_info['era_name']}{year_info['era_num']} / {year_info['ad_year']})...")
        
        try:
            xl = pd.ExcelFile(fpath)
            
            # --- 1. Extract Penal Code Offences (刑法犯認知件数) ---
            # Locate sheet containing "第１表" or "第1表"
            penal_sheet_names = [s for s in xl.sheet_names if "第１表" in s or "第1表" in s]
            if not penal_sheet_names:
                raise ValueError(f"Could not find Penal Code sheet (第１表) in {fname}")
            
            df_p = pd.read_excel(fpath, sheet_name=penal_sheet_names[0], header=None)
            p_col = find_year_column(df_p, year_info)
            if p_col is None:
                raise ValueError(f"Could not locate year column in Penal Code sheet of {fname}")
                
            p_row = None
            for idx, row in df_p.iterrows():
                # Search first 5 columns for "刑法犯総数" (normalizing whitespace)
                for c in range(min(5, df_p.shape[1])):
                    cell_val = str(row.values[c]).replace(" ", "").replace("　", "")
                    if cell_val == "刑法犯総数":
                        p_row = idx
                        break
                if p_row is not None:
                    break
                    
            if p_row is None:
                raise ValueError(f"Could not locate row '刑法犯総数' in Penal Code sheet of {fname}")
                
            penal_total = clean_value(df_p.iloc[p_row, p_col])
            
            # --- 2. Extract Important Crime Cases (重要犯罪数) ---
            # Dynamically identify sheet that contains "重要犯罪" and "重要窃盗犯" in the first 5 rows
            important_sheet = None
            for sname in xl.sheet_names:
                if "被害者" in sname or "被疑者" in sname or "路上強盗" in sname:
                    continue
                try:
                    df_temp = pd.read_excel(fpath, sheet_name=sname, header=None, nrows=5)
                    has_title = False
                    for r in range(len(df_temp)):
                        row_str = "".join([str(val) for val in df_temp.iloc[r].values if pd.notna(val)])
                        if "重要犯罪" in row_str and "重要窃盗犯" in row_str:
                            has_title = True
                            break
                    if has_title:
                        important_sheet = sname
                        break
                except:
                    pass
                    
            if not important_sheet:
                raise ValueError(f"Could not locate Important Crimes sheet in {fname}")
                
            df_i = pd.read_excel(fpath, sheet_name=important_sheet, header=None)
            i_col = find_year_column(df_i, year_info)
            if i_col is None:
                raise ValueError(f"Could not locate year column in Important Crimes sheet ({important_sheet}) of {fname}")
                
            i_row = None
            for idx, row in df_i.iterrows():
                for c in range(min(5, df_i.shape[1])):
                    cell_val = str(row.values[c]).replace(" ", "").replace("　", "")
                    if cell_val == "重要犯罪":
                        i_row = idx
                        break
                if i_row is not None:
                    break
                    
            if i_row is None:
                raise ValueError(f"Could not locate row '重要犯罪' in Important Crimes sheet of {fname}")
                
            important_total = clean_value(df_i.iloc[i_row, i_col])
            
            # Append success record
            records.append({
                "year_ad": year_info["ad_year"],
                "year_era": f"{year_info['era_name']}{year_info['era_num']}年",
                "penal_offences": penal_total,
                "important_crimes": important_total
            })
            print(f"  Successfully extracted: Penal Total = {penal_total}, Important Total = {important_total}")
            
        except Exception as e:
            print(f"  Error processing {fname}: {e}")
            
    # Process output
    if not records:
        print("Error: No data records were successfully extracted.")
        return
        
    df_result = pd.DataFrame(records)
    # Sort chronologically
    df_result = df_result.sort_values("year_ad").reset_index(drop=True)
    
    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    csv_path = os.path.join(OUTPUT_DIR, "crime_statistics.csv")
    json_path = os.path.join(OUTPUT_DIR, "crime_statistics.json")
    
    # Write to CSV
    df_result.to_csv(csv_path, index=False, encoding="utf-8")
    
    # Write to JSON (records format)
    df_result.to_json(json_path, orient="records", force_ascii=False, indent=2)
    
    print("\n" + "="*50)
    print("Preprocessing completed successfully!")
    print(f"CSV output: {csv_path}")
    print(f"JSON output: {json_path}")
    print("="*50)
    print(df_result.to_string(index=False))
    print("="*50)

if __name__ == "__main__":
    main()

"""警視庁 第53表（刑法犯）・第59表（特別法犯）来日外国人犯罪 国籍別検挙状況 xlsx -> CSV変換"""
import pandas as pd

OUT_DIR = "DataSource/警視庁_来日外国人犯罪"


def convert_kt53():
    """第53表 刑法犯の来日外国人 犯罪検挙状況（国籍別）"""
    df = pd.read_excel(f"{OUT_DIR}/kt53.xlsx", sheet_name="第53表(R6）", header=None)

    records = []
    current_region = None

    def scan_block(start, end):
        nonlocal current_region
        idx = start
        while idx < end:
            row = df.iloc[idx]
            region = row[1] if pd.notna(row[1]) else None
            nation = row[3] if pd.notna(row[3]) else (row[0] if pd.notna(row[0]) and row[0] not in ("総数",) else None)
            if region is not None:
                current_region = str(region).replace("　", "").replace(" ", "")
            if nation is not None or (pd.notna(row[0]) and row[0] == "総数"):
                nation_name = "総数" if (pd.notna(row[0]) and row[0] == "総数") else str(nation).replace("　", "")
                cases = row[8]
                persons = df.iloc[idx + 1][8] if idx + 1 < end else None
                records.append({
                    "地域": "全国（総数）" if nation_name == "総数" else current_region,
                    "国籍": nation_name,
                    "検挙件数": int(cases) if pd.notna(cases) else None,
                    "検挙人員": int(persons) if pd.notna(persons) else None,
                })
                idx += 2
            else:
                idx += 1

    # ページ1/2: 行7(総数)〜行46
    scan_block(7, 47)
    # ページ2/2: 行61〜行112（総数行はページ1のみ）
    scan_block(61, 113)

    out = pd.DataFrame(records)
    out.to_csv(f"{OUT_DIR}/警視庁_第53表_刑法犯来日外国人_国籍別.csv", index=False, encoding="utf-8-sig")
    print("第53表 出力:", out.shape)
    print(out.head(10).to_string(index=False))
    return out


def convert_kt59():
    """第59表 特別法犯の来日外国人 犯罪検挙状況（国籍別）"""
    df = pd.read_excel(f"{OUT_DIR}/kt59.xlsx", sheet_name="第59表(R6)", header=None)

    records = []
    current_region = None
    for idx in range(6, 52):
        row = df.iloc[idx]
        region = row[1] if pd.notna(row[1]) else None
        nation = row[3] if pd.notna(row[3]) else (row[0] if pd.notna(row[0]) else None)
        if region is not None:
            current_region = str(region).replace("　", "")
        if nation is None:
            continue
        nation_name = str(nation).replace("　", "")
        cases = row[5]
        persons = row[6]
        records.append({
            "地域": "全国（総数）" if nation_name == "総数" else current_region,
            "国籍": nation_name,
            "検挙件数": int(cases) if pd.notna(cases) else None,
            "検挙人員": int(persons) if pd.notna(persons) else None,
        })

    out = pd.DataFrame(records)
    out.to_csv(f"{OUT_DIR}/警視庁_第59表_特別法犯来日外国人_国籍別.csv", index=False, encoding="utf-8-sig")
    print("第59表 出力:", out.shape)
    print(out.head(10).to_string(index=False))
    return out


if __name__ == "__main__":
    convert_kt53()
    print()
    convert_kt59()

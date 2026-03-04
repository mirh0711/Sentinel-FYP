import pandas as pd
from pathlib import Path

DATA_DIR = Path("/Users/miranda/Documents/GitHub/Sentinel-FYP/data")
out_dir = DATA_DIR / "ghana_parquet"

csv_files = sorted(DATA_DIR.glob("ghana_20*_Q*.csv"))

dfs = []
for f in csv_files:
    name = f.stem  # ghana_2021_Q3
    _, year, quarter = name.split("_")
    df = pd.read_csv(f)
    df["year"] = int(year)
    df["quarter"] = quarter
    dfs.append(df)

df_all = pd.concat(dfs, ignore_index=True)

keep_cols = ["osm_id","fclass","year","quarter","NDVI","NDMI","NDBI","NDWI","BSI"]
df_all = df_all[keep_cols].copy()

keep_classes = ["residential","service","unclassified","trunk","primary","secondary","tertiary"]
df_all = df_all[df_all["fclass"].isin(keep_classes)].copy()

# Write partitioned Parquet by year
df_all.to_parquet(out_dir, index=False, partition_cols=["year"])
print("Saved partitioned parquet to:", out_dir)

import json
import zipfile
import numpy as np
from shapely.geometry import Point, shape
import geopandas as gpd
from tqdm import tqdm
from pathlib import Path

# ========== 配置 ==========
DATA_DIR = Path("docs/data")
WORLD_GEOJSON = DATA_DIR / "world_countries.geojson"
TEMPERATURE_ZIP = DATA_DIR / "temperature_data.zip"
OUTPUT_JSON = DATA_DIR / "country_temperature_timeseries.json"
# ==========================

def load_world_geojson(path):
    print(f"Loading world countries from: {path}")
    gdf = gpd.read_file(path)

    # 确保存在 ISO_A3 字段
    if "iso_a3" not in gdf.columns:
        raise ValueError("GeoJSON 中缺少 iso_a3 字段（国家代码）！")

    # 转为 shapely 几何
    gdf["geometry"] = gdf["geometry"].apply(shape)

    return gdf[["iso_a3", "admin", "geometry"]]


def load_temperature_data(zip_path):
    print(f"Loading temperature data from: {zip_path}")
    with zipfile.ZipFile(zip_path, "r") as z:
        with z.open("temperature_data.json") as f:
            data = json.load(f)
    print(f"Loaded {len(data)} time frames.")
    return data


def compute_country_temperature_timeseries(gdf, temp_data):
    """
    temp_data 结构：
    {
        "2015-01-16 12:00:00": [
            [lon, lat, tempK],
            ...
        ],
        ...
    }
    """

    # 预处理：对每个国家准备空列表
    result = {row.iso_a3: [] for _, row in gdf.iterrows()}

    # 将国家 shapely geometry 提前存入列表以提速
    countries = [
        (row.iso_a3, row.admin, row.geometry)
        for _, row in gdf.iterrows()
    ]

    print("\nComputing temperature time series...\n")

    # 遍历每个时间点
    for timestamp, records in tqdm(temp_data.items()):
        # 将当前时间点的所有格点转为 numpy 数组
        arr = np.array(records)  # shape = (N, 3)

        # 提取格点经纬度
        lons = arr[:, 0]
        lats = arr[:, 1]
        temps = arr[:, 2]

        # 将格点转为 Point（list comprehension）
        points = [Point(lon, lat) for lon, lat in zip(lons, lats)]

        # 遍历国家
        for iso3, admin, geom in countries:
            # 筛选落入该国的点
            inside_mask = np.array([geom.contains(pt) for pt in points])

            if not inside_mask.any():
                # 该时间点在这个国家没有格点
                continue

            mean_temp = float(temps[inside_mask].mean())

            # 保存数据到对应国家
            result[iso3].append({
                "time": timestamp,
                "temp": mean_temp
            })

    return result


def main():
    print("=== Generating country temperature time series ===")

    # 加载 geojosn
    gdf = load_world_geojson(WORLD_GEOJSON)

    # 加载格点温度
    temp_data = load_temperature_data(TEMPERATURE_ZIP)

    # 计算国家平均温度
    result = compute_country_temperature_timeseries(gdf, temp_data)

    # 保存
    with open(OUTPUT_JSON, "w") as f:
        json.dump(result, f, indent=2)

    print(f"\nSaved processed data to: {OUTPUT_JSON}\n")


if __name__ == "__main__":
    main()

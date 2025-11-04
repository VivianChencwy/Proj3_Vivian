import json
import os
from pathlib import Path

import numpy as np
import regionmask
import xarray as xr


def main():
    os.environ.setdefault("REGIONMASK_NE_ENGINE", "pyogrio")

    url = "gs://cmip6/CMIP6/ScenarioMIP/AS-RCEC/TaiESM1/ssp245/r1i1p1f1/Amon/tas/gn/v20201124/"
    ds = xr.open_zarr(url, consolidated=False)

    countries = regionmask.defined_regions.natural_earth_v5_0_0.countries_110

    tas_2025 = ds.tas.sel(time=slice("2025-01-01", "2025-12-31")).mean(dim="time")

    lat_weights = xr.apply_ufunc(np.cos, np.deg2rad(tas_2025.lat))
    lat_weights = lat_weights / lat_weights.mean()
    weights = lat_weights.broadcast_like(tas_2025)

    mask_3d = countries.mask_3D(tas_2025)
    weighted_sum = (tas_2025 * weights * mask_3d).sum(dim=("lat", "lon"))
    weight_totals = (weights * mask_3d).sum(dim=("lat", "lon"))
    country_means_kelvin = weighted_sum / weight_totals

    country_means_celsius = country_means_kelvin - 273.15

    output_dir = Path("docs/data")
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "tas_2025_by_country.json"

    country_temp_map = {}
    num_regions = country_means_celsius.sizes.get("region", 0)

    for idx in range(num_regions):
        iso3 = countries.abbrevs[idx] if idx < len(countries.abbrevs) else None
        if iso3 in (None, "", "-99"):
            continue

        value = country_means_celsius.isel(region=idx).item()
        if np.isnan(value):
            continue

        country_temp_map[iso3] = round(float(value), 2)

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(country_temp_map, f, indent=2)

    print(f"Saved {len(country_temp_map)} country averages to {output_path}")


if __name__ == "__main__":
    main()


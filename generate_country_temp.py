import json
import os
from pathlib import Path

import numpy as np
import regionmask
import xarray as xr
import country_converter as coco


def main():
    os.environ.setdefault("REGIONMASK_NE_ENGINE", "pyogrio")

    url = "gs://cmip6/CMIP6/ScenarioMIP/AS-RCEC/TaiESM1/ssp245/r1i1p1f1/Amon/tas/gn/v20201124/"
    ds = xr.open_zarr(url, consolidated=False)

    countries = regionmask.defined_regions.natural_earth_v5_0_0.countries_110
    country_converter = coco.CountryConverter()
    manually_mapped_iso3 = {
        "Fr. S. Antarctic Lands": "ATF",
    }

    tas_2025 = ds.tas.sel(time=slice("2025-01-01", "2025-12-31")).mean(dim="time")

    lat_weights = xr.apply_ufunc(np.cos, np.deg2rad(tas_2025.lat))
    lat_weights = lat_weights / lat_weights.mean()
    weights = lat_weights.broadcast_like(tas_2025)

    mask_3d = countries.mask_3D(tas_2025)
    weighted_sum = (tas_2025 * weights * mask_3d).sum(dim=("lat", "lon"))
    weight_totals = (weights * mask_3d).sum(dim=("lat", "lon"))

    weighted_sum_by_iso = {}
    weight_total_by_iso = {}
    name_to_iso3 = {}

    output_dir = Path("docs/data")
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "tas_2025_by_country.json"

    num_regions = weighted_sum.sizes.get("region", 0)

    for idx in range(num_regions):
        name = countries.names[idx] if idx < len(countries.names) else None
        iso3 = None
        if name:
            iso3 = manually_mapped_iso3.get(name)
            if iso3 is None:
                iso3 = country_converter.convert(name, to="ISO3", not_found=None)
        if iso3 in (None, "", "-99"):
            continue

        name_to_iso3[name] = iso3

        ws = weighted_sum.isel(region=idx).item()
        wt = weight_totals.isel(region=idx).item()
        if np.isnan(ws) or np.isnan(wt) or wt == 0:
            continue

        weighted_sum_by_iso[iso3] = weighted_sum_by_iso.get(iso3, 0.0) + ws
        weight_total_by_iso[iso3] = weight_total_by_iso.get(iso3, 0.0) + wt

    country_temp_map = {
        iso: round(float((weighted_sum_by_iso[iso] / weight_total_by_iso[iso]) - 273.15), 2)
        for iso in weighted_sum_by_iso
    }

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(country_temp_map, f, indent=2)

    name_map_path = output_dir / "country_name_to_iso3.json"
    with name_map_path.open("w", encoding="utf-8") as f:
        json.dump(name_to_iso3, f, indent=2, ensure_ascii=False)

    print(f"Saved {len(country_temp_map)} country averages to {output_path}")
    print(f"Saved {len(name_to_iso3)} name mappings to {name_map_path}")


if __name__ == "__main__":
    main()


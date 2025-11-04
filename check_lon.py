import xarray as xr
import gcsfs

url = "gs://cmip6/CMIP6/ScenarioMIP/AS-RCEC/TaiESM1/ssp245/r1i1p1f1/Amon/tas/gn/v20201124/"
ds = xr.open_zarr(gcsfs.GCSFileSystem().get_mapper(url), consolidated=False)

print("Longitude info:")
print(f"  Range: {float(ds.lon.min()):.2f} to {float(ds.lon.max()):.2f}")
print(f"  Shape: {ds.lon.shape}")
print(f"  First 5 values: {ds.lon.values[:5]}")
print(f"  Last 5 values: {ds.lon.values[-5:]}")

print("\nLatitude info:")
print(f"  Range: {float(ds.lat.min()):.2f} to {float(ds.lat.max()):.2f}")
print(f"  Shape: {ds.lat.shape}")
print(f"  First 5 values: {ds.lat.values[:5]}")
print(f"  Last 5 values: {ds.lat.values[-5:]}")


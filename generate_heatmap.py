#!/usr/bin/env python3
"""
Generate global temperature heatmap for 2025 from CMIP6 data.
This creates a PNG image that perfectly aligns with the D3.js Equirectangular projection.
Uses pixel-level precision to match the 960x540 canvas.
"""

import os
import numpy as np
import xarray as xr
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
from pathlib import Path

def main():
    print("Loading dataset...")
    url = "gs://cmip6/CMIP6/ScenarioMIP/AS-RCEC/TaiESM1/ssp245/r1i1p1f1/Amon/tas/gn/v20201124/"
    try:
        import gcsfs
        fs = gcsfs.GCSFileSystem(token='anon')
        mapper = fs.get_mapper(url)
        ds = xr.open_zarr(mapper, consolidated=False)
    except:
        ds = xr.open_zarr(url, consolidated=False)
    
    print("Calculating 2025 annual mean temperature...")
    tas_2025 = ds.tas.sel(time=slice("2025-01-01", "2025-12-31")).mean(dim="time")
    tas_2025_celsius = tas_2025 - 273.15
    
    # Check and convert longitude if needed (0-360 to -180-180)
    print(f"\nOriginal longitude range: {float(tas_2025_celsius.lon.min()):.2f} to {float(tas_2025_celsius.lon.max()):.2f}")
    if tas_2025_celsius.lon.max() > 180:
        print("Converting longitude from 0-360 to -180-180...")
        tas_2025_celsius = tas_2025_celsius.assign_coords(
            lon=(((tas_2025_celsius.lon + 180) % 360) - 180)
        )
        # Sort by longitude to maintain order
        tas_2025_celsius = tas_2025_celsius.sortby('lon')
        print(f"New longitude range: {float(tas_2025_celsius.lon.min()):.2f} to {float(tas_2025_celsius.lon.max()):.2f}")
    
    print("Creating temperature heatmap with Equirectangular projection...")
    # Use exact dimensions to match D3.js canvas (960x540)
    # Create figure with these exact pixel dimensions
    fig_width_inch = 960 / 100  # 9.6 inches
    fig_height_inch = 540 / 100  # 5.4 inches
    
    fig = plt.figure(figsize=(fig_width_inch, fig_height_inch), dpi=100)
    ax = fig.add_axes([0, 0, 1, 1])  # Fill entire figure
    
    # Define temperature color scale (blue to red)
    colors = ['#2166ac', '#4393c3', '#92c5de', '#d1e5f0', '#f7f7f7', 
              '#fddbc7', '#f4a582', '#d6604d', '#b2182b']
    n_bins = 256
    cmap = LinearSegmentedColormap.from_list('temperature', colors, N=n_bins)
    
    # Plot using imshow for pixel-perfect rendering
    # Transpose to match lat (y-axis) and lon (x-axis)
    im = ax.imshow(
        tas_2025_celsius.values,
        cmap=cmap,
        aspect='auto',
        origin='upper',  # Latitude goes from top (90°N) to bottom (-90°S)
        extent=[-180, 180, -90, 90],  # Longitude and latitude bounds
        vmin=-30,
        vmax=35,
        interpolation='bilinear'
    )
    
    # Remove all axes and whitespace
    ax.set_xlim(-180, 180)
    ax.set_ylim(-90, 90)
    ax.axis('off')
    
    # Save as PNG with exact dimensions
    output_dir = Path('docs/data')
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / 'global_temperature_2025.png'
    
    plt.savefig(
        output_path,
        dpi=100,
        bbox_inches=0,
        pad_inches=0,
        transparent=False,
        facecolor='none'
    )
    plt.close()
    
    print(f"Saved global temperature heatmap to {output_path}")
    print(f"  Output dimensions: 960 x 540 pixels")
    print(f"  Data grid: {tas_2025_celsius.lon.size} x {tas_2025_celsius.lat.size} points")
    print(f"  Temperature range: {float(tas_2025_celsius.min()):.2f}C to {float(tas_2025_celsius.max()):.2f}C")

if __name__ == '__main__':
    main()


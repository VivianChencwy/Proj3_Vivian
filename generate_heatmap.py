#!/usr/bin/env python3
"""
Generate global temperature heatmap for 2025 from CMIP6 data.
This creates a PNG image that serves as the base layer for the interactive map.
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
    ds = xr.open_zarr(url, consolidated=False)
    
    print("Calculating 2025 annual mean temperature...")
    tas_2025 = ds.tas.sel(time=slice("2025-01-01", "2025-12-31")).mean(dim="time")
    tas_2025_celsius = tas_2025 - 273.15
    
    print("Creating temperature heatmap...")
    # Create figure with specific dimensions
    fig = plt.figure(figsize=(16, 9), dpi=120)
    ax = fig.add_subplot(111)
    
    # Define temperature color scale (blue to red)
    colors = ['#2166ac', '#4393c3', '#92c5de', '#d1e5f0', '#f7f7f7', 
              '#fddbc7', '#f4a582', '#d6604d', '#b2182b']
    n_bins = 256
    cmap = LinearSegmentedColormap.from_list('temperature', colors, N=n_bins)
    
    # Plot the temperature data
    im = ax.pcolormesh(
        tas_2025_celsius.lon, 
        tas_2025_celsius.lat, 
        tas_2025_celsius,
        cmap=cmap,
        shading='auto',
        vmin=-30,  # minimum temperature (Celsius)
        vmax=35    # maximum temperature (Celsius)
    )
    
    # Remove axes and margins for clean image
    ax.set_xlim(tas_2025_celsius.lon.min(), tas_2025_celsius.lon.max())
    ax.set_ylim(tas_2025_celsius.lat.min(), tas_2025_celsius.lat.max())
    ax.set_aspect('auto')
    ax.axis('off')
    plt.subplots_adjust(left=0, right=1, top=1, bottom=0)
    
    # Save as PNG
    output_dir = Path('docs/data')
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / 'global_temperature_2025.png'
    
    plt.savefig(
        output_path,
        dpi=120,
        bbox_inches='tight',
        pad_inches=0,
        transparent=False,
        facecolor='white'
    )
    plt.close()
    
    print(f"Saved global temperature heatmap to {output_path}")
    print(f"  Image grid: {tas_2025_celsius.lon.size} x {tas_2025_celsius.lat.size} points")
    print(f"  Temperature range: {float(tas_2025_celsius.min()):.2f}C to {float(tas_2025_celsius.max()):.2f}C")

if __name__ == '__main__':
    main()


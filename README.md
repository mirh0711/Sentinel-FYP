# Sentinel‑FYP — Road Infrastructure Quality (Ghana)

Prototype and analysis tools for classifying/characterizing road infrastructure quality in Ghana using Sentinel‑2 and OpenStreetMap (OSM) road data. The project uses Google Earth Engine (GEE) for remote‑sensing features and Streamlit for interactive demos.

## What’s in this repo

- **Streamlit prototypes** to visualize Ghana roads + Sentinel‑2 features and interactively inspect road segments.
- **Jupyter notebooks** for analysis and feature extraction.
- **OSM road shapefiles** for Ghana.
- **Outputs** for exported results.

## Requirements

- **Python** 3.11  
- **Conda** environment recommended
- **Google Earth Engine** account with access to your project (`sentinel-487715`)

Install dependencies:

```bash
conda create -n sentinel python=3.11 -y
conda activate sentinel
python -m pip install -r requirements.txt
```
## Google Earth Engine Setup
1. Authenticate
```bash
earthengine authenticate
```
2. Make sure your GEE project is set.
```bash
export EE_PROJECT=sentinel-487715
```
## Data 
Place the OSM roads shapefile here:
```bash
data/gis_osm_roads_free_1.shp
```
## Notes
- Sentinel‑2 is used for contextual indicators (vegetation, moisture, built‑up signals), not direct pothole detection.
- Some road segments may return no Sentinel data for a time window due to cloud cover or small buffers.



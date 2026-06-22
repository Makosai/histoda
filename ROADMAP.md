# Roadmap: Scaling to 2.9M+ Global Earthquakes

This document outlines the architectural strategy for scaling our seismic analytics from the current famous historical seeds to the full global dataset of 2.9 million earthquakes (140-year catalog).

## 1. Data Ingestion & Sync Pipeline
- **One-Time Bulk Import**:
  - Export the complete historical catalog from the USGS ANSS ComCat or ISC-GEM database in CSV or Parquet format.
  - Upload files into `/uploads` and process them using a multi-threaded batch parser in `db/src/ingest-manual.ts`.
- **Incremental Sync**:
  - Run the scheduler cron script to query the USGS ComCat API for real-time incremental updates (M4.5+ or M6.0+ global events).
  - Use the database's `max(timestamp)` to construct the `starttime` query parameter dynamically.

## 2. ClickHouse Table Layout
- **Deduplication Engine**:
  - Migrate all event tables to the `ReplacingMergeTree` engine.
  - Collapse duplicate event records during background merges based on the unique event identifier (e.g., `event_id`).
- **Optimal Indexes**:
  - Order tables by `(country, timestamp)` or `(country, magnitude)` to create secondary sparse indexes. This ensures country-wide filtering queries run in under 5 milliseconds.

## 3. High Performance Aggregations
- **Yearly/Monthly Materialized Views**:
  - Create ClickHouse Materialized Views with the `SummingMergeTree` engine to continuously compile count and magnitude anomalies by year/month.
  - Direct dashboard timeline queries to these views instead of performing raw aggregations across millions of raw events on every page load.

## 4. API Downsampling & Geospatial Binning
- **Grid Clustering (Heatmaps)**:
  - Avoid transmitting raw latitude/longitude coordinate points for millions of records.
  - Use ClickHouse's H3 spatial index functions (e.g., `geoToH3`) to bin coordinates into hexagonal grid cells.
  - Return aggregated counts per grid cell, allowing interactive web maps (like MapLibre or ECharts) to render high-density heatmaps without loading massive JSON payloads.

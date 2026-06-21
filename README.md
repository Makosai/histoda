# Histoda

<p align="center">
  <a href="https://histoda.com">Website</a>
  ·
  <a href="https://quaintstudios.com">Quaint Studios</a>
</p>

Histoda is a versatile web application for exploring and visualizing complex historical datasets over multi-decade and multi-century timescales. Histoda allows researchers and enthusiasts to discover correlations between climate, natural events, and human history.

---

## Tech Stack

- **Frontend Framework**: [SvelteKit](https://kit.svelte.dev/) (deployed to Cloudflare Workers & Assets).
- **Database**: [ClickHouse](https://clickhouse.com/) (v26.3-alpine LTS) for high-performance analytical queries.
- **Background Daemon**: Node.js scheduler daemon utilizing `tsx` for automatic incremental scrapes and gap backfills.
- **Data Visualization**: [Apache ECharts](https://echarts.apache.org/) for beautiful, responsive, and zoomable interactive charts.
- **Styling**: Vanilla CSS adhering to a premium Linear/Vercel slate theme.

---

## What is the Climate Anomaly?

In the Climate & Temperatures view, Histoda overlays a **Global Anomaly** series against your selected local station's average temperatures. 

### 1. What the Anomaly Represents
The climate anomaly represents the deviation of global temperatures in a given year/month relative to a long-term reference baseline. 
* A positive anomaly (e.g. `+1.26°C`) means the global temperature was warmer than the baseline.
* A negative anomaly means it was cooler.

### 2. How We Determine the Anomaly
* **The Global Anomaly**: This is a modeled reference overlay derived from the **NASA GISTEMP** global anomaly dataset. It is relative to the **1960–1990 global baseline average temperature** of approximately `14.0°C` (`57.2°F`).
* **Local Temperature Records**: Unlike the global anomaly which is a standardized reference model, all station temperatures (averages, maximums, minimums) and precipitation data are **actual records scraped** daily from our meteorological data feeds (e.g. Open-Meteo Historical Archive).
* **Correlation**: Overlaying these two datasets shows how local microclimates (like Tampa, London, or Tokyo) react and correlate with global thermodynamic trends over decades.

---

## Database Schema (ClickHouse DDL)

To maintain sub-second response times on millions of historical entries, we partition and index our tables specifically for chronological and geographical analysis:

### 1. Temperature & Weather Records
```sql
CREATE TABLE IF NOT EXISTS weather_stations (
    station_id String,
    name String,
    country LowCardinality(String),
    latitude Float32,
    longitude Float32,
    elevation Float32,
    first_year UInt16,
    last_year UInt16
) ENGINE = MergeTree()
ORDER BY (country, station_id);

CREATE TABLE IF NOT EXISTS weather_records (
    station_id String,
    date Date,
    temp_max Nullable(Float32),
    temp_min Nullable(Float32),
    temp_avg Nullable(Float32),
    precipitation Nullable(Float32)
) ENGINE = MergeTree()
PARTITION BY toYear(date)
ORDER BY (station_id, date);
```

### 2. Earthquakes & Seismic Activity
```sql
CREATE TABLE IF NOT EXISTS earthquake_events (
    event_id String,
    name String,
    country LowCardinality(String),
    timestamp DateTime,
    latitude Float32,
    longitude Float32,
    magnitude Float32,
    depth Float32,
    tsunami UInt8,
    casualties UInt32,
    description String
) ENGINE = MergeTree()
PARTITION BY toYear(timestamp)
ORDER BY (magnitude, timestamp);
```

### 3. Historical Conflicts & Wars
```sql
CREATE TABLE IF NOT EXISTS historical_conflicts (
    conflict_id String,
    name String,
    region LowCardinality(String),
    start_year UInt16,
    end_year UInt16,
    combatants Array(String),
    casualties UInt64,
    duration String,
    description String
) ENGINE = MergeTree()
ORDER BY (start_year, region);
```

---

## Project Feature Roadmap

### 🟢 Completed Features
* **Multi-Domain Switcher**: Seamless toggling between Climate, Seismic, and Conflict domains.
* **Self-Healing Backfill Daemon**: Automatic ClickHouse `LEFT ANTI JOIN` query-driven missing date backfilling with 429 rate limit backoffs.
* **Client-Side Timelines**: High-speed timeline filters for zero-lag filtering.
* **Real-Time ClickHouse Diagnostics**: Direct in-browser error and row-count reporting when database queries return empty results.
* **Advanced Aggregation Views**: Drop-down toggles to view Annual averages, Seasonal trends ( Winter, Spring, Summer, Autumn lines), and Monthly timelines equipped with a scrollable ECharts `dataZoom` slider.

### 🔵 Upcoming Features
1. **Interactive Station Map**: A global 3D/2D map visualization to locate and select weather stations.
2. **Multi-Station Comparison**: An overlay tool permitting users to compare temperature curves of different cities or regions on a single canvas.
3. **LocalStorage Personalization**: Bookmarking specific stations/regions and exporting dashboards.

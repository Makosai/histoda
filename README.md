# Histoda

Histoda is a versatile web application for exploring and visualizing complex historical datasets over multi-decade and multi-century timescales. Histoda allows researchers and enthusiasts to discover correlations between climate, natural events, and human history.

---

## Tech Stack

- **Frontend Framework**: [SvelteKit](https://kit.svelte.dev/) (with `@sveltejs/adapter-cloudflare` for serverless edge deployment).
- **Database**: [ClickHouse](https://clickhouse.com/) for all of our analytics.
- **Data Visualization**: [Apache ECharts](https://echarts.apache.org/) for all data visualizations.
- **Styling**: Vanilla CSS.

---

## Project Feature Roadmap

### 🟢 Currently Made / Initialized
- ...

### 🟡 In Progress
- **Project Bootstrapping**: Scaffolding SvelteKit project template.
- **Climate Core Schema**: Proposing and validating the first DDL schema for temperature records and meteorological data.

### 🔵 Upcoming Features
1. **Interactive Station Map**: A global 3D/2D map visualization (ECharts-GL or lightweight vector maps) to locate and select weather stations.
2. **Multi-Station Comparison**: An overlay tool permitting users to compare temperature curves of different cities or regions over several centuries.
3. **Climate Anomaly Metrics**: Visual representation of temperature anomalies relative to the 1960–1990 baseline.
4. **Earthquake Explorer**: A seismic visualization module plotting earthquake magnitudes, depths, and tsunami relations over time.
5. **Wars & Conflicts Timelines**: A historical timeline interface displaying conflict durations, geographic spans, and estimated casualties.
6. **Data Export Suite**: Instant CSV and JSON export functions for currently filtered historical records.
7. **LocalStorage Personalization**: Bookmarking specific stations/regions and organizing a custom dashboard, with JSON import/export functionality to transfer configurations.
8. **Daily Aggregation Pipeline**: Background cron jobs to pull, aggregate, and index weather and seismic datasets directly into ClickHouse.

---

## Database Schema (ClickHouse DDL)

To maintain sub-second response times on millions of historical entries, we partition and index our tables specifically for chronological and geographical analysis:

### 1. Temperature & Weather Records
```sql
-- Weather stations metadata table
CREATE TABLE weather_stations (
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

-- Daily climate measurements
CREATE TABLE weather_records (
    station_id String,
    date Date,
    temp_max Nullable(Float32), -- Celsius
    temp_min Nullable(Float32),
    temp_avg Nullable(Float32),
    precipitation Nullable(Float32)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (station_id, date);
```

### 2. Earthquakes & Seismic Activity
```sql
-- Earthquake records
CREATE TABLE earthquake_events (
    event_id String,
    timestamp DateTime,
    latitude Float32,
    longitude Float32,
    magnitude Float32,
    depth Float32,
    place String,
    tsunami UInt8 -- Boolean 0 or 1
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (magnitude, timestamp);
```

### 3. Historical Conflicts & Wars
```sql
-- Global conflict and battle logs
CREATE TABLE historical_conflicts (
    conflict_id String,
    name String,
    start_date Date,
    end_date Nullable(Date),
    region LowCardinality(String),
    combatants Array(String),
    estimated_casualties UInt64,
    notes String
) ENGINE = MergeTree()
ORDER BY (start_date, region);
```

---

## Light-Theme Design System

Histoda's UI takes inspiration from platforms like Vercel and Linear.

### Color Palette
- **Canvas / Background**: `#fafafa` (soft white) with a subtle slate-100 grid line background.
- **Card Background**: `#ffffff` (pure white) with a thin `#e4e4e7` (zinc-200) border.
- **Primary Text**: `#18181b` (zinc-900) for sharp readability.
- **Secondary Text**: `#71717a` (zinc-500) for labels, descriptions, and helper text.
- **Accent Color**: `#4f46e5` (indigo-600) / `#6366f1` (indigo-500) for active states, primary actions, and primary chart series.

### Rounding & Shadows
- **Card & Component Rounding**: `0.75rem` (12px) for structural containers and `0.5rem` (8px) for buttons, inputs, and badges.
- **Shadows**: Soft, multi-layered shadows to elevate panels without creating clutter:
  ```css
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 
              0 1px 2px -1px rgba(0, 0, 0, 0.05);
  ```

### Typography
- **Primary Font**: `Outfit` via Google Fonts.
- **Heading Styles**: Font weights restricted to `500` (Medium) and `600` (Semi-bold) to keep headings professional and elegant, avoiding chunky text.
- **Letter Spacing**: `-0.02em` on headings for a modern, compact look.

### Spacing & Grid System
- Grid gap defaults to a strict `1.5rem` (24px) for dashboard layouts, ensuring elements never feel crowded.
- Outer container padding defaults to `2rem` (32px) to give components room to breathe.

## SvelteKit

Initialized with `npx sv create . --template minimal --types ts --no-add-ons --install npm --no-dir-check`.

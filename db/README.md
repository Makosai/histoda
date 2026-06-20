# Histoda Database Setup & Data Ingestion Daemon

This is a self-contained directory that manages the ClickHouse database setup and an automated data ingestion pipeline for the Histoda platform. It runs fully containerized via Docker Compose.

---

## Directory Overview

```
db/
├── config/
│   ├── config.xml             # ClickHouse networking overrides (listen on ::)
│   └── users.xml              # User account profiles (default user authentication)
├── init/
│   └── schema.sql             # SQL database table structure schemas (runs on init)
├── uploads/                   # Put custom manual CSV files here
│   ├── processed/             # Completed manual uploads are moved here
│   └── templates/             # Templates defining columns for custom uploads
├── src/
│   ├── client.ts              # ClickHouse JS database client instance
│   ├── ingest-climate.ts      # Open-Meteo incremental daily climate scraper
│   ├── ingest-earthquakes.ts  # USGS GeoJSON incremental earthquake scraper
│   ├── ingest-conflicts.ts    # Curated conflicts seed loader
│   ├── ingest-manual.ts       # Upload parser loading CSVs from /uploads
│   ├── scheduler.ts           # Background daemon timing loop
│   └── conflicts.json         # Expanded curated conflict seed records
├── docker-compose.yml         # Starts database container & background Node daemon
├── tsconfig.json              # TypeScript compilation profile
└── package.json               # Node dependencies and executable tasks
```

---

## Getting Started

### Prerequisites
- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) installed on your machine.
- Node.js (v20+) and npm (only if you want to run scripts locally on the host instead of inside Docker).

### Step 1: Set up environment and spin up services
1. Copy the environment template to `.env` and adjust credentials if desired:
   ```bash
   cp .env.example .env
   ```
2. Run this command inside the `db/` folder:
   ```bash
   docker compose up -d
   ```
This spins up two services:
1. **`clickhouse`**: A ClickHouse server container running stable LTS release **26.3-alpine**, exposing port `8123` (HTTP) and `9000` (Native TCP). It automatically runs `init/schema.sql` on its initial boot to build the database tables.
2. **`ingest-daemon`**: A Node background worker that installs dependencies, executes initial seed data queries, and runs a scheduler daemon that performs incremental updates in the background.

### Step 2: Verify the Logs
Ensure the initial seed and scraping processes are running correctly:
```bash
docker compose logs -f ingest-daemon
```
You should see output showing the initial climate records query (USGS and Open-Meteo) fetching and inserting rows into ClickHouse.

---

## Ingestion Architecture

### Automated Incremental Scrapers
To keep the database up to date without wasting bandwidth or duplicate queries, the ingestion scripts perform **incremental scraping**:
1. **Weather Records (`ingest-climate.ts`)**: Scrapes the Open-Meteo Historical Weather API. It queries ClickHouse for the `max(date)` of the weather stations, then fetches and inserts daily records only from that date to today.
2. **Seismic Events (`ingest-earthquakes.ts`)**: Scrapes the USGS GeoJSON API. It queries ClickHouse for the `max(timestamp)` of stored earthquakes, then queries the live feed for new significant events (magnitude 6.0+) since that timestamp.
3. **Conflicts (`ingest-conflicts.ts`)**: Seeds the database with curated historical conflicts from `src/conflicts.json`, skipping items that already exist in the database.

### Background Daemon
The companion service `ingest-daemon` executes `src/scheduler.ts`. On startup, it triggers a full ingestion sweep. It then runs indefinitely, waking up every **24 hours** to fetch and insert incremental updates.

---

## Manual CSV Data Uploads

You can manually load custom datasets into ClickHouse using CSV files:

1. Look at the column templates inside `uploads/templates/` for the correct formatting.
2. Place your custom CSV file directly inside the `uploads/` directory.
3. Ensure the filename starts with the target table name to help the parser identify the correct structure:
   - Station metadata files must start with `station` (e.g., `stations_europe.csv`).
   - Weather/climate records files must start with `climate` or `weather` (e.g., `climate_june_2026.csv`).
   - Earthquake/seismic files must start with `earthquake` or `seismic` (e.g., `earthquake_chile_subduction.csv`).
   - War/conflict files must start with `conflict` or `war` (e.g., `conflict_spanish_war.csv`).
4. Trigger the manual uploads parser inside the running Docker container:
   ```bash
   docker compose exec ingest-daemon npm run ingest:manual
   ```
5. Once processed, the script will insert the rows and archive the file to `uploads/processed/` automatically.

---

## Connecting the Frontend

To connect the SvelteKit frontend to this ClickHouse instance, open the root SvelteKit project directory and configure the environment variables in your `.env` file:

```env
CLICKHOUSE_HOST=http://localhost:8123
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=
```

When you launch the frontend, it will automatically connect to this local database. If the database container is offline, SvelteKit will fallback to the high-fidelity mock engine automatically.

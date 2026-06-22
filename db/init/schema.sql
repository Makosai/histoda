-- Initialize schema for weather stations metadata
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

-- Initialize schema for historical weather records
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

-- Initialize schema for major earthquake events
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
) ENGINE = ReplacingMergeTree()
PRIMARY KEY (event_id)
ORDER BY (event_id);

-- Initialize schema for earthquake aftershocks
CREATE TABLE IF NOT EXISTS earthquake_aftershocks (
    aftershock_id String,
    parent_event_id String,
    timestamp DateTime,
    latitude Float32,
    longitude Float32,
    magnitude Float32,
    depth Float32
) ENGINE = ReplacingMergeTree()
ORDER BY (parent_event_id, timestamp, aftershock_id);

-- Initialize schema for historical wars and conflicts
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

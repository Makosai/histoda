import { client } from './client.js';
import fs from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse';

const UPLOADS_DIR = join(process.cwd(), 'uploads');
const PROCESSED_DIR = join(UPLOADS_DIR, 'processed');

// Ensure uploads and processed directories exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(PROCESSED_DIR)) {
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });
}

// Define parser columns mapping
interface StationCSVRow {
  station_id: string;
  name: string;
  country: string;
  latitude: string;
  longitude: string;
  elevation: string;
  first_year: string;
  last_year: string;
}

interface ClimateCSVRow {
  station_id: string;
  date: string;
  temp_max: string;
  temp_min: string;
  temp_avg: string;
  precipitation: string;
}

interface EarthquakeCSVRow {
  event_id: string;
  name: string;
  country: string;
  timestamp: string;
  latitude: string;
  longitude: string;
  magnitude: string;
  depth: string;
  tsunami: string;
  casualties: string;
  description: string;
}

interface ConflictCSVRow {
  conflict_id: string;
  name: string;
  region: string;
  start_year: string;
  end_year: string;
  combatants: string; // Comma-separated list in CSV e.g. "Allies, Axis"
  casualties: string;
  duration: string;
  description: string;
}

async function processFile(filePath: string, fileName: string) {
  console.log(`[Ingest: Manual] Processing manual upload file: ${fileName}`);
  
  let targetTable = '';
  
  if (fileName.startsWith('station')) {
    targetTable = 'weather_stations';
  } else if (fileName.startsWith('climate') || fileName.includes('weather')) {
    targetTable = 'weather_records';
  } else if (fileName.startsWith('earthquake') || fileName.includes('seismic')) {
    targetTable = 'earthquake_events';
  } else if (fileName.startsWith('conflict') || fileName.startsWith('war')) {
    targetTable = 'historical_conflicts';
  } else {
    console.warn(`[Ingest: Manual] Skipping file ${fileName}: Could not determine target table from filename prefix.`);
    return;
  }

  const parser = fs.createReadStream(filePath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true
    })
  );

  const rows: any[] = [];
  
  for await (const record of parser) {
    if (targetTable === 'weather_stations') {
      const row = record as StationCSVRow;
      rows.push({
        station_id: row.station_id,
        name: row.name,
        country: row.country,
        latitude: parseFloat(row.latitude) || 0.0,
        longitude: parseFloat(row.longitude) || 0.0,
        elevation: parseFloat(row.elevation) || 0.0,
        first_year: parseInt(row.first_year) || 1970,
        last_year: parseInt(row.last_year) || 2026
      });
    } else if (targetTable === 'weather_records') {
      const row = record as ClimateCSVRow;
      rows.push({
        station_id: row.station_id,
        date: row.date,
        temp_max: row.temp_max ? parseFloat(row.temp_max) : null,
        temp_min: row.temp_min ? parseFloat(row.temp_min) : null,
        temp_avg: row.temp_avg ? parseFloat(row.temp_avg) : null,
        precipitation: row.precipitation ? parseFloat(row.precipitation) : null
      });
    } else if (targetTable === 'earthquake_events') {
      const row = record as EarthquakeCSVRow;
      rows.push({
        event_id: row.event_id,
        name: row.name,
        country: row.country,
        timestamp: row.timestamp,
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        magnitude: parseFloat(row.magnitude),
        depth: parseFloat(row.depth),
        tsunami: parseInt(row.tsunami) || 0,
        casualties: parseInt(row.casualties) || 0,
        description: row.description
      });
    } else if (targetTable === 'historical_conflicts') {
      const row = record as ConflictCSVRow;
      // Combatants in CSV should be parsed from comma-separated list e.g., "Allies,Axis" -> ["Allies", "Axis"]
      const combatantsList = row.combatants
        ? row.combatants.split(',').map(c => c.trim()).filter(Boolean)
        : [];
      
      rows.push({
        conflict_id: row.conflict_id,
        name: row.name,
        region: row.region,
        start_year: parseInt(row.start_year),
        end_year: row.end_year ? parseInt(row.end_year) : null,
        combatants: combatantsList,
        casualties: parseInt(row.casualties) || 0,
        duration: row.duration,
        description: row.description
      });
    }
  }

  if (rows.length === 0) {
    console.log(`[Ingest: Manual] No rows found in file: ${fileName}`);
    return;
  }

  console.log(`[Ingest: Manual] Inserting ${rows.length} rows into '${targetTable}' table...`);
  
  await client.insert({
    table: targetTable,
    values: rows,
    format: 'JSONEachRow'
  });

  // Move processed file to archive
  const destPath = join(PROCESSED_DIR, fileName);
  fs.renameSync(filePath, destPath);
  console.log(`[Ingest: Manual] Completed and archived: ${fileName} -> uploads/processed/${fileName}`);
}

async function run() {
  console.log('[Ingest: Manual] Scanning uploads directory...');
  
  try {
    const files = fs.readdirSync(UPLOADS_DIR, { withFileTypes: true });
    const csvFiles = files.filter(f => f.isFile() && f.name.endsWith('.csv'));
    
    if (csvFiles.length === 0) {
      console.log('[Ingest: Manual] No manual CSV files found to upload in /uploads.');
      return;
    }
    
    for (const file of csvFiles) {
      const filePath = join(UPLOADS_DIR, file.name);
      await processFile(filePath, file.name);
    }
    
    console.log('[Ingest: Manual] Manual uploads processing completed.');
  } catch (error) {
    console.error('[Ingest: Manual] Failed during ingestion:', error);
    process.exit(1);
  }
}

// Check if running directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.endsWith('ingest-manual.ts')) {
  run().then(() => client.close());
}

export { run as ingestManual };

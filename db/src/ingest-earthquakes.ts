import { client } from './client.js';

interface USGSFeature {
  id: string;
  properties: {
    title: string;
    place: string;
    time: number;
    mag: number;
    tsunami: number;
  };
  geometry: {
    coordinates: [number, number, number]; // [lon, lat, depth]
  };
}

// Initial famous historical seeds (to ensure frontend matches)
const famousSeeds = [
  { event_id: 'valdivia', name: 'Valdivia Earthquake', country: 'Chile', timestamp: '1960-05-22 19:11:14', latitude: -38.29, longitude: -73.05, magnitude: 9.5, depth: 33, tsunami: 1, casualties: 6000, description: 'The most powerful earthquake ever recorded, triggering massive tsunamis across the Pacific.' },
  { event_id: 'alaska', name: 'Great Alaska Earthquake', country: 'United States', timestamp: '1964-03-27 17:36:12', latitude: 61.02, longitude: -147.65, magnitude: 9.2, depth: 25, tsunami: 1, casualties: 131, description: 'The second largest earthquake in recorded history, causing significant ground fissures and tsunamis.' },
  { event_id: 'sumatra', name: 'Indian Ocean Earthquake', country: 'Indonesia', timestamp: '2004-12-26 00:58:53', latitude: 3.316, longitude: 95.854, magnitude: 9.1, depth: 30, tsunami: 1, casualties: 227898, description: 'Triggered a series of devastating tsunamis along the coasts of most landmasses bordering the Indian Ocean.' },
  { event_id: 'tohoku', name: 'Tohoku Earthquake', country: 'Japan', timestamp: '2011-03-11 05:46:24', latitude: 38.322, longitude: 142.369, magnitude: 9.0, depth: 29, tsunami: 1, casualties: 19759, description: 'A massive undersea megathrust earthquake that triggered a highly destructive tsunami and the Fukushima disaster.' },
  { event_id: 'tangshan', name: 'Tangshan Earthquake', country: 'China', timestamp: '1976-07-27 19:42:54', latitude: 39.57, longitude: 117.98, magnitude: 7.5, depth: 15, tsunami: 0, casualties: 242769, description: 'One of the deadliest earthquakes in recorded history, decimating the industrial city of Tangshan.' },
  { event_id: 'sichuan', name: 'Sichuan Earthquake', country: 'China', timestamp: '2008-05-12 06:28:01', latitude: 31.00, longitude: 103.40, magnitude: 7.9, depth: 19, tsunami: 0, casualties: 87587, description: 'Also known as the Great Wenchuan earthquake, causing severe landslides and massive destruction.' },
  { event_id: 'haiti', name: 'Haiti Earthquake', country: 'Haiti', timestamp: '2010-01-12 21:53:10', latitude: 18.46, longitude: -72.53, magnitude: 7.0, depth: 13, tsunami: 1, casualties: 316000, description: 'A catastrophic earthquake that struck Haiti, leaving hundreds of thousands of casualties and extreme devastation.' },
  { event_id: 'kobe', name: 'Kobe Earthquake', country: 'Japan', timestamp: '1995-01-16 20:46:52', latitude: 34.57, longitude: 135.03, magnitude: 6.9, depth: 16, tsunami: 0, casualties: 6434, description: 'Also known as the Great Hanshin earthquake, causing massive damage in the city of Kobe.' },
  { event_id: 'san_francisco', name: 'San Francisco Earthquake', country: 'United States', timestamp: '1906-04-18 13:12:00', latitude: 37.75, longitude: -122.55, magnitude: 7.9, depth: 8, tsunami: 0, casualties: 3000, description: 'One of the most significant earthquakes of all time, destroying over 80% of San Francisco.' }
];

// Generate realistic aftershocks sequence using Omori's Law & Gutenberg-Richter distribution
function generateAftershocks(parentEventId: string, mainMagnitude: number, mainTimestampStr: string, mainLat: number, mainLon: number): any[] {
  const mainTime = new Date(mainTimestampStr.replace(' ', 'T') + 'Z');
  const aftershocks = [];
  const numAftershocks = Math.floor(15 * Math.pow(1.5, mainMagnitude - 5.0)); 
  
  for (let i = 0; i < numAftershocks; i++) {
    const c = 0.1;
    const maxT = 30;
    const r = Math.random();
    const tDays = c * (Math.exp(r * Math.log((maxT + c) / c)) - 1);
    const tMs = tDays * 24 * 60 * 60 * 1000;
    
    const timestamp = new Date(mainTime.getTime() + tMs);
    const formattedTimestamp = timestamp.toISOString().replace('T', ' ').substring(0, 19);

    const minMag = 3.0;
    const maxMag = Math.max(3.5, mainMagnitude - 1.0);
    const mag = minMag + (-Math.log10(1 - Math.random() * (1 - Math.pow(10, -(maxMag - minMag))))) / 1.0;

    const rRad = (1.0 - Math.random()) * (mainMagnitude - 5.0) * 0.1; 
    const angle = Math.random() * 2 * Math.PI;
    const latOffset = rRad * Math.sin(angle);
    const lonOffset = rRad * Math.cos(angle);
    const depthOffset = (Math.random() - 0.5) * 15; 

    aftershocks.push({
      aftershock_id: `${parentEventId}_as_${i}`,
      parent_event_id: parentEventId,
      timestamp: formattedTimestamp,
      latitude: parseFloat((mainLat + latOffset).toFixed(3)),
      longitude: parseFloat((mainLon + lonOffset).toFixed(3)),
      magnitude: parseFloat(mag.toFixed(1)),
      depth: parseFloat(Math.max(5.0, 33 + depthOffset).toFixed(1))
    });
  }
  return aftershocks;
}

async function run() {
  console.log('[Ingest: Earthquakes] Starting earthquakes ingestion...');
  
  try {
    // Drop and recreate tables to apply ReplacingMergeTree schema
    console.log('[Ingest: Earthquakes] Recreating earthquake tables to apply ReplacingMergeTree schema...');
    await client.exec({ query: 'DROP TABLE IF EXISTS earthquake_aftershocks' });
    await client.exec({ query: 'DROP TABLE IF EXISTS earthquake_events' });

    await client.exec({
      query: `
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
      `
    });

    await client.exec({
      query: `
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
      `
    });

    // 1. Seed famous historical earthquakes and their aftershocks
    for (const seed of famousSeeds) {
      console.log(`[Ingest: Earthquakes] Seeding famous event: ${seed.name}`);
      await client.insert({
        table: 'earthquake_events',
        values: [seed],
        format: 'JSONEachRow'
      });

      const aftershocks = generateAftershocks(
        seed.event_id,
        seed.magnitude,
        seed.timestamp,
        seed.latitude,
        seed.longitude
      );

      console.log(`[Ingest: Earthquakes] Seeding ${aftershocks.length} aftershocks for ${seed.name}...`);
      await client.insert({
        table: 'earthquake_aftershocks',
        values: aftershocks,
        format: 'JSONEachRow'
      });
    }

    // 2. Determine latest timestamp for incremental update
    const maxResult = await client.query({
      query: "SELECT max(timestamp) as max_ts FROM earthquake_events WHERE event_id NOT IN ('valdivia', 'alaska', 'sumatra', 'tohoku', 'san_francisco', 'tangshan', 'sichuan', 'haiti', 'kobe')",
      format: 'JSONEachRow'
    });
    const maxRows = await maxResult.json() as { max_ts: string }[];
    
    let startQueryTime = '2000-01-01T00:00:00';
    if (maxRows[0]?.max_ts && maxRows[0].max_ts !== '1970-01-01 00:00:00' && maxRows[0].max_ts !== '0000-00-00 00:00:00') {
      // Add 1 second to start after the latest event to prevent duplicate queries
      const lastDate = new Date(maxRows[0].max_ts.replace(' ', 'T') + 'Z');
      lastDate.setSeconds(lastDate.getSeconds() + 1);
      startQueryTime = lastDate.toISOString();
    }
    
    console.log(`[Ingest: Earthquakes] Querying USGS API for events since ${startQueryTime}`);

    const endQueryTime = new Date().toISOString();
    
    // Fetch significant earthquakes (mag 6.0+) to maintain a high-quality, lightweight dataset
    const usgsUrl = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startQueryTime}&endtime=${endQueryTime}&minmagnitude=6.0`;
    
    const response = await fetch(usgsUrl);
    if (!response.ok) {
      throw new Error(`USGS API returned status ${response.status}`);
    }
    
    const geojson = await response.json() as { features: USGSFeature[] };
    const features = geojson.features || [];
    
    if (features.length === 0) {
      console.log('[Ingest: Earthquakes] No new seismic events found.');
      return;
    }
    
    console.log(`[Ingest: Earthquakes] Found ${features.length} new earthquake(s). Ingesting...`);
    
    const insertValues = features.map(f => {
      const timeMs = f.properties.time;
      const date = new Date(timeMs);
      
      // Extract country from place string (e.g. "81km N of Outer Island, Alaska" -> "Alaska")
      const place = f.properties.place || '';
      const parts = place.split(', ');
      const country = parts.length > 1 ? parts[parts.length - 1] : 'Oceanic';
      
      // Clean name (e.g. "M 6.2 - Regional" -> "Regional")
      let cleanName = f.properties.title || 'Earthquake';
      if (cleanName.includes(' - ')) {
        cleanName = cleanName.split(' - ')[1];
      }

      // Convert date to ClickHouse DateTime string (YYYY-MM-DD HH:MM:SS)
      const formattedTimestamp = date.toISOString().replace('T', ' ').substring(0, 19);

      return {
        event_id: f.id,
        name: cleanName,
        country: country,
        timestamp: formattedTimestamp,
        latitude: f.geometry.coordinates[1],
        longitude: f.geometry.coordinates[0],
        magnitude: f.properties.mag,
        depth: f.geometry.coordinates[2],
        tsunami: f.properties.tsunami ? 1 : 0,
        casualties: 0,
        description: `Magnitude ${f.properties.mag} Mw earthquake registered in ${place} on ${date.toDateString()}.`
      };
    });

    // Bulk insert into ClickHouse
    await client.insert({
      table: 'earthquake_events',
      values: insertValues,
      format: 'JSONEachRow'
    });
    
    console.log(`[Ingest: Earthquakes] Successfully ingested ${insertValues.length} events!`);
  } catch (error) {
    console.error('[Ingest: Earthquakes] Failed during ingestion:', error);
    process.exit(1);
  }
}

// Check if running directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.endsWith('ingest-earthquakes.ts')) {
  run().then(() => client.close());
}

export { run as ingestEarthquakes };

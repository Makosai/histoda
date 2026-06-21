import assert from 'assert';

async function runTest() {
  console.log('[Test Ingest] Starting Open-Meteo Archive API structure test...');

  // Query coordinates for London Heathrow
  const latitude = 51.4776;
  const longitude = -0.4614;
  const startDateStr = '2025-06-15';
  const endDateStr = '2025-06-17';

  const testUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${startDateStr}&end_date=${endDateStr}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum&timezone=GMT`;

  console.log(`[Test Ingest] Fetching from URL: ${testUrl}`);

  try {
    const res = await fetch(testUrl);

    // Assert HTTP status is 200 OK
    assert.strictEqual(res.status, 200, `Expected status 200 but got ${res.status}`);
    assert.ok(res.ok, 'Response res.ok should be true');

    const data = await res.json() as any;

    console.log('[Test Ingest] Parsing response JSON...');

    // Assert top-level structure properties
    assert.ok(data, 'Response payload should be defined');
    assert.strictEqual(typeof data.latitude, 'number', 'Expected latitude to be a number');
    assert.strictEqual(typeof data.longitude, 'number', 'Expected longitude to be a number');
    assert.strictEqual(typeof data.elevation, 'number', 'Expected elevation to be a number');

    // Assert daily variables structure
    assert.ok(data.daily, 'Response should contain a "daily" object');
    assert.ok(Array.isArray(data.daily.time), '"daily.time" should be an array');
    assert.ok(Array.isArray(data.daily.temperature_2m_max), '"daily.temperature_2m_max" should be an array');
    assert.ok(Array.isArray(data.daily.temperature_2m_min), '"daily.temperature_2m_min" should be an array');
    assert.ok(Array.isArray(data.daily.temperature_2m_mean), '"daily.temperature_2m_mean" should be an array');
    assert.ok(Array.isArray(data.daily.precipitation_sum), '"daily.precipitation_sum" should be an array');

    // Assert array lengths match the date range length (3 days: 20th, 21st, 22nd)
    const expectedLength = 3;
    assert.strictEqual(data.daily.time.length, expectedLength, `Expected 3 time records, got ${data.daily.time.length}`);
    assert.strictEqual(data.daily.temperature_2m_max.length, expectedLength, 'Max temp array length mismatch');
    assert.strictEqual(data.daily.temperature_2m_min.length, expectedLength, 'Min temp array length mismatch');
    assert.strictEqual(data.daily.temperature_2m_mean.length, expectedLength, 'Mean temp array length mismatch');
    assert.strictEqual(data.daily.precipitation_sum.length, expectedLength, 'Precipitation array length mismatch');

    // Assert data types of values in daily arrays
    for (let i = 0; i < expectedLength; i++) {
      const timeVal = data.daily.time[i];
      assert.strictEqual(typeof timeVal, 'string', `Expected time to be string, got ${typeof timeVal} at index ${i}`);
      assert.match(timeVal, /^\d{4}-\d{2}-\d{2}$/, `Time ${timeVal} does not match YYYY-MM-DD pattern`);

      const maxVal = data.daily.temperature_2m_max[i];
      assert.ok(maxVal === null || typeof maxVal === 'number', 'Max temperature should be null or number');

      const minVal = data.daily.temperature_2m_min[i];
      assert.ok(minVal === null || typeof minVal === 'number', 'Min temperature should be null or number');

      const meanVal = data.daily.temperature_2m_mean[i];
      assert.ok(meanVal === null || typeof meanVal === 'number', 'Mean temperature should be null or number');

      const precipVal = data.daily.precipitation_sum[i];
      assert.ok(precipVal === null || typeof precipVal === 'number', 'Precipitation should be null or number');
    }

    console.log('[Test Ingest] ✅ All API structure assertions passed successfully!');
  } catch (error: any) {
    console.error('[Test Ingest] ❌ Test failed:', error.message || error);
    process.exit(1);
  }
}

runTest();

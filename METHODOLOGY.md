# Scientific Methodology, Data Provenance, and Data Completeness

This document outlines the scientific methodology, data sources, mathematical models, and data completeness metrics for the Histoda historical analytics platform. It serves to provide full transparency to users, peer reviewers, and researchers regarding the data we store, the data that is missing, and how gaps are modeled.

---

## 1. Overview & Data Philosophy
Histoda is designed to visualize long-term macro-trends across three domains: Climate, Seismology, and Conflict. While macro-level metadata (station directories, earthquake locations, conflict timelines, and aggregate casualties) represents verified, peer-reviewed historical records, high-resolution daily timelines are often mathematically simulated where historical records are sparse, fragmented, or unavailable in real-time.

---

## 2. Climate & Temperatures

### A. Data We Have
*   **Station Directory**: Metadata for 9 target meteorological stations (Paris, Tampa, New York, Toronto, Lagos, London, Tokyo, Cairo, Sydney) including geographic coordinates (latitude, longitude) and elevations.
*   **Modern Daily Records (1970 – 2026)**: Daily maximum, minimum, and mean temperatures, alongside daily precipitation sums, sourced from the **NOAA Global Historical Climatology Network (GHCN-Daily)** and the **NASA GISTEMP v4** dataset. These records are queried and backfilled using the Open-Meteo Historical Weather API.
*   **Global Anomalies**: An annual global temperature anomaly index indicating deviations from the 1951–1980 baseline average (~14.0°C / 57.2°F).

### B. Data We Miss (Gaps)
*   **Pre-1970 Station-Level Daily Records**: Detailed daily weather logs for individual stations before 1970 are missing in the local database to keep ingestion size lightweight.
*   **Secondary Atmospheric Variables**: High-resolution parameters such as relative humidity, wind speed, barometric pressure, and solar radiation are not included in the records.

### C. Methodology & Simulation Fallback (1880 – 1969)
For periods before 1970 (or when ClickHouse is offline), local temperature curves are modeled using:
1.  **Baseline Temperature ($T_{base}$)**: The average local annual temperature.
2.  **Global Anomaly Coefficient ($\Delta G$)**: Represents the warming trend, which starts negative in the late 19th century and rises sharply post-1970.
3.  **Seasonal Variation ($T_{seasonal}$)**: A sinusoidal wave representing annual fluctuations:
    $$T_{seasonal}(m) = \frac{R}{2} \cdot \sin\left(\frac{(m - 6)\pi}{6}\right)$$
    *Where $R$ is the station's temperature range, and $m$ is the month (1 to 12).*
4.  **Local Climate Warming**:
    $$T_{avg}(y, m) = T_{base} + T_{seasonal}(m) + (\Delta G(y) \cdot C_{local}) + \epsilon$$
    *Where $C_{local}$ is a local warming multiplier (1.3 for Tokyo/NY due to urban heat island effect, 0.9 elsewhere), and $\epsilon$ represents minor random noise.*

---

## 3. Seismic & Earthquakes

### A. Data We Have
*   **Event Catalog**: Location epicenters, magnitudes ($M_w$), focal depth, casualty estimates, and descriptive metadata for major historical earthquakes sourced from the **USGS Advanced National Seismic System (ANSS) Comprehensive Catalog (ComCat)**.
*   **Global Historical Aggregate**: Yearly earthquake counts and maximum magnitudes from 1880 to 2026.

### B. Data We Miss (Gaps)
*   **Granular Aftershock Catalogs**: Live, real-time query records of aftershocks for every historical event. Identifying aftershocks dynamically from USGS queries requires complex geographical/temporal clustering algorithms (e.g., Reasenberg) which are too slow for real-time web visualizations.
*   **Seismic Waveforms & Phase Readings**: Raw seismograms and phase arrival times are omitted.

### C. Methodology & Aftershock Modeling (30-Day Window)
To visualize local seismic decay timelines, we pre-generate a static 30-day daily aftershock sequence inside the `earthquake_aftershocks` table. This sequence is modeled using:
1.  **Omori's Law (Frequency Decay)**:
    $$n(t) = \frac{k}{(t + c)^p}$$
    *Where $n(t)$ is the rate of aftershocks at time $t$ (days) since the main shock, $c = 0.1$, $p = 1.0$, and $k$ is an productivity scaling factor based on the main shock magnitude ($M_{main}$):*
    $$k = 10^{M_{main} - 4.5}$$
2.  **Gutenberg-Richter Law (Magnitude Distribution)**:
    $$\log_{10} N(M) = a - bM$$
    *Where $N(M)$ is the number of events with magnitude $\ge M$, $b = 1.0$ (standard seismic scaling), and magnitudes range between $M = 3.0$ and $M_{main} - 1.0$.*

---

## 4. Wars & Conflicts

### A. Data We Have
*   **Conflict Registry**: Metadata including start/end years, participating combatants, total estimated casualties, region, and durations for major historical wars sourced from the **Correlates of War (COW) Project (v5.0)** and the **Uppsala Conflict Data Program (UCDP)**.
*   **Century Aggregate**: Dynamic counts of ongoing global conflicts and cumulative yearly casualties since 1920.

### B. Data We Miss (Gaps)
*   **Daily Battlefield Engagement Data**: Detailed daily battle coordinates, troop numbers, ammunition expenditure, and day-by-day local casualty figures.
*   **Minor Conflicts**: Localized skirmishes, non-state clashes, or unrest with fewer than 1,000 battle-related deaths (the standard COW inclusion threshold) are omitted to focus on major global impacts.

### C. Methodology & Intensity Modeling
For individual conflict pages, the timeline visualizes a simulated **Battle Intensity Index (%)** and **Daily Battle Count** distributed across the conflict's actual historical span:
1.  **Sinusoidal Bell Curve**: Battle activity starts slowly, peaks near the mid-point of the conflict, and decays as peace negotiations begin:
    $$I(t) = 40 + 50 \cdot \sin(p \cdot \pi) + \epsilon_{noise}$$
    *Where $p = \frac{t - t_{start}}{t_{end} - t_{start}}$ represents the timeline progress coefficient ($0 \le p \le 1$), and $\epsilon_{noise}$ is cosine-based fluctuation representing skirmish variations.*
2.  **Daily Battle Count**: Computed as:
    $$B(t) = \lfloor \frac{I(t)}{3} \rfloor + 2$$
    *During peacetime periods outside the conflict window, intensity falls to background noise ($\le 5\%$) and battle count falls to 0 or 1.*

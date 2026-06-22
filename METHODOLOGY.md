# Histoda: Scientific Methodology & Data Provenance

This document outlines the data sources, mathematical models, parameter assumptions, scientific limitations, and data completeness metrics of the Histoda historical data visualization platform. It serves to provide full academic transparency to researchers, peer reviewers, and users.

---

## 1. Climate & Temperature Domain

### Data Provenance
*   **Global Temperature Anomaly**: Modeled reference overlay derived from the **NASA Goddard Institute for Space Studies (GISTEMP v4)** global temperature anomaly dataset.
*   **Local Weather Records**: Historical logs of daily average, maximum, and minimum temperatures are scraped from the meteorological archive of the **NOAA Global Historical Climatology Network (GHCN-Daily)** database.

### Reference Baseline
Local and global temperature anomalies are relative to the standard **1960–1990 global average temperature baseline**:
$$T_{\text{baseline}} \approx 14.0^\circ\text{C} \quad (57.2^\circ\text{F})$$

### Equations
Let $T_{\text{avg}}(y, m)$ be the average local temperature for a given year $y$ and month $m$. The local anomaly $A_{\text{local}}$ is computed as:
$$A_{\text{local}}(y, m) = T_{\text{avg}}(y, m) - T_{\text{baseline}}$$

The relationship between the local anomaly and the global warming anomaly $A_{\text{global}}(y)$ is represented with a regional microclimate sensitivity factor $\gamma$:
$$A_{\text{local}}(y) \approx \gamma \cdot A_{\text{global}}(y) + \epsilon$$
Where $\gamma$ ranges from $0.9$ (tropical regions with high thermal inertia, e.g., Lagos) to $1.3$ (urban heat islands or high-latitude stations, e.g., New York, Tokyo), and $\epsilon$ represents localized seasonal fluctuation.

### Data Completeness & Gaps
*   **🟢 What We Have (Database)**: Station directories (coordinates, elevations), global temperature anomalies, and modern daily weather records (temperatures & precipitation) from 1970 to 2026 sourced via NOAA/NASA inputs.
*   **🔴 What We Miss (Gaps)**: Pre-1970 local station-level daily logs (local database limitation) and microclimatic variables (humidity, solar radiation, wind speed).
*   **Fallback Simulation**: For pre-1970 (or offline fallback), local temperatures are modeled using local averages and seasonal sine waves:
    $$T_{\text{avg}}(y, m) = T_{\text{base}} + \frac{R}{2} \cdot \sin\left(\frac{(m - 6)\pi}{6}\right) + (\Delta A_{\text{global}}(y) \cdot \gamma) + \epsilon_{\text{noise}}$$
    *Where $R$ is the station's temperature range, $m$ is the month (1 to 12), and $\epsilon_{\text{noise}}$ is random noise.*

---

## 2. Seismic & Earthquake Domain

### Data Provenance
*   **Historical Main Shocks**: Famous historical earthquakes (e.g., Valdivia 1960, Sumatra 2004, Tohoku 2011) are sourced from the **USGS ANSS Comprehensive Earthquake Catalog (ComCat)**.
*   **Incremental Logs**: The background sync daemon queries the USGS API for real-time global events of magnitude $M \ge 6.0$ to maintain an active record.

### Aftershock Decay Model (Omori's Law)
Seismic aftershock frequency decays exponentially over time following the main shock. We model this temporal distribution using **Omori's Law**:
$$n(t) = \frac{k}{(t + c)^p}$$

Where:
*   $n(t)$ is the frequency of aftershocks per day at time $t$ (in days) after the main shock.
*   $p = 1.0$ is the decay exponent (typical value for crustal earthquakes).
*   $c = 0.1$ is a time-offset constant (prevents singularity at $t = 0$).
*   $k$ is the productivity constant, scaled exponentially based on the main shock magnitude $M$:
    $$k = 15 \cdot 1.5^{M - 5.0}$$

### Magnitude Distribution (Gutenberg-Richter Law)
The magnitudes of the generated aftershock sequence are distributed according to the **Gutenberg-Richter Law**:
$$\log_{10} N(M) = a - bM$$

Where:
*   $N(M)$ is the cumulative number of earthquakes with magnitude $\ge M$.
*   $b = 1.0$ is the standard seismic scaling parameter.
*   The magnitude range is bound between a lower detection threshold $M_{\text{min}} = 3.0$ and a maximum aftershock magnitude $M_{\text{max}} = M_{\text{main}} - 1.0$.

### Data Completeness & Gaps
*   **🟢 What We Have (Database)**: Historic catalog epicenters, magnitudes, depths, and casualties of major seismic events, and global aggregates of yearly counts/max magnitudes from 1880 to 2026.
*   **🔴 What We Miss (Gaps)**: Real-time historical aftershock catalog listings directly from external APIs during interactive queries due to latency limits.
*   **Fallback Simulation**: For individual earthquake views, static 30-day daily aftershock records are pre-seeded in the database using the Omori and Gutenberg-Richter equations.

---

## 3. Human History & Conflict Domain

### Data Provenance
*   **Conflict Registries**: Global historical wars and metadata (combatants, region, spans, casualties) are compiled from the **Correlates of War (COW) Project (v5.0)** and the **Uppsala Conflict Data Program (UCDP) Battle-Related Deaths Dataset**.

### Conflict Intensity Curve
For individual conflict event views, the daily/monthly battle count $B(t)$ and intensity index $I(t)$ are modeled using a sinusoidal bell curve peaking at mid-conflict, representing the escalation, peak engagement, and resolution phases of the war:
$$I(p) = 40 + 50\sin(p\pi) + 10\cos(y \cdot 5)$$
$$B(t) = \left\lfloor \frac{I(t)}{3} \right\rfloor + \eta$$

Where:
*   $p = \frac{y - y_{\text{start}}}{y_{\text{end}} - y_{\text{start}}}$ is the progress fraction of the war ($0 \le p \le 1$).
*   $y$ is the current calendar year.
*   $\eta$ represents a random skirmish noise variable modeling minor engagements during peacetime.

### Data Completeness & Gaps
*   **🟢 What We Have (Database)**: Verified start/end years, belligerents, geographical region, total estimated casualties for major global wars, and yearly aggregates of ongoing global conflicts since 1920.
*   **🔴 What We Miss (Gaps)**: Day-by-day battlefield coordinates, troop movements, and localized conflicts below 1,000 casualties (which are excluded from the COW registry).
*   **Fallback Simulation**: The local conflict progression timeline uses the sinusoidal curve to distribute intensity and battle counts across the war's duration.

---

## 4. Scientific Limitations & Disclaimers

> [!WARNING]
> **Data Resolution Note**: While macro-level metadata (spans of wars, total casualties, climate station coordinates, earthquake locations, and main shock magnitudes) represents accurate, peer-reviewed historical records, high-resolution daily timeline parameters (e.g. battle intensity index, daily aftershock counts, pre-1970 weather records) are **mathematically simulated**. 
>
> These simulations are designed to project realistic trends for visualization and should not be used as raw data points for exact micro-level statistical regressions.

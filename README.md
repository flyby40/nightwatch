# Nightwatch

A local astronomy planning app with 24-, 48-, and 72-hour weather forecasts, astronomical darkness, Sun and Moon information, metric/imperial units, humidity, dew point, and dew-heater guidance.

## Run locally

Requires Python 3 for the local web server. No build step or package installation is needed.

```sh
python3 -m http.server 8080 --directory dist
```

Open http://localhost:8080. Search a city or choose **Use my location**. Browser geolocation requires localhost or HTTPS and your permission. Without a saved location, the app displays Flagstaff, Arizona, explicitly labeled as an example location.

## Data and missing values

- Weather and city search: [Open-Meteo](https://open-meteo.com/). These are weather model forecasts, not telescope-site measurements.
- Astronomy: the bundled [SunCalc 1.9.0](https://github.com/mourner/suncalc) library calculates Sun/Moon positions, illumination, and twilight. Its BSD license is included in `dist/SUNCALC-LICENSE.txt`.
- Seeing and transparency: CMC/ECCC RDPS provider-issued indices through [MSC GeoMet](https://eccc-msc.github.io/open-data/msc-geomet/readme_en/). Each selected hour loads exact-time forecasts for the nearest model grid point, with provider labels, model run, and grid coordinates. These are indices, not arcseconds or percentages. Coverage is North America, at roughly 10 km resolution. Missing forecasts remain **null**. The separate viewing score is an explicitly labeled Nightwatch inference, not a CMC index.
- Missing weather fields remain **null**; they are not interpolated or replaced with zeros.
- Dew-heater guidance recommends a heater when forecast relative humidity is at least 85% or temperature minus dew point is at most 3°C (5.4°F). All three inputs must be available, otherwise the recommendation is **null**. This is a disclosed equipment rule, not a prediction of optical surface temperature or dew formation.
- External sky charts and observing guides help plan dark-hour sessions. Their links do not assert event visibility at the selected location and time.

Units and the last selected location are stored in browser local storage. Weather, Sun/Moon, and CMC forecasts need no API key or backend. Optional automatic DarkSkySites readings use the separate Cloudflare backend and its secret; the browser has no API key. Google Fonts is used for typography, with local fallback fonts.

## Hosting

The application source in `dist/` runs without compilation. For deployment, run `node scripts/prepare-pages.cjs` and publish `work/pages/`. This copies the app and gives each stylesheet and script a content-hashed URL, preventing a cached old app or stylesheet from loading alongside new HTML.

- **Netlify:** publish directory `dist`.
- **Vercel:** framework preset Other, no build command, output directory `dist`.
- **GitHub Pages:** Settings → Pages → Source is **GitHub Actions**. `.github/workflows/static.yml` prepares a versioned copy of `dist/` and publishes `work/pages/` on pushes to `main` and on manual runs. No build command or Jekyll is used. Live address: https://flyby40.github.io/nightwatch/.

`.openai/hosting.json` retains the original ChatGPT Sites project identity. Other static hosts can ignore it. It contains no credentials.

## Source history and validation

The original two implementation commits are preserved. The latest app includes the requested units, longer forecast ranges, humidity/dew guidance, observing links, and explicit null values.

Previously checked: JavaScript syntax, live weather and geocoding endpoints, rendering all three forecast horizons, unit conversions, zero/null handling, dew-rule branches, and dark-hour filtering. Visual browser QA was unavailable in the original environment.

The original Sites version 2 was saved, but publication failed with a Cloudflare 504 and a subsequent publish error. GitHub Pages now provides hosting through the static deployment workflow.

## CMC integration

`dist/cmc.js` discovers each layer’s valid times and latest model run using filtered WMS GetCapabilities, then requests GetFeatureInfo for the selected hour. Layer names: `RDPS_10km_SeeingIndex`, `RDPS_10km_SkyTransparencyIndex`. Both forecast time and reference run must match the response. No time interpolation or fallback to a different run is performed. Requests are debounced, limited to two concurrently, and cached in memory per location/time/model run. Capabilities refresh after 30 minutes. Loading, out-of-domain/no-data, timeout, and invalid responses display null with an explanation. Selecting a new location resets the displayed results; asynchronous older results cannot overwrite the current selected hour. Browser CORS is supported by GeoMet; no API key or backend is used. CMC data is a numerical model forecast, not an observation at the telescope.

Source: Environment and Climate Change Canada, MSC GeoMet. See its [data licence](https://eccc-msc.github.io/open-data/licence/readme_en/) and [service usage policy](https://eccc-msc.github.io/open-data/usage-policy/).

Edit the single entrypoint `dist/index.html`. The validation workflow checks its local stylesheet and script references. No root entrypoint copy is maintained.

## Inferred viewing score

The selected-hour hero and hourly chart show a custom 0–100 planning heuristic, marked “inferred*”. It restores the original weights: cloud cover 60%, humidity 15%, wind 10%, and moonlight above the horizon 15%. Solar altitude reduces twilight scores or sets daylight to zero. The in-app footnote and methodology dialog give the complete formula. These weights and quality thresholds are uncalibrated; the score does not incorporate CMC seeing/transparency, light pollution, or smoke. All required inputs must be present, otherwise the score is null. Calculations always use the canonical km/h data regardless of the selected display units. Run the formula tests with `node --test tests/*.test.cjs`.

## Local light pollution and Bortle readings

The chart includes a location-specific light-pollution panel, an external map link centered on the forecast coordinates, and optional known Bortle and sky-brightness readings. Manual readings are explicitly user supplied and stored in browser local storage per coordinate pair. The prepared DarkSkySites integration can supply modeled zenith brightness and a provider-derived Bortle class once the backend is deployed. Dataset, quality and fallback metadata are displayed, with attribution. Unknown or unscreened values remain null. No Bortle/SQM conversion is performed by Nightwatch, and these readings do not affect the inferred viewing score.

The Cloudflare backend is deployed and configured in `dist/config.json`; live DarkSkySites lookups were verified after the encrypted API secret was added. See [backend setup](backend/README.md) for the Cloudflare Worker and manual GitHub deployment workflow. `DARKSKYSITES_API_KEY` belongs in encrypted secrets only; GitHub Pages cannot keep a key secret. No credentials should be committed to this public repository.

## Location and cloud map

A vendored Leaflet 1.9.4 map centers on the forecast location and marks it with a light-green dot. Search and device geolocation update the marker; panning does not change the forecast location. OpenStreetMap supplies base tiles and visible attribution. Leaflet's license is in `dist/vendor/leaflet/LICENSE`.

Satellite and weather overlays are available through ECCC GeoMet WMS, without an API key:

- **Satellite infrared observations:** GOES-East or GOES-West (chosen by longitude). Capture time is read from provider metadata, distinct from the chart's future forecast hour. Six advertised timestamps form a recent-image animation; no intermediate frames are generated. The slider selects an individual observed frame. Metadata refreshes every ten minutes while the map is visible, and a manual refresh is available. An image more than two hours old is labeled older imagery. Infrared imagery shows thermal patterns; it is not a cloud-cover percentage.
- **CMC forecast:** RDPS total cloud cover on a roughly 10 km model grid. This follows the selected chart hour with an explicit TIME and model-run reference. Hours outside the provider range or cadence display a null overlay, without substituting another hour. The legend comes from the provider.

The map initializes near the viewport, and overlay requests are debounced after panning. Each overlay request retrieves one bounded PNG for the viewport, using EPSG:3857. Up to 12 image blobs are held in memory for animation. Opacity, recenter, refresh, and a map-only mode are provided. Location and map attribution remain visible when an overlay fails. Missing imagery or blank areas are not presented as clear sky; coverage and processing delays apply. The Mercator map cannot display the poles. The rest of the app remains usable if the map library or image service cannot load.

Cloud data source and WMS specification: https://eccc-msc.github.io/open-data/msc-geomet/wms_en/

The deployment packaging step keeps original asset URLs for compatibility and adds content-versioned copies referenced by the published HTML. `asset-manifest.json` records those mappings. Vendor CSS stays in its original directory so relative image paths still work. Local development continues to serve `dist/` directly.

## Aurora, wind, temperature and viewing colors

- **Wind gradient:** `RDPS_10km_WindSpeed_10m` with `WINDSPEEDKMH-LINEAR`; the map legend is explicitly km/h.
- **Temperature gradient:** `RDPS_10km_AirTemp_2m` with `TEMPERATURE-LINEAR`; the map legend is explicitly °C.
- Both weather layers use the selected chart timestamp and a pinned model reference, with the provider's legend. They do not interpolate unavailable forecast hours. Map legend labels are converted to the selected metric/imperial system while retaining the provider’s color gradient and native forecast values.
- **Aurora:** NOAA SWPC's public `ovation_aurora_latest.json` supplies a short-term OVATION grid, typically 30–90 minutes ahead. Both provider observation and forecast times are shown; no 24/48/72-hour aurora timeline is inferred. A canvas displays the raw 1° cells in the map projection without smoothing the data, omitting missing cells. The nearest grid-cell value at the marker is labeled as a NOAA model value, not a personal visibility probability. Zero is preserved; unavailable cells remain null. The map auto-refreshes every five minutes while visible, has a hemisphere overview button, and links to NOAA's polar maps because Mercator excludes the poles. Darkness, cloud, and horizon conditions still matter for actual viewing.
- **Viewing colors:** inferred scores below 40 are red/Poor, 40–54 orange/Marginal, 55–69 yellow/Fair, and 70+ green/Good. Null is gray/Unavailable. Every hourly score has a text label as well as color, and the legend documents the thresholds. The numerical inference formula is unchanged; aurora and CMC map layers do not enter the score.

NOAA product documentation: https://www.swpc.noaa.gov/products/aurora-30-minute-forecast

## Units, precipitation, and dew/frost indicators

Imperial is the default for new visitors; a saved explicit metric choice is preserved. The selector controls cards, hourly temperatures, precipitation amounts, map legend labels, measurement-height labels, model-grid labels, and the map distance scale. Temperature uses °F/°C, wind mph/km/h, precipitation inches/mm. Cloud percentages, aurora model values, and coordinates remain dimensionless or angular values.

The map continues to use the CMC native gradient imagery. For wind, temperature and precipitation, its color bar is displayed with converted numeric labels. The native legend image dimensions and color-bar extents are checked before drawing; an unexpected provider legend format is labeled unavailable rather than showing mismatched values. The fixed source styles are `WINDSPEEDKMH-LINEAR` (0–110 km/h), `TEMPERATURE-LINEAR` (−40 to +40°C), and `PRECIPMM-LINEAR` (0.1–100 mm, provider-spaced labels). Quantitative conversions do not alter forecast values or infer missing data.

The precipitation map is `RDPS_10km_Precip-Accum1h`: one-hour liquid-equivalent accumulation ending at the chosen timestamp, not precipitation probability or accumulation since the model began. The hourly chart uses Open-Meteo `precipitation` in mm, converted to inches for imperial, alongside `precipitation_probability`. Snow is represented by its liquid-equivalent amount. Missing values stay null, including probability; numeric zero stays zero.

Hourly condensation badges are a disclosed inference, using the same moisture screen as dew-heater guidance: relative humidity ≥85% or air temperature minus dew point ≤3°C. If the screen is positive and air temperature is ≤3°C (37.4°F), show blue **Frost possible***; otherwise show red **Dew possible***. This is a conservative equipment-risk screen that allows for surfaces cooling below air temperature, not a provider-issued frost/dew prediction or a computed frost point. A negative screen or missing temperature/dew-point/humidity input renders no badge. Missing inputs represent unavailable risk (null), not a declaration that condensation is impossible. No badge guarantees dry optics.

The astronomical-darkness card lists the next sunrise, sunset, astronomical dusk, and astronomical dawn within the selected 24/48/72-hour horizon. It reuses the same calculated crossings as the milestone list. The moon card lists the next moonrise and moonset in that horizon, calculated with SunCalc over UTC calendar days and displayed in the selected location’s timezone. Missing crossings (including polar-day/night or no moonrise/set in the horizon) remain null, without substituting another date. Weekdays distinguish events after midnight. Both cards use the existing small secondary-text style.

## Imaging Conditions Advisor

The feature adds five selected-hour imaging suitability ratings and on-demand 24/48/72-hour CMC analysis. Missing required inputs stay null / Insufficient data. The existing observing score is unchanged. See [weighting tables, data semantics and limitations](docs/imaging-advisor.md). Screenshot examples use explicitly labeled synthetic forecasts.

## Current-hour forecast periods

On forecast load, the shared 72-period timeline begins at the start of the **selected location’s current calendar hour**, not the next hour or the device’s hour. At 8:01, 8:30 and 8:59 PM, the first period remains 8:00 PM. The 24/48/72 tabs, weather chart, selected map hour, imaging cards/timeline and favorable samples share those timestamps. `dist/forecast-time.js` uses IANA timezone calendar boundaries, including fractional UTC offsets, repeated/missing daylight-saving hours and partial hours during 30-minute DST shifts. Nonexistent hours are skipped; repeated hours retain distinct UTC instants.

Weather values are still looked up by the provider’s **exact Unix timestamp**. A missing current period or missing provider value stays null; the app never substitutes the following hour, interpolates values, or alters scores. There are still 72 periods, sliced to 24/48/72 as selected. Sun/Moon geometry uses each actual period timestamp; the darkness total and milestone cards retain their separate forward-from-now horizon. Most zones have 60-minute periods; rare partial-hour timezone transitions can produce a shorter/longer calendar period. Existing one-hour precipitation totals retain their provider meaning (ending at the timestamp), rather than becoming totals over the current partial period.

Observability is a separate policy in `dist/observability.js`: calculated local sunrise/sunset excludes daylight, which displays **Not observable** without a numeric score. Twilight/nighttime can be eligible, with astronomical darkness (Sun ≤−18°) preferred for deep sky. Planetary and lunar advice rates atmospheric suitability without requiring a specific target; both show “*subject to target availability.” Target-specific visibility will be a future feature. Daylight weather and the original raw observing score remain in the 72-hour state for future functionality. Daylight-ineligible and missing-weather samples never contribute to favorable windows or their averages.

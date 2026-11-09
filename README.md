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
- Seeing and transparency: CMC/ECCC RDPS provider-issued indices through [MSC GeoMet](https://eccc-msc.github.io/open-data/msc-geomet/readme_en/). Each selected hour loads exact-time forecasts for the nearest model grid point, with provider labels, model run, and grid coordinates. These are indices, not arcseconds or percentages. Coverage is North America, at roughly 10 km resolution. Missing forecasts remain **null**. A combined viewing score remains **null**; no proxy estimates are made.
- Missing weather fields remain **null**; they are not interpolated or replaced with zeros.
- Dew-heater guidance recommends a heater when forecast relative humidity is at least 85% or temperature minus dew point is at most 3°C (5.4°F). All three inputs must be available, otherwise the recommendation is **null**. This is a disclosed equipment rule, not a prediction of optical surface temperature or dew formation.
- External sky charts and observing guides help plan dark-hour sessions. Their links do not assert event visibility at the selected location and time.

Units and the last selected location are stored in browser local storage. No API key, backend, or server-side secret is required. Google Fonts is used for typography, with local fallback fonts.

## Hosting

Deploy the **contents of `dist/`** to any static host using HTTPS. There is no build command.

- **Netlify:** publish directory `dist`.
- **Vercel:** framework preset Other, no build command, output directory `dist`.
- **GitHub Pages:** configured to deploy `main` from the repository root. Root `index.html` loads the canonical files in `dist/`, and `.nojekyll` prevents README/Jekyll rendering. No separate Pages deployment workflow is used. Live address: https://flyby40.github.io/nightwatch/.

`.openai/hosting.json` retains the original ChatGPT Sites project identity. Other static hosts can ignore it. It contains no credentials.

## Source history and validation

The original two implementation commits are preserved. The latest app includes the requested units, longer forecast ranges, humidity/dew guidance, observing links, and explicit null values.

Previously checked: JavaScript syntax, live weather and geocoding endpoints, rendering all three forecast horizons, unit conversions, zero/null handling, dew-rule branches, and dark-hour filtering. Visual browser QA was unavailable in the original environment.

The original Sites version 2 was saved, but publication failed with a Cloudflare 504 and a subsequent publish error. This GitHub transfer does not itself enable a new deployment.

## CMC integration

`dist/cmc.js` discovers each layer’s valid times and latest model run using filtered WMS GetCapabilities, then requests GetFeatureInfo for the selected hour. Layer names: `RDPS_10km_SeeingIndex`, `RDPS_10km_SkyTransparencyIndex`. Both forecast time and reference run must match the response. No time interpolation or fallback to a different run is performed. Requests are debounced, limited to two concurrently, and cached in memory per location/time/model run. Capabilities refresh after 30 minutes. Loading, out-of-domain/no-data, timeout, and invalid responses display null with an explanation. Selecting a new location resets the displayed results; asynchronous older results cannot overwrite the current selected hour. Browser CORS is supported by GeoMet; no API key or backend is used. CMC data is a numerical model forecast, not an observation at the telescope.

Source: Environment and Climate Change Canada, MSC GeoMet. See its [data licence](https://eccc-msc.github.io/open-data/licence/readme_en/) and [service usage policy](https://eccc-msc.github.io/open-data/usage-policy/).

When changing `dist/index.html`, update the root `index.html` copy with stylesheet and script paths prefixed by `dist/`. The validation workflow checks these entrypoints remain synchronized. Other static hosts may still publish `dist/` directly.

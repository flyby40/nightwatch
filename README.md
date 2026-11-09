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

Deploy the **contents of `dist/`** to any static host using HTTPS. There is no build command.

- **Netlify:** publish directory `dist`.
- **Vercel:** framework preset Other, no build command, output directory `dist`.
- **GitHub Pages:** Settings → Pages → Source is **GitHub Actions**. `.github/workflows/static.yml` publishes only `dist/` on pushes to `main` and on manual runs. No build command or Jekyll is used. Live address: https://flyby40.github.io/nightwatch/.

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

The backend endpoint is configured in `dist/config.json`; automatic lookup is waiting for its encrypted DarkSkySites API secret. See [backend setup](backend/README.md) for the Cloudflare Worker and manual GitHub deployment workflow. `DARKSKYSITES_API_KEY` belongs in encrypted secrets only; GitHub Pages cannot keep a key secret. No credentials should be committed to this public repository.

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
- Atmospheric seeing, transparency, and a combined viewing score are **null** because the provider does not supply them. No proxy estimates are made.
- Missing weather fields remain **null**; they are not interpolated or replaced with zeros.
- Dew-heater guidance recommends a heater when forecast relative humidity is at least 85% or temperature minus dew point is at most 3°C (5.4°F). All three inputs must be available, otherwise the recommendation is **null**. This is a disclosed equipment rule, not a prediction of optical surface temperature or dew formation.
- External sky charts and observing guides help plan dark-hour sessions. Their links do not assert event visibility at the selected location and time.

Units and the last selected location are stored in browser local storage. No API key, backend, or server-side secret is required. Google Fonts is used for typography, with local fallback fonts.

## Hosting

Deploy the **contents of `dist/`** to any static host using HTTPS. There is no build command.

- **Netlify:** publish directory `dist`.
- **Vercel:** framework preset Other, no build command, output directory `dist`.
- **GitHub Pages:** `.github/workflows/pages.yml` publishes `dist/` on pushes to `main` or a manual Actions run. First set **Settings → Pages → Source → GitHub Actions**. This private repository requires a GitHub plan that supports Pages for private repositories. The website is generally public; the repository remains private. Expected address: https://flyby40.github.io/nightwatch/.

`.openai/hosting.json` retains the original ChatGPT Sites project identity. Other static hosts can ignore it. It contains no credentials.

## Source history and validation

The original two implementation commits are preserved. The latest app includes the requested units, longer forecast ranges, humidity/dew guidance, observing links, and explicit null values.

Previously checked: JavaScript syntax, live weather and geocoding endpoints, rendering all three forecast horizons, unit conversions, zero/null handling, dew-rule branches, and dark-hour filtering. Visual browser QA was unavailable in the original environment.

The original Sites version 2 was saved, but publication failed with a Cloudflare 504 and a subsequent publish error. This GitHub transfer does not itself enable a new deployment.

# Imaging Conditions Advisor v1

This advisor is an **inferred, uncalibrated planning heuristic**, not a provider prediction or a replacement for Nightwatch's existing observing score. `dist/viewing-score.js` and its formula are unchanged. No new weather API is used. Pure calculations and editable tables live in `dist/imaging-advisor.js`; DOM rendering lives in `dist/imaging-ui.js`; existing `app.js` owns forecast data and selection.

## Verified input semantics

Verified against the existing parser, live GeoMet GetFeatureInfo, and ECCC documentation on November 9, 2026:

- [Seeing categories](https://www.canada.ca/en/environment-climate-change/services/weather-general-tools-resources/astronomy/seeing-forecast.html)
- [Transparency categories](https://www.canada.ca/en/environment-climate-change/services/weather-general-tools-resources/astronomy/sky-transparency-forecast.html)

Both CMC RDPS indices are integers **0–5, higher is better**: 0 = cloudy/zero, 1 = very bad, 2 = poor, 3 = average seeing / medium transparency, 4 = good, 5 = excellent. They are not arcseconds, percentages, or a 1–10 scale. Zero is valid and adverse, not nodata. A live seeing response of 2 was labeled “Poor seeing.” Existing `CMC.parsePoint` requires one feature, a numeric integer in range, and matching valid time and model run; missing/out-of-domain/invalid/error results remain null. The advisor reads the validated `hour.cmc.*.data.value`, not the unused null placeholders `hour.seeing` / `hour.transparency`.

Open-Meteo inputs retain their existing canonical units: cloud and RH percent, wind km/h, temperature and dew point °C. SunCalc supplies Sun/Moon altitudes in degrees and Moon illumination as a 0–1 fraction. All ten inputs (seeing, transparency, clouds, wind, RH, temperature, dew point, Sun altitude, Moon altitude, illumination) must be finite and within accepted ranges. Missing/invalid values return `score: null`, `Insufficient data`, and an explicit list. No missing input is replaced by favorable weather. “Complete” describes input coverage, not calibrated forecast confidence. This conservative policy also requires transparency for planetary/lunar ratings even though its weight is small.

## Suitability tables

Index utility for CMC 0 through 5 is `[0, 15, 35, 60, 82, 100]`. Scores use the weighted mean of these components:

| Category | Seeing | Transparency | Clouds | Wind | Moon | RH | Dew spread | Darkness |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Wide-field stars/clusters | 5 | 20 | 25 | 15 | 10 | 5 | 5 | 15 |
| Broadband galaxies/reflection nebulae | 5 | 30 | 25 | 10 | 10 | 5 | 5 | 10 |
| Narrowband emission nebulae | 5 | 25 | 30 | 15 | 5 | 5 | 5 | 10 |
| High-resolution planetary | 55 | 5 | 15 | 15 | 0 | 5 | 5 | 0 |
| Lunar | 50 | 5 | 20 | 15 | 0 | 5 | 5 | 0 |

Utilities interpolate linearly between the following `(input, utility)` points, clamping outside the endpoints. These interpolations apply to the heuristic, **not to provider times, grid cells, or missing data**.

| Component | Points |
|---|---|
| Cloud % | (0,100), (10,95), (30,70), (60,30), (100,0) |
| Wind km/h | (0,100), (5,95), (15,75), (25,40), (40,10), (60,0) |
| RH % | (0,100), (60,100), (80,80), (90,50), (100,20) |
| Air − dew point °C | (0,15), (1,30), (3,65), (6,90), (10,100) |
| Sun altitude ° | (−18,100), (−12,55), (−6,15), (0,0) |

Moon utility = `100 − 100 × illuminated_fraction × (1 − moon_tolerance)` when Moon altitude >0°, otherwise 100. Tolerance is 0 for wide-field/broadband, .8 for narrowband, 1 for planetary/lunar. This does not model Moon–target separation, filter bandwidth or scattering.

Additional **soft multiplicative penalties** prevent a dominant limitation being averaged away:

- All categories: each CMC index contributes a factor `[.25, 1, 1, 1, 1, 1]` for values 0–5. A zero explicitly indicates modeled cloud, even if Open-Meteo disagrees; it is not merely poor turbulence/transparency.
- All categories: cloud factor at cloud % `(0,1), (20,.9), (50,.55), (80,.2), (100,.05)`.
- Planetary/lunar: detail factor at seeing index `(0,.1), (1,.2), (2,.4), (3,.65), (4,.9), (5,1)`.
- Broadband: transparency factor `(0,.15), (1,.3), (2,.5), (3,.75), (4,.95), (5,1)`.
- Deep-sky categories: night factor at Sun altitude `(−18,1), (−12,.8), (−6,.4), (0,.15), (15,.05)`.
- Wide-field/broadband/narrowband: extra moon factor `1 − (1 − floor) × illuminated_fraction` when Moon is up; floors .8/.65/.97 respectively. No moon factor when Moon is down.
- Lunar: multiply by .8 for a visible Moon below 20° altitude. Moon at/below 0° is the sole target eligibility rule: lunar score 0 and explicit unavailability explanation. Other conditions are graded, not hard pass/fail weather thresholds.

Cloud, seeing, transparency and moonlight appear in weights and factors deliberately: the factors preserve important physical limitations without binary weather cutoffs. RH and dew spread overlap; they are small equipment-risk penalties, not independent probability estimates. CMC indices themselves already incorporate some cloud/moisture effects. These choices are uncalibrated, adjustable and must not be interpreted statistically.

Round the final clamped 0–100 score. Good ≥70, Fair 55–69, Marginal 40–54, Poor <40. These bands are independent of, and do not change, the observing score. Explanations describe adverse inputs plus geometry/visibility limitations. Narrowband's relative tolerance to artificial light is a general property; **no artificial-light correction is computed** in v1. Equipment, tracking, target altitude/visibility (except Moon), atmospheric dispersion, filter choice, local smoke/aerosols and optical-surface temperature are not included. A daytime planetary rating describes atmospheric suitability, not safe target visibility or solar observing instructions.

## Hourly analysis and request behavior

The selected hour uses existing lazy CMC requests. “Analyze hourly forecast” explicitly loads the selected 24/48/72 timestamps, two provider fields per hour, through the existing two-request concurrency limiter and exact-time/run cache. It does not request new weather sources or modify the observing score. Progress distinguishes hours checked from hours with complete inputs. Analysis can be stopped; changing location or horizon stops scheduling further hours. An in-flight request may finish and populate only its original hour/location. Selected-hour and analysis requests share a per-hour promise. Provider failures remain null.

The category selector updates an hourly strip and up to three best windows. A window groups **consecutive hourly timestamps** with complete data and a Fair/Good rating (≥55), never bridging missing or adverse hours. Rank by mean score, then sample count, then earliest timestamp. Start/end are the first/last **sample timestamps**, not guaranteed continuous observing intervals. A single timestamp is a single sample. Clicking a window/sample selects the corresponding original forecast hour; selecting a daylight sample exits the dark-only filter. Results use the forecast location's timezone. Availability and horizon gaps are visible, not extrapolated. Partially analyzed ranges may change their ranking as additional hours load.

## Validation and screenshots

Run `node --test tests/*.test.cjs` and `node scripts/prepare-pages.cjs`. Tests cover excellent/poor/mixed/missing inputs, CMC 0 vs null and exact time/run validation, lunar visibility, relative moon tolerance, smooth penalties, configurable tables, unchanged observing score, and window gaps.

Screenshots in `docs/screenshots/` use deterministic **test forecasts**, labeled in the screenshot. They illustrate behavior rather than claim current sky conditions. Browser checks cover the selected hour, category changes, hourly analysis, range changes/cancellation, original score consistency, unit switching and mobile width overflow.

For the optional browser check, serve `dist` at port 4173 (`python3 -m http.server 4173 --directory dist`), then run `node scripts/check-imaging-browser.cjs` with Playwright available. Set `CHROMIUM_PATH` if Chromium is not at `/usr/bin/chromium`. This adds no runtime dependency to the site.

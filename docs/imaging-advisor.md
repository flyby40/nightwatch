# Imaging Conditions Advisor · matrix model

This advisor is an **inferred, uncalibrated planning heuristic**, not a provider prediction or a replacement for Nightwatch's existing observing score. `dist/viewing-score.js` and its formula are unchanged. No new weather API is used. Pure calculations and editable tables live in `dist/imaging-advisor.js`; DOM rendering lives in `dist/imaging-ui.js`; existing `app.js` owns forecast data and selection.

## Verified input semantics

Verified against the existing parser, live GeoMet GetFeatureInfo, and ECCC documentation on November 9, 2026:

- [Seeing categories](https://www.canada.ca/en/environment-climate-change/services/weather-general-tools-resources/astronomy/seeing-forecast.html)
- [Transparency categories](https://www.canada.ca/en/environment-climate-change/services/weather-general-tools-resources/astronomy/sky-transparency-forecast.html)

Both CMC RDPS indices are integers **0–5, higher is better**: 0 = cloudy/zero, 1 = very bad, 2 = poor, 3 = average seeing / medium transparency, 4 = good, 5 = excellent. They are not arcseconds, percentages, or a 1–10 scale. Zero is valid and adverse, not nodata. A live seeing response of 2 was labeled “Poor seeing.” Existing `CMC.parsePoint` requires one feature, a numeric integer in range, and matching valid time and model run; missing/out-of-domain/invalid/error results remain null. The advisor reads the validated `hour.cmc.*.data.value`, not the unused null placeholders `hour.seeing` / `hour.transparency`.

Open-Meteo inputs retain their existing canonical units: cloud and RH percent, wind km/h, temperature and dew point °C. SunCalc supplies Sun/Moon altitudes in degrees and Moon illumination as a 0–1 fraction. All ten inputs (seeing, transparency, clouds, wind, RH, temperature, dew point, Sun altitude, Moon altitude, illumination) must be finite and within accepted ranges. Missing/invalid values return `score: null`, `Insufficient data`, and an explicit list. No missing input is replaced by favorable weather. “Complete” describes input coverage, not calibrated forecast confidence. Incomplete coverage explicitly shows insufficient confidence. This conservative policy also requires transparency for planetary/lunar ratings even though its weight is small.

## Matrix foundation and atmospheric weights

The original preferred ranges are retained exactly. They guide **category-specific curves**, not binary eligibility checks. The percentages below apply to atmospheric quality only; clouds, wind, Moon and dew risk are handled separately.

| Category | Preferred seeing | Preferred transparency | Seeing weight | Transparency weight |
|---|---|---|---:|---:|
| Wide-field stars & clusters | 2–5 | 2–5 | 25% | 75% |
| Broadband galaxies & reflection nebulae | 2–5, ideally 3+ | 4–5 | 20% | 80% |
| Narrowband emission nebulae | 2–5 | 3–5 | 20% | 80% |
| High-resolution planetary | 4–5 | 2–5 | 85% | 15% |
| High-resolution lunar | 4–5 | 2–5 | 85% | 15% |

The model starts with `atmospheric = seeingUtility × seeingWeight + transparencyUtility × transparencyWeight`. There is **no arbitrary 100-point starting score**, no weather bonus, and no separate post-hoc detail/transparency penalty duplicating the curves. All utilities, ranges and weights are editable in `NightwatchImaging.config.categories` in `dist/imaging-advisor.js`.

### Separate seeing and transparency curves

Each array contains utility at CMC indices **0, 1, 2, 3, 4, 5**, in that order. Utilities range 0–100; they are heuristic suitability values, not probabilities or observed success rates. Valid CMC indices are discrete integers; fractional indices are rejected, not interpolated.

| Category | Seeing utility [0…5] | Transparency utility [0…5] |
|---|---|---|
| Wide-field | [0, 35, 70, 85, 95, 100] | [0, 20, 65, 82, 95, 100] |
| Broadband | [0, 25, 60, 85, 95, 100] | [0, 5, 20, 55, 85, 100] |
| Narrowband | [0, 35, 70, 85, 95, 100] | [0, 10, 40, 75, 92, 100] |
| Planetary | [0, 5, 20, 55, 85, 100] | [0, 40, 70, 85, 95, 100] |
| Lunar | [0, 5, 20, 55, 85, 100] | [0, 40, 70, 85, 95, 100] |

This retains useful but reduced suitability outside preferred ranges. For example, seeing 2 does not prohibit planetary photography, but its detail utility is only 20. Seeing 3 is not automatically rated Good for high-resolution work. Seeing 5 / transparency 1 can still suit planetary detail more than faint galaxies, because atmospheric stability carries 85% of the planetary atmosphere score. Preferred ranges do not guarantee Good ratings after adverse weather/geometry is included.

### Separate environmental modifiers

`raw = atmospheric × cloud × wind × dew × cmcCloud × night × moon × moonAltitude`. Each factor lies in [0,1], so it can only reduce atmospheric suitability. Parameters below are editable in `config.curves` and the category-specific Moon settings.

Piecewise-linear factor curves interpolate between the following `(input, factor)` points, clamping outside endpoints. This interpolation applies **only to heuristic curves**, not missing values, provider timestamps or grid cells.

| Factor | Points |
|---|---|
| Cloud % | (0,1), (20,.9), (50,.55), (80,.2), (100,.05) |
| Wind km/h | (0,1), (5,.98), (15,.85), (25,.6), (40,.25), (60,.1) |
| RH % | (0,1), (60,1), (80,.95), (90,.85), (100,.65) |
| Air − dew point °C | (0,.6), (1,.7), (3,.85), (6,.97), (10,1) |
| Sun altitude °, deep sky only | (−18,1), (−12,.8), (−6,.4), (0,.15), (15,.05) |

- `dew = min(RH factor, dew-spread factor)`: choose the more adverse indicator rather than multiply two correlated moisture measures. This is equipment-risk guidance, not a surface-condensation forecast. Missing moisture inputs produce insufficient data.
- `cmcCloud`: each CMC index contributes `[.1, 1, 1, 1, 1, 1]`. A zero explicitly means modeled cloudy sky and remains adverse even if Open-Meteo reports clear sky. This is not nodata or simply poor turbulence.
- `night`: deep-sky categories use the Sun-altitude curve. Planetary/lunar use 1 because darkness is less critical; planet visibility is not assessed.
- `moon`: when the Moon is up, `1 − (1 − moonFloor) × illuminatedFraction`. Floors: wide-field .8, broadband .6, narrowband .95. When the Moon is down, use 1. Planetary/lunar use 1. These do not account for target–Moon separation, filter bandwidth or scattering.
- `moonAltitude`: lunar only, .8 for Moon altitude >0° and <20°, otherwise 1.
- Lunar requires Moon altitude >0°. A Moon at/below the horizon yields score 0 with an explicit unavailability explanation. This geometry requirement is distinct from soft weather preferences.

Round the clamped final 0–100 result: Good ≥70, Fair 55–69, Marginal 40–54, Poor <40. Missing required data yields null / Insufficient data, never a favorable default. Band thresholds are configurable and independent of the unchanged observing score.

### Required combination regression cases

These examples isolate the atmosphere with neutral environmental modifiers: cloud 0%, wind 0 km/h, RH 40%, temperature 15°C, dew point 3°C, Sun −25°, visible Moon at 35° and illumination 0. These are **explicit test fixtures**, not forecasts or physically asserted Moon geometry. Actual location/hour geometry and weather can reduce the scores.

| Seeing / transparency | Wide-field | Broadband | Narrowband | Planetary | Lunar |
|---|---|---|---|---|---|
| 1 / 2 | 58 Fair | 21 Poor | 39 Poor | 15 Poor | 15 Poor |
| 5 / 5 | 100 Good | 100 Good | 100 Good | 100 Good | 100 Good |
| 5 / 1 | 40 Marginal | 24 Poor | 28 Poor | 91 Good | 91 Good |
| 1 / 5 | 84 Good | 85 Good | 87 Good | 19 Poor | 19 Poor |
| 3 / 3 | 83 Good | 61 Fair | 77 Good | 60 Fair | 60 Fair |

### Forecast integrity and tuning

Production always reads the selected location's actual hourly Open-Meteo forecast and validated exact-hour CMC results. There is **no synthetic fallback, sample-index fallback, missing-to-5 conversion or fallback to a different location/run**. The selected location/time and actual seeing/transparency indices and labels are displayed above the cards and on hourly samples. Failed or missing CMC requests remain incomplete, excluded from window ranking.

These curves and weights are the proposed first-pass matrix, **not a universal astronomical imaging standard or empirical calibration**. Compare logged forecasts with imaging sessions before changing utilities, atmospheric weights or weather modifiers. `analyze()` returns the atmospheric component utilities, atmosphere score and individual modifiers to make those comparisons inspectable. CMC indices already reflect some cloud/moisture effects, so factors are heuristic and not independent probabilities.

Narrowband's relative tolerance to artificial light is a general property; no light-pollution correction is computed here. Equipment, tracking, planet/target altitude and visibility (except Moon), atmospheric dispersion, filters, local smoke/aerosols and optical-surface temperature are not included. A daytime planetary rating describes atmospheric quality, not safe target visibility or solar observing instructions.

## Hourly analysis and request behavior

The selected hour uses existing lazy CMC requests. “Analyze hourly forecast” explicitly loads the selected 24/48/72 timestamps, two provider fields per hour, through the existing two-request concurrency limiter and exact-time/run cache. It does not request new weather sources or modify the observing score. Progress distinguishes hours checked from hours with complete inputs. Analysis can be stopped; changing location or horizon stops scheduling further hours. An in-flight request may finish and populate only its original hour/location. Selected-hour and analysis requests share a per-hour promise. Provider failures remain null.

The category selector updates an hourly strip and up to three best windows. A window groups **consecutive hourly timestamps** with complete data and a Fair/Good rating (≥55), never bridging missing or adverse hours. Rank by mean score, then sample count, then earliest timestamp. Start/end are the first/last **sample timestamps**, not guaranteed continuous observing intervals. A single timestamp is a single sample. Clicking a window/sample selects the corresponding original forecast hour; selecting a daylight sample exits the dark-only filter. Results use the forecast location's timezone. Availability and horizon gaps are visible, not extrapolated. Partially analyzed ranges may change their ranking as additional hours load.

## Validation and screenshots

Run `node --test tests/*.test.cjs` and `node scripts/prepare-pages.cjs`. Tests explicitly cover 1/2, 5/5, 5/1, 1/5 and 3/3, the original matrix ranges/weights, modifiers that cannot improve atmospheric quality, excellent/poor/mixed/missing inputs, CMC 0 vs null and exact time/run validation, lunar visibility, relative moon tolerance, smooth penalties, configurable tables, unchanged observing score, and window gaps.

Screenshots in `docs/screenshots/` use Chicago, Illinois coordinates (41.8781, −87.6298), America/Chicago timezone, and deterministic **test forecasts**, labeled in the screenshot. They illustrate behavior rather than claim current sky conditions. Browser checks cover the selected hour, category changes, hourly analysis, range changes/cancellation, original score consistency, unit switching and mobile width overflow.

For the optional browser check, serve `dist` at port 4173 (`python3 -m http.server 4173 --directory dist`), then run `node scripts/check-imaging-browser.cjs` with Playwright available. Set `CHROMIUM_PATH` if Chromium is not at `/usr/bin/chromium`. This adds no runtime dependency to the site.

### Opt-in actual forecast integration check

With the local site served at port 4173, run:

```sh
python3 scripts/capture-imaging-forecast.py /tmp/nightwatch-live-chicago.json
node scripts/check-imaging-live-snapshot.cjs /tmp/nightwatch-live-chicago.json
```

The capture fetches real Open-Meteo data and CMC metadata/point responses for Chicago's next 1 AM using only the existing APIs. The browser check replays those **unmodified captured responses** through the real app and CMC parser, checks displayed values against the source, and produces `imaging-chicago-live-desktop.png` / `imaging-chicago-live-iphone.png`. The capture timestamp appears on each screenshot. Only that exact CMC sample is supplied; other hours remain unavailable rather than being fabricated. This is a provider-response replay, not a claim that the screenshot remains current. Network errors fail capture without substituting data.

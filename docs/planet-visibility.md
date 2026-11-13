# Planet visibility and site elevation

Planet availability is independent of Nightwatch's atmospheric suitability scores. A clear atmosphere can be rated Good while the selected planet is below the horizon, below a user's altitude preference, or unavailable during daylight. Neither `dist/viewing-score.js` nor `dist/imaging-advisor.js` is changed by this feature.

## Dependency and hosting

`dist/vendor/astronomy-engine/astronomy.browser.min.js` is the **unmodified browser bundle from npm astronomy-engine 2.1.19**. Its MIT notice remains embedded and is reproduced in `LICENSE`. `provenance.json` records the exact npm tarball URL, SHA-512 integrity and browser-file SHA-256. The tarball's integrity was checked before selecting the exact file (no archive-wide extraction). No runtime CDN, ephemeris API, key, npm install or compilation is required. GitHub Pages' existing asset preparation copies and hashes the library and adapter/UI scripts together.

`dist/planet-visibility.js` is the pure model; `dist/planet-ui.js` owns DOM, selection preferences and elevation overrides. Existing SunCalc remains the authority for sunrise/sunset and nighttime eligibility, and for current Sun/Moon features. Astronomy Engine's unrefracted Sun elevation is informational in the planet panel; it does not replace the current solar rules.

## Positions and event conventions

Seven planets: Mercury, Venus, Mars, Jupiter, Saturn, Uranus and Neptune. Geometry uses the selected latitude/longitude/elevation, `Equator(body, date, observer, true, true)` (topocentric, equator of date, aberration corrected), then `Horizon(..., 'normal')` for apparent altitude/azimuth and `Horizon(..., null)` for geometric altitude. Angles are degrees; azimuth increases clockwise from north. Compass direction uses 16 sectors. Coordinates are calculated, not observed, and do not model terrain/obstructions or guarantee detection.

`SearchRiseSet` supplies refraction/limb-aware events. Event searches include the day preceding the first forecast period to establish the current horizon state, then continue to the end of the full forecast. Each subsequent search advances one second beyond the previous event, with bounded loops and range clipping. Above/below is derived from those crossings, with calculated apparent altitude only when no crossings exist. Circumpolar no-crossing cases still have known positions; next rise/set stays **null** when there is no future crossing in the selected 24/48/72-hour range. Missing/error results never turn into invented coordinates or favorable availability.

Each forecast caches computed bodies lazily, including their 72 positions and rise/set events. Solar calculations are shared between bodies. Planet/altitude/unit selection does not refetch weather or recompute existing body geometry. A new forecast/location or changed site elevation gets a fresh geometry cache. For the current partial hour, geometry/eligibility uses `max(periodStart, forecastUpdatedAt)`; future periods use the existing forecast timestamps. This preserves the current-hour fix and timezone/DST instants. Times are formatted in the location's timezone with its abbreviation to distinguish repeated DST hours. No independent live-clock update is added.

## Availability versus quality

The panel distinguishes:

- **Daylight — Not observable**: the existing SunCalc sunrise/sunset eligibility policy takes precedence, even for a geometrically elevated planet. No daytime planetary observing is supported.
- **Below horizon**: target availability fails; weather quality is unaffected.
- **Low altitude**: target is above the horizon but below the user's minimum-altitude planning preference.
- **Above calculated horizon**: target meets nighttime and the minimum-altitude preference.
- **Availability unknown**: geometry or solar eligibility could not be calculated.

The default minimum altitude is **20°**, adjustable to 0°, 10°, 20°, 30° or 40°, and saved in this browser. This is a transparent planning choice, not an empirical imaging-success threshold. It never multiplies or alters atmospheric scores. Below-preference targets remain inspectable in the hourly strip.

The atmospheric panel reuses the existing validated CMC seeing/transparency and weather inputs via `NightwatchImagingUI.input`. No naked placeholder values or missing-to-excellent fallback is used. “Analyze nighttime conditions” and “Stop analysis” share the advisor's existing on-demand nighttime CMC workflow. Missing inputs remain Insufficient data. The generic planetary/lunar advisor and its target-availability caveats remain unchanged.

Target-specific best windows require nighttime eligibility, calculated target above the horizon, altitude preference met, and a complete Fair/Good planetary atmospheric rating. Ineligible, low-altitude, missing-weather and missing-geometry samples break groups and never enter averages. Group consecutive original forecast timestamps; rank by mean atmospheric score, peak sampled altitude, then earliest timestamp, showing at most three windows. These are sampled timestamps, not guaranteed continuous observing intervals. Clicking a sample/window selects the original shared weather/imaging/map hour.

## Site elevation above mean sea level

The existing Open-Meteo forecast response's `elevation` field is retained as `state.observerHeightM`, when numeric. It is modeled elevation near the forecast location, **not a survey of the observing site**. No extra elevation API or ZIP-code inference is introduced. ZIP/city coordinates remain approximate; existing device location can identify the actual site more closely.

The Planet visibility panel has an optional measured elevation field using the app's metric/imperial choice:

1. **User-entered measurement** overrides the modeled elevation for these coordinates.
2. Otherwise use the **Open-Meteo modeled elevation**, labeled approximate.
3. If neither is usable, explicitly show **site elevation unavailable; using a 0 m sea-level reference**. This is a calculation reference, not a fabricated measured elevation.

Values are canonical meters, with exact conversion `1 ft = 0.3048 m`. Valid ground-site inputs are −500 through 10,000 m; zero and negative values are supported. Blank/invalid entries are rejected rather than silently becoming zero. Mean-sea-level elevation is distinct from telescope height above ground or uncorrected GPS ellipsoidal altitude. No GPS altitude datum is silently substituted.

Manual values are stored under `nightwatch-site-elevation|latitude|longitude`, rounded to six decimal places for the coordinate key. They are stored only in this browser, not sent to a new service, and are not independently verified. Editing input is not overwritten by background CMC updates; saving, changing units or changing location refreshes the field appropriately. “Use modeled elevation” removes the manual override. Changing height recomputes geometry only, with no changes to weather/scoring. The library's rise/set function uses its default ground-level observer convention, not an assumed clear sea horizon from a raised platform.

## Validation

Run `node --test tests/*.test.cjs` and `node scripts/prepare-pages.cjs`. Tests cover all seven bodies, 72 periods, exact current-hour timing, UTC/DST sample identity, cache reuse, latitude/height changes, rise/set bounds, circumpolar always-up/down cases, failure isolation, independent availability labels, window exclusions, unit/elevation precedence and artifact/license integrity.

`tests/fixtures/jupiter-horizons.json` contains **independent NASA/JPL Horizons** airless apparent azimuth/elevation for Jupiter at Chicago across seven instants on 2026-11-14. Query parameters, source URL, observer coordinates/elevation, refraction convention and retrieval time are recorded. Tests compare Astronomy Engine geometric altitude/azimuth against that reference within one arcminute. This validates the integration; it is not an independent accuracy audit of every supported planet.

Optional Chromium/Playwright checks (not runtime dependencies):

```sh
python3 -m http.server 4173 --directory dist
node scripts/check-planets-browser.cjs
```

Checks include seven-body geometry wiring, rise/set display, 24/48/72 scopes, daylight/below/low/above states, unchanged atmosphere/overall scores when adjusting preferences, modeled/manual/reference heights, imperial/metric conversion, persistence/reset/location scoping, negative/zero/invalid inputs, phone-width overflow and an intentionally failed ephemeris script leaving weather functional.

Review screenshots `planet-desktop.png` and `planet-iphone.png` are explicitly labeled **test forecasts**: synthetic weather and user elevation input, with actual Astronomy Engine positions for the specified fixed test date and coordinates. They do not assert current sky conditions.

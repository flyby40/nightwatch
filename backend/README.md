# Nightwatch DarkSkySites backend

This Cloudflare Worker makes fixed-endpoint DarkSkySites zenith lookups for the GitHub Pages frontend. The API key lives in a Worker secret. The public app never receives it.

## Current deployment

The Worker is deployed through the connected Cloudflare account at:

`https://nightwatch-sky-api.flyby40-nightwatch.workers.dev/api/sky`

The frontend endpoint is configured in `dist/config.json`. To activate live data, add an encrypted **Secret** named `DARKSKYSITES_API_KEY` under [Worker settings → Variables and Secrets](https://dash.cloudflare.com/8f872d744d7a55d47b1829ae3fd9c80a/workers/services/view/nightwatch-sky-api/production/settings). Use your activated DarkSkySites developer key, save, and deploy the change. Do not send the key in chat. The backend returns null readings until the secret exists. No additional Cloudflare API token or GitHub secret is required when deploying through the connected Cloudflare tools.

## Deploy with the prepared GitHub workflow

1. In Cloudflare, open **Workers & Pages** and finish initial setup of a `workers.dev` subdomain if prompted. No purchased domain is needed.
2. In Cloudflare **My Profile → API Tokens**, create a token using the **Edit Cloudflare Workers** template, restricted to the account hosting Nightwatch. Copy the account ID from that account's dashboard.
3. In [Nightwatch repository secrets](https://github.com/flyby40/nightwatch/settings/secrets/actions), add these **repository secrets**, with exactly these names:

   - `CLOUDFLARE_API_TOKEN`: the Cloudflare token.
   - `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account ID.
   - `DARKSKYSITES_API_KEY`: your activated DarkSkySites developer API key.

   Enter values only into GitHub's secret fields. Do not paste them into chat, source files, repository variables, or issue comments.
4. Open **Actions → Deploy DarkSkySites backend → Run workflow** on `main`. The workflow creates/updates `nightwatch-sky-api` and adds `DARKSKYSITES_API_KEY` as a Worker secret using Cloudflare's official deployment action. Backend deployment runs manually; normal app pushes do not redeploy it.
5. The workflow summary shows a public backend endpoint such as `https://nightwatch-sky-api.<your-subdomain>.workers.dev/api/sky`. That URL is safe to share. Set `dist/config.json` to `{"darkSkyApi":"<that endpoint>"}`, then commit it to `main` to redeploy Pages. Keep only the endpoint in this file, never a key.

For an unconfigured installation, set `darkSkyApi` to null; the frontend then keeps automatic values null. Existing manual readings and all other forecasts continue to work.

## Alternative: Cloudflare's GitHub connection

If you connected this repository directly inside Cloudflare, configure it as a **Worker** project with root directory `backend`, no build command, and deploy command `npx wrangler@4 deploy`. Set `DARKSKYSITES_API_KEY` as an encrypted Worker secret in Cloudflare's **Settings → Variables and Secrets**, then deploy. The checked-in Wrangler configuration supplies the Worker name, origin, and rate-limit binding. Use its resulting `workers.dev` endpoint in `dist/config.json` as above. Use one backend deployment method to avoid competing deployments.

## Behavior

- Route: `GET /api/sky?lat=<latitude>&lng=<longitude>`.
- Fixed upstream: `https://darkskysites.com/api/sqm`, with the credential in `x-api-key`.
- Coordinates and provider-returned coordinates are validated. No arbitrary upstream URL, date, key, or other query fields are accepted.
- CORS permits `https://flyby40.github.io` (the origin, without `/nightwatch/`). Missing/disallowed origins are rejected. This is a public app: CORS is browser policy, not authentication.
- Approximate Cloudflare rate limit: 10 requests per minute per network IP per Cloudflare location. Shared networks share a limit. This does not guarantee a hard global quota ceiling.
- Successful screened results are cached for 24 hours per exact coordinate pair at Cloudflare's edge. The client also caches in memory for 24 hours. Dataset period and retrieval time remain visible; these are model outputs, not live meter readings.
- Provider SQM and Bortle are passed through independently. Missing fields are null. No SQM-to-Bortle conversion is performed by Nightwatch.
- Results with quality other than `screened`, including `unverified_zero`, have null numeric values. Dataset, quality, and older-dataset fallback metadata are retained.
- Provider errors, expired credentials, quota limits, timeout, bad JSON, and coordinate mismatches produce null readings and a generic error. Upstream exception text and response bodies are never forwarded.
- A visible **DarkSkySites.com** attribution link is displayed beside the results.
- User-supplied local readings override the corresponding automatic field, with a distinct source label. They do not affect the viewing score.

Run checks without any credentials:

```sh
node --check backend/worker.mjs
node --test tests/*.test.cjs
```

Live end-to-end provider verification requires the deployed Worker and a valid activated API key. Unit checks use fixture responses only.

Provider documentation: https://www.darkskysites.com/api-access
Cloudflare deployment documentation: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/

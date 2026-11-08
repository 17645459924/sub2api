# Keeper frontend integration

Upstream: https://github.com/Willxup/cpa-usage-keeper
Revision: aa687529e392833e17ad0eb7ccfc4dec8eda0982
Original author: Will. Upstream MIT license is preserved in LICENSE.

The upstream React frontend is vendored here, including its components, styles,
locales, and tests. It runs as a separate same-origin SPA at /keeper/ and is
embedded by the authenticated /admin/usage-center Vue route. It does not run
Keeper's CPA backend or require a second login. The upstream license and copyright notices remain in source and bundled license files.
The product UI uses the host site branding and omits upstream marketing links.

## Development and builds

From frontend: npm run dev (builds Keeper, then starts the host).
For changes to Keeper: npm --prefix keeper run build, then refresh the host page.
Production: npm run build (or pnpm run build) builds Keeper into public/keeper
before the main Vue build copies it into backend/internal/web/dist/keeper.
The normal backend embed build includes these files. Node 22.12+ is required by
upstream Vite 8. npm ci in the build uses keeper/package-lock.json.
Adapter checks: npm --prefix keeper run typecheck; cd keeper and run
npx vitest run src/integration/sub2api.test.ts --environment happy-dom.

## Compatibility boundary

src/integration/sub2api.ts is the only data adapter. lib/api.ts changes its fetch
implementation to this adapter; UI components retain the upstream layout. The top-level selector uses real
Sub2API accounts, named account:<id> in local state, translated to account_id
by lib/api.ts. It is independent of downstream api_key_id. Its persisted key is
sub2api-usage-account-filter-v1 so legacy API key selections cannot be reused.
BrandLink uses sanitized host public site branding; the upstream footer and
integration banner are not rendered. integration/bootstrap.ts sets the hosting base.
The helper modelCatalog.ts was renamed modelCatalogData.ts to avoid Windows
case-insensitive resolution colliding with ModelCatalog.tsx. vite.config.js
sets hosting/build paths and prevents inheritance of the Vue PostCSS config.

Authentication reads the existing same-origin auth_token and verifies the
server's /auth/me admin role. Tokens never enter URLs. Every data request uses
the actual protected Sub2API API; no sample data is shipped in product code.
Sign-out is handled by the Vue host after checking message origin and source.

Overview, activity, realtime, analysis, request events, pagination, filters,
export and credential details use recorded successful usage plus client-visible
request errors. Recovered errors sharing a successful request_id are excluded;
duplicate failed request_ids count once. Ops monitoring must be enabled: if its
API fails, the adapter displays the error rather than assuming zero failures.
Time bounds are applied to each record, including rolling hours. Sub2API's
separate cached input tokens are normalized to Keeper's inclusive input tokens.
Costs are actual_cost (actual billed USD). Separate reasoning tokens are not
recorded by this backend and cannot be inferred. Unknown model/credential
attribution stays unknown. Credential totals cover the last 30 days; health
covers the last 5 hours, as stated in the integration notice.

A complete range is fetched before aggregation (100 records per backend page).
Above 50,000 records the adapter rejects the range and asks to narrow it; it
never renders a truncated aggregate. Successful snapshots are shared for up to
10 seconds. For larger installations, a server aggregation bridge should
replace this bounded client adapter.

Quota refresh queries OpenAI's live quota endpoint and Claude's active/forced
usage endpoint. At most three queries run concurrently. No active result means
unknown, never an invented zero. Passive/expired/missing Claude measurements are
not promoted to active values. Cache is per browser session and expires within
five minutes or at window reset. Historical percentage snapshots are not stored
by the current Sub2API backend; the original history drawer shows an explicit
unsupported-data message. Historical request/token/cost charts work in Analysis.

Keeper-only settings, pricing recalculation, CPA session/key management,
credential editing/deletion/priority, quota inspection/reset/auto-refresh and the
CPA model catalog have no equivalent adapter yet and explicitly return 501.
Use the original Sub2API management screens for those operations. Preserving
an upstream control does not imply that its CPA backend feature is supported.

Browser verification uses isolated mocked responses, documented in
work/keeper-browser.cjs and screenshots under work/keeper-preview; these are
verification fixtures, not production data. Real authenticated production data
still needs a logged-in admin to verify against the deployed backend. Earlier
local Claude backend fixes are not deployed by this frontend integration.
